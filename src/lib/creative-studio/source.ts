import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeProjects, type SourceMeta, type SourceStill, type TranscriptWord } from "@/lib/creative-studio/tables";
import { extractStills, makeSourceProxy, probeSpecs, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeUrl } from "@/lib/creative-studio/transcribe";
import { writeStorage } from "@/lib/creative-studio/frames";
import { removePaths, signPaths } from "@/lib/creative-studio/storage";
import { CLAIM_STALE_S, SOURCE_MAX_SECONDS, tooLongMessage } from "@/lib/creative-studio/reaction-shared";

/**
 * Reaction videos (Nov 2026): the video the presenter reacts to. Uploaded
 * straight to storage by the browser, then made ready in two steps the page
 * runs side by side, each in its own request:
 * • analyze — stills with their timestamps, and the words (Scribe), so Claude
 *   can "watch" it when it writes the script;
 * • proxy — the light copy the edit plays in the corner.
 * Two requests can write the same asset at once, so every metadata write is
 * one SQL merge of that step's own keys (never read-modify-write).
 */

type Project = typeof creativeProjects.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;
export type SourceStep = "analyze" | "proxy";

export const sourceMeta = (a: Pick<Asset, "metadata">): SourceMeta => (a.metadata ?? {}) as SourceMeta;

/** The video a reaction video reacts to (null for every other video, or when it's gone). */
export async function sourceOf(project: Pick<Project, "id" | "reaction">): Promise<Asset | null> {
  const id = project.reaction?.sourceId;
  if (!id) return null;
  const [a] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, id), eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "source_video")))
    .limit(1);
  return a ?? null;
}

/** One of the video's uploaded media videos (on screen / to recreate), or null. */
export async function mediaOf(project: Pick<Project, "id" | "media">, id: string): Promise<Asset | null> {
  if (!project.media?.ids.includes(id)) return null;
  const [a] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, id), eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "media_video")))
    .limit(1);
  return a ?? null;
}

/** All of the video's media videos, in upload order (clip 1, 2, …); missing ones skipped. */
export async function mediaItems(project: Pick<Project, "id" | "media">): Promise<Asset[]> {
  const ids = project.media?.ids ?? [];
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "media_video"), inArray(creativeAssets.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a));
}

/** Ready for the script: read (stills + words) and, unless it's a reference to recreate, light-copied. */
export function mediaReady(a: Asset): boolean {
  const m = sourceMeta(a);
  return Boolean(m.analyzedAt) && (m.role === "recreate" || Boolean(m.proxyPath));
}

/** Every file a stored asset keeps: its own, plus a source's light copy and stills. */
export function assetFiles(a: Pick<Asset, "kind" | "storagePath" | "metadata">): string[] {
  // A Manus task that recreated a photo: the photo you uploaded for it.
  if (a.kind === "manus_task") {
    const recreate = (a.metadata as { recreate?: unknown } | null)?.recreate;
    return typeof recreate === "string" ? [recreate] : [];
  }
  if (a.kind !== "source_video" && a.kind !== "media_video") return a.storagePath ? [a.storagePath] : [];
  const m = sourceMeta(a);
  return [a.storagePath, m.proxyPath, ...(m.stills ?? []).map((s) => s.path)].filter((p): p is string => Boolean(p));
}

/**
 * Take a step for this request. Returns false while another request holds it
 * (two tabs, or a reload mid-step). Clears the step's old error.
 */
export async function claimStep(id: string, step: SourceStep): Promise<boolean> {
  const now = new Date().toISOString();
  const rows = await db
    .update(creativeAssets)
    .set({
      metadata: sql`(coalesce(${creativeAssets.metadata}, '{}'::jsonb) - ${`${step}Error`}::text) || jsonb_build_object('claims', coalesce(${creativeAssets.metadata}->'claims', '{}'::jsonb) || jsonb_build_object(${step}::text, ${now}::text))`,
      status: "processing",
      error: null,
    })
    .where(
      and(
        eq(creativeAssets.id, id),
        sql`coalesce((${creativeAssets.metadata}->'claims'->>${step}::text)::timestamptz, 'epoch'::timestamptz) < now() - ${sql.raw(`interval '${CLAIM_STALE_S} seconds'`)}`
      )
    )
    .returning({ id: creativeAssets.id });
  return rows.length > 0;
}

/**
 * A step's result (or error) merged in, its claim released, and the asset's
 * status settled. False when the asset is gone (replaced mid-step).
 */
