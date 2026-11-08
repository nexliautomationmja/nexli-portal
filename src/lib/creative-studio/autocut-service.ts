import { promises as fs } from "fs";
import path from "path";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeClips,
  creativeCuts,
  creativeProjects,
  type CutClipPlan,
  type CutOverride,
  type CutSettings,
  type ManualTrim,
  type TimeCut,
} from "@/lib/creative-studio/tables";
import { buildClipPlan, probeDuration, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeClip } from "@/lib/creative-studio/transcribe";
import { readStorage } from "@/lib/creative-studio/frames";

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;
type Cut = typeof creativeCuts.$inferSelect;

export async function latestCut(projectId: string): Promise<Cut | null> {
  const [cut] = await db
    .select()
    .from(creativeCuts)
    .where(eq(creativeCuts.projectId, projectId))
    .orderBy(desc(creativeCuts.version))
    .limit(1);
  return cut ?? null;
}

export async function loadCut(projectId: string, cutId: string): Promise<Cut | null> {
  if (!/^[0-9a-f-]{36}$/i.test(cutId)) return null;
  const [cut] = await db
    .select()
    .from(creativeCuts)
    .where(and(eq(creativeCuts.id, cutId), eq(creativeCuts.projectId, projectId)))
    .limit(1);
  return cut ?? null;
}

export function overridesFor(cut: Cut | null, clipId: string): CutOverride[] {
  return cut?.plan.find((p) => p.clipId === clipId)?.overrides ?? [];
}

/** A clip's fixes in this cut (overrides + manual trim) — only if they were made on its current take. */
export function entryFor(cut: Cut | null, clip: Clip): { overrides: CutOverride[]; manual: ManualTrim | null; sections: TimeCut[] } {
  const e = cut?.plan.find((p) => p.clipId === clip.id);
  if (!e || e.version !== clip.version) return { overrides: [], manual: null, sections: [] };
  return { overrides: e.overrides ?? [], manual: e.manual ?? null, sections: e.sections ?? [] };
}

/** Download a clip's rendered video to a temp file. */
export async function clipVideoFile(clip: Clip, dir: string): Promise<string> {
  if (!clip.videoAssetId) throw new Error(`Clip ${clip.idx + 1} has no rendered video`);
  const [asset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, clip.videoAssetId)).limit(1);
  if (!asset?.storagePath) throw new Error(`Clip ${clip.idx + 1}'s video is missing`);
  const file = path.join(dir, `clip-${clip.id}.mp4`);
  await fs.writeFile(file, await readStorage(asset.storagePath));
  return file;
}

/** Make sure the clip's current take has word timings (Scribe) and its true duration. */
export async function ensureTranscript(clip: Clip, videoFile: string): Promise<Clip> {
  if (clip.transcript && clip.transcript.version === clip.version && clip.transcript.durationS > 0) return clip;
  const bytes = await fs.readFile(videoFile);
  const [transcript, duration] = await Promise.all([transcribeClip(bytes, clip.version), probeDuration(videoFile)]);
  transcript.durationS = duration || transcript.durationS || clip.durationS;
  const [updated] = await db
    .update(creativeClips)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(creativeClips.id, clip.id))
    .returning();
  return updated;
}

export function planFor(
  project: Project,
  clip: Clip,
  settings: CutSettings,
  overrides: CutOverride[],
  manual: ManualTrim | null = null,
  sections: TimeCut[] = []
): CutClipPlan {
  const t = clip.transcript && clip.transcript.version === clip.version ? clip.transcript : null;
  return buildClipPlan({
    clipId: clip.id,
    version: clip.version,
    transcript: t,
    sourceS: t?.durationS || clip.durationS,
    settings,
    overrides,
    format: project.format,
    manual,
    sections,
  });
}

const pieceRows = (projectId: string, hash: string) =>
  and(eq(creativeAssets.projectId, projectId), eq(creativeAssets.kind, "cut_part"), sql`${creativeAssets.metadata}->>'hash' = ${hash}`);

/** A previously rendered piece with this plan hash (any cut of this project). */
export async function findPiece(projectId: string, hash: string) {
  const [piece] = await db
    .select()
    .from(creativeAssets)
    .where(and(pieceRows(projectId, hash), eq(creativeAssets.status, "ready")))
    .limit(1);
  return piece ?? null;
}

/** Longer than the clip route's 300 s limit: a claim this old belongs to a request that died. */
const CLAIM_STALE_MS = 320_000;

/**
 * Claim rendering a piece, so two drivers (the batch page and the video page,
 * or a reload mid-cut) never encode the same piece at once — doing that is
 * what ran instances out of memory. Returns the claim's id, or null while
 * another request is rendering it. `driver` is the page's run id: a retry
 * from the same run takes over its own claim (its last request failed).
 */
export async function claimPiece(projectId: string, hash: string, clip: Clip, driver: string): Promise<string | null> {
  const rendering = and(pieceRows(projectId, hash), eq(creativeAssets.status, "rendering"));
  await db.delete(creativeAssets).where(and(rendering, lt(creativeAssets.createdAt, new Date(Date.now() - CLAIM_STALE_MS))));
  if (driver) await db.delete(creativeAssets).where(and(rendering, sql`${creativeAssets.metadata}->>'driver' = ${driver}`));
  const [mine] = await db
    .insert(creativeAssets)
    .values({
      projectId,
      kind: "cut_part",
      status: "rendering",
      source: "autocut",
      sort: clip.idx,
      metadata: { clipId: clip.id, hash, version: clip.version, driver },
    })
    .returning({ id: creativeAssets.id });
  // Two claims made at the same moment: the oldest wins, the other steps back.
  const [first] = await db.select({ id: creativeAssets.id }).from(creativeAssets).where(rendering).orderBy(asc(creativeAssets.createdAt), asc(creativeAssets.id)).limit(1);
  if (first && first.id !== mine.id) {
    await releasePiece(mine.id);
    return null;
  }
  return mine.id;
}

export async function releasePiece(claimId: string) {
  await db.delete(creativeAssets).where(and(eq(creativeAssets.id, claimId), eq(creativeAssets.status, "rendering")));
}

export { tempDir };
