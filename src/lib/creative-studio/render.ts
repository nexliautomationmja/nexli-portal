import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getSupabase } from "@/lib/supabase";
import {
  creativeAssets,
  creativeClips,
  creativeProjects,
} from "@/lib/creative-studio/tables";
import { CREATIVE_BUCKET, ensureCreativeBucket } from "@/lib/creative-studio/storage";
import { CREDITS_PER_SECOND, isMultiPerson } from "@/lib/creative-studio/prompts";
import {
  credits,
  KlingToolError,
  queryTask,
  submitClip,
  uploadFrame,
  uuidv7,
} from "@/lib/creative-studio/kling-mcp";
import { framesOf } from "@/lib/creative-studio/service";

/**
 * Kling batch pipeline (framework §11), adapted to serverless:
 *   • about 6 submissions per batch, one taskTraceId per batch;
 *   • "too many requests" → wait 60 s, resend once; still limited → leave
 *     the rest queued (the page continues when you press Render again);
 *   • content block → no retry, the exact error is stored;
 *   • a clip with a Kling task id is never resubmitted (redo is explicit);
 *   • finished clips are copied into storage immediately — Kling's links
 *     expire in about 24 hours.
 */

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

const BATCH = 6;
const SUBMIT_BUDGET_MS = 230_000;
const POLL_BUDGET_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isModeration(message: string): boolean {
  return /disallowed|moderation|content polic|sensitive|violat/i.test(message);
}
function isNoCredits(message: string): boolean {
  return /insufficient|credits? (are )?not enough|top up/i.test(message);
}

/** Kling URL for the clip's frame (uploaded once, reused for ~20 h). */
async function klingFrameUrl(token: string, frameId: string, taskTraceId: string): Promise<string> {
  const [frame] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, frameId)).limit(1);
  if (!frame?.storagePath) throw new Error("The opening frame is missing");
  const meta = (frame.metadata ?? {}) as { klingUrl?: string; klingUrlAt?: string };
  if (meta.klingUrl && meta.klingUrlAt && Date.now() - new Date(meta.klingUrlAt).getTime() < 20 * 3600_000) {
    return meta.klingUrl;
  }
  const { data, error } = await getSupabase().storage.from(CREATIVE_BUCKET).download(frame.storagePath);
  if (error || !data) throw new Error("Couldn't read the opening frame from storage");
  // Kling accepts PNG/JPG only.
  const mime = frame.mime === "image/jpeg" ? "image/jpeg" : "image/png";
  if (frame.mime === "image/webp") throw new Error("Kling needs a PNG or JPG frame. Re-upload the frame as PNG or JPG.");
  const url = await uploadFrame(
    token,
    { bytes: Buffer.from(await data.arrayBuffer()), mime, filename: `frame-${frame.id}.${mime === "image/jpeg" ? "jpg" : "png"}` },
    taskTraceId
  );
  await db
    .update(creativeAssets)
    .set({ metadata: { ...meta, klingUrl: url, klingUrlAt: new Date().toISOString() } })
    .where(eq(creativeAssets.id, frame.id));
  return url;
}

export interface SubmitReport {
  submitted: number;
  queued: number;
  failed: number;
  creditsNeeded: number;
  creditsRemaining: number | null;
  message: string | null;
}