async function settleStep(id: string, step: SourceStep, patch: Record<string, unknown>, columns: Partial<Pick<Asset, "width" | "height" | "durationMs">> = {}): Promise<boolean> {
  const rows = await db
    .update(creativeAssets)
    .set({
      ...columns,
      metadata: sql`((coalesce(${creativeAssets.metadata}, '{}'::jsonb) #- ${`{claims,${step}}`}::text[]) - ${`${step}Error`}::text) || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(creativeAssets.id, id))
    .returning({ id: creativeAssets.id });
  if (rows.length === 0) return false;
  await db
    .update(creativeAssets)
    .set({
      status: sql`case
        when ${creativeAssets.metadata}->>'analyzeError' is not null or ${creativeAssets.metadata}->>'proxyError' is not null then 'failed'
        when ${creativeAssets.metadata}->>'analyzedAt' is not null and (${creativeAssets.metadata}->>'proxyPath' is not null or ${creativeAssets.metadata}->>'role' = 'recreate') then 'ready'
        else 'processing' end`,
      error: sql`coalesce(${creativeAssets.metadata}->>'analyzeError', ${creativeAssets.metadata}->>'proxyError')`,
    })
    .where(eq(creativeAssets.id, id));
  return true;
}

/** Plain messages for the user (anything else is logged and replaced with a generic one). */
class SourceError extends Error {}

const UNREADABLE = "We couldn't read this video. Export it as an MP4 and upload it again.";
const TOO_HEAVY = "This video is too heavy to prepare in time (probably 4K or 60 fps). Export it at 1080p and upload it again.";

async function downloadTo(url: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new SourceError(`Couldn't read the video from storage (${res.status}). Try again.`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(file));
}

type Specs = Awaited<ReturnType<typeof probeSpecs>> & { durationS: number };

/** Stills (6–16, long edge 768 px) and the words, for Claude. */
async function analyze(source: Asset, file: string, specs: Specs, url: string, dir: string) {
  const count = Math.min(16, Math.max(6, Math.ceil(specs.durationS / 6)));
  const [heard, grabbed] = await Promise.all([
    specs.hasAudio ? transcribeUrl(url, () => fs.readFile(file), { language: null }) : Promise.resolve(null),
    extractStills(file, dir, count, specs.durationS),
  ]);
  if (grabbed.length === 0) throw new SourceError(UNREADABLE);
  const base = `${source.projectId}/source/${source.id}`;
  const stills: SourceStill[] = await Promise.all(
    grabbed.map(async (s, i) => {
      const key = `${base}/still-${String(i + 1).padStart(2, "0")}.jpg`;
      await writeStorage(key, await fs.readFile(s.path), "image/jpeg");
      return { path: key, t: s.t };
    })
  );
  const words: TranscriptWord[] = heard?.words ?? [];
  const patch: SourceMeta = { analyzedAt: new Date().toISOString(), stills, words, text: heard?.text ?? "", hasAudio: specs.hasAudio, fps: specs.fps };
  return { patch, columns: source.durationMs ? {} : { durationMs: Math.round(specs.durationS * 1000) } };
}

/** The light copy for the corner of the edit, and the video's true (display) size from it. */
async function proxy(source: Asset, file: string, specs: Specs, dir: string, deadline: number) {
  const out = path.join(dir, "proxy.mp4");
  // Leave time to store it before the route's limit.
  const timeoutMs = deadline - Date.now() - 25_000;
  if (timeoutMs < 20_000) throw new SourceError(TOO_HEAVY);
  const started = Date.now();
  try {
    await makeSourceProxy(file, out, { maxSeconds: SOURCE_MAX_SECONDS, hasAudio: specs.hasAudio, timeoutMs });
  } catch (err) {
    console.error("[creative-studio] source proxy failed:", err instanceof Error ? err.message : err);
    throw new SourceError(Date.now() - started >= timeoutMs - 2_000 ? TOO_HEAVY : UNREADABLE);
  }
  const made = await probeSpecs(out);
  const key = `${source.projectId}/source/${source.id}/proxy.mp4`;
  await writeStorage(key, await fs.readFile(out), "video/mp4");
  const patch: SourceMeta = { proxyPath: key };
  return {
    patch,
    // The copy is upright (ffmpeg applies the phone's rotation), so its size is what the viewer sees.
    columns: {
      ...(made.width && made.height ? { width: made.width, height: made.height } : {}),
      ...(made.durationS ? { durationMs: Math.round(made.durationS * 1000) } : {}),
    },
  };
}

/**
 * Run one step for a claimed source: download it, check it, do the work and
 * save the result — or save a plain error the page shows with a retry.
 */
export async function runSourceStep(source: Asset, step: SourceStep, deadline: number): Promise<void> {
  const dir = await tempDir("cs-source");
  try {
    if (!source.storagePath) throw new SourceError("The video is missing. Upload it again.");
    const url = (await signPaths([source.storagePath], 3600)).get(source.storagePath);
    if (!url) throw new SourceError("Couldn't read the video from storage. Try again.");
    const file = path.join(dir, `source${path.extname(source.storagePath) || ".mp4"}`);
    await downloadTo(url, file);
    const probed = await probeSpecs(file);
    if (!probed.durationS || probed.durationS <= 0) throw new SourceError(UNREADABLE);
    if (probed.durationS < 2) throw new SourceError(`This video is too short${source.kind === "source_video" ? " to react to" : ""}. Upload one that's at least a few seconds long.`);
    if (probed.durationS > SOURCE_MAX_SECONDS + 0.5) throw new SourceError(tooLongMessage(probed.durationS));
    const specs: Specs = { ...probed, durationS: probed.durationS };
    const done = step === "analyze" ? await analyze(source, file, specs, url, dir) : await proxy(source, file, specs, dir, deadline);
    const kept = await settleStep(source.id, step, done.patch as Record<string, unknown>, done.columns);
    // Replaced while this ran: what it just stored belongs to nothing.
    if (!kept) await removePaths(assetFiles({ kind: "source_video", storagePath: null, metadata: done.patch as Record<string, unknown> }));
  } catch (err) {
    const message = err instanceof SourceError ? err.message : step === "analyze" ? "Reading the video failed. Try again." : "Making the light copy failed. Try again.";
    if (!(err instanceof SourceError)) console.error(`[creative-studio] source ${step} failed:`, err instanceof Error ? err.message : err);
    await settleStep(source.id, step, { [`${step}Error`]: message });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The words as Claude reads them (moved to reaction-shared so service.ts can use it). */
export { sourceTranscriptLines } from "@/lib/creative-studio/reaction-shared";