/** Submit `clips` to Kling. Caller decides which clips (render all vs redo). */
export async function submitClips(token: string, project: Project, clips: Clip[]): Promise<SubmitReport> {
  const started = Date.now();
  const report: SubmitReport = { submitted: 0, queued: 0, failed: 0, creditsNeeded: 0, creditsRemaining: null, message: null };
  if (clips.length === 0) return report;

  // Credits: render what fits, say how many more are needed.
  report.creditsNeeded = clips.reduce((s, c) => s + c.durationS * CREDITS_PER_SECOND, 0);
  try {
    report.creditsRemaining = (await credits(token)).remaining;
  } catch {
    report.creditsRemaining = null; // unknown — Kling itself will refuse if short
  }
  let affordable = clips;
  if (report.creditsRemaining !== null && report.creditsNeeded > report.creditsRemaining) {
    let budget = report.creditsRemaining;
    affordable = [];
    for (const c of clips) {
      const cost = c.durationS * CREDITS_PER_SECOND;
      if (cost > budget) break;
      budget -= cost;
      affordable.push(c);
    }
    const short = report.creditsNeeded - report.creditsRemaining;
    report.message = `Your Kling balance covers ${affordable.length} of ${clips.length} clips. About ${short.toLocaleString("en-US")} more credits are needed for the rest.`;
  }

  const frames = await framesOf(project.id);
  const primary = frames[0]?.id;
  // Per clip: a story's scene with two or more people renders on Omni (its model is stored on the clip).
  const multiFor = (clip: Clip) => (clip.model ? clip.model === "kling-video-v3_0_omni" : isMultiPerson(project.rig));
  const pending = [...affordable];
  report.queued = clips.length - affordable.length;

  await db.update(creativeClips).set({ status: "queued", updatedAt: new Date() }).where(inArray(creativeClips.id, affordable.map((c) => c.id)));
  await db.update(creativeProjects).set({ status: "rendering", updatedAt: new Date() }).where(eq(creativeProjects.id, project.id));

  let stop = false;
  while (pending.length > 0 && !stop) {
    const batch = pending.splice(0, BATCH);
    const taskTraceId = uuidv7();
    for (const clip of batch) {
      if (Date.now() - started > SUBMIT_BUDGET_MS) {
        report.message = report.message ?? "Some clips are still queued. Press Render again to send the rest.";
        stop = true;
        break;
      }
      const frameId = clip.frameAssetId ?? primary;
      if (!frameId) {
        await markClip(clip.id, "failed", "No opening frame");
        report.failed++;
        continue;
      }
      let attempt = 0;
      while (true) {
        try {
          const frameUrl = await klingFrameUrl(token, frameId, taskTraceId);
          const { generationId, model } = await submitClip(token, {
            multiPerson: multiFor(clip),
            aspectRatio: project.format === "vsl_16x9" ? "16:9" : "9:16",
            prompt: clip.prompt,
            durationS: clip.durationS,
            frameUrl,
            taskTraceId,
            rationale: `Nexli Creative Studio: clip ${clip.idx + 1} of the approved ${clip.kind && clip.kind !== "to_camera" ? "story" : "talking-head"} script "${project.title}", rendered with native audio as the framework specifies.`,
          });
          await db
            .update(creativeClips)
            .set({ status: "rendering", klingTaskId: generationId, model, error: null, updatedAt: new Date() })
            .where(eq(creativeClips.id, clip.id));
          report.submitted++;
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (err instanceof KlingToolError && err.kind === "rate_limited" && attempt === 0) {
            attempt++;
            await sleep(60_000); // framework: wait 60 s, resend once
            continue;
          }
          if (err instanceof KlingToolError && (err.kind === "rate_limited" || err.kind === "auth")) {
            report.message = err.kind === "auth" ? message : "Kling is rate-limiting. Press Render again in a minute to send the rest.";
            stop = true;
          } else if (isNoCredits(message)) {
            report.message = `Kling: ${message}`;
            stop = true;
          } else {
            await markClip(clip.id, isModeration(message) ? "blocked" : "failed", message.slice(0, 500));
            report.failed++;
          }
          break;
        }
      }
      if (stop) break;
    }
  }

  // Whatever wasn't sent goes back to draft so it can be sent later.
  const [still] = await Promise.all([
    db
      .select({ id: creativeClips.id })
      .from(creativeClips)
      .where(and(eq(creativeClips.projectId, project.id), eq(creativeClips.status, "queued"))),
  ]);
  if (still.length > 0) {
    await db.update(creativeClips).set({ status: "draft", updatedAt: new Date() }).where(inArray(creativeClips.id, still.map((s) => s.id)));
    report.queued += still.length;
  }
  return report;
}

async function markClip(id: string, status: string, error: string) {
  await db.update(creativeClips).set({ status, error, updatedAt: new Date() }).where(eq(creativeClips.id, id));
}

/** Check rendering clips; store finished ones. Returns how many are still rendering. */
export async function pollClips(token: string, project: Project): Promise<{ rendering: number; finished: number }> {
  const started = Date.now();
  const rendering = await db
    .select()
    .from(creativeClips)
    .where(and(eq(creativeClips.projectId, project.id), eq(creativeClips.status, "rendering")));
  let finished = 0;
  let left = rendering.length;

  for (const clip of rendering) {
    if (Date.now() - started > POLL_BUDGET_MS) break;
    if (!clip.klingTaskId) continue;
    let state;
    try {
      state = await queryTask(token, clip.klingTaskId);
    } catch (err) {
      if (err instanceof KlingToolError && err.kind === "auth") throw err;
      console.error("[creative-studio] query_tasks failed:", err instanceof Error ? err.message : err);
      continue;
    }
    if (state.state === "running") continue;
    if (state.state === "failed") {
      await markClip(clip.id, isModeration(state.error) ? "blocked" : "failed", state.error.slice(0, 500));
      left--;
      continue;
    }
    // Done: copy the mp4 into storage before Kling's link expires.
    try {
      const res = await fetch(state.videoUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      await ensureCreativeBucket();
      const path = `${project.id}/clips/${clip.id}-v${clip.version}.mp4`;
      const { error } = await getSupabase()
        .storage.from(CREATIVE_BUCKET)
        .upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(error.message);
      const [asset] = await db
        .insert(creativeAssets)
        .values({
          projectId: project.id,
          kind: "clip",
          storagePath: path,
          mime: "video/mp4",
          durationMs: clip.durationS * 1000,
          source: "kling",
          providerTaskId: clip.klingTaskId,
          sort: clip.idx,
          metadata: { clipId: clip.id, version: clip.version, klingUrl: state.videoUrl },
        })
        .returning({ id: creativeAssets.id });
      await db
        .update(creativeClips)
        .set({ status: "done", videoAssetId: asset.id, error: null, updatedAt: new Date() })
        .where(eq(creativeClips.id, clip.id));
      finished++;
      left--;
    } catch (err) {
      console.error("[creative-studio] storing clip failed:", err instanceof Error ? err.message : err);
    }
  }

  if (left === 0) {
    const all = await db.select({ status: creativeClips.status }).from(creativeClips).where(eq(creativeClips.projectId, project.id));
    if (all.length > 0 && all.every((c) => c.status === "done")) {
      await db.update(creativeProjects).set({ status: "clips_ready", updatedAt: new Date() }).where(eq(creativeProjects.id, project.id));
    }
  }
  return { rendering: Math.max(0, left), finished };
}
