import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips, creativeProjects, type ClipTranscript, type ClipUpload } from "@/lib/creative-studio/tables";
import { makeClipCopy, probeSpecs, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeUrl } from "@/lib/creative-studio/transcribe";
import { writeStorage } from "@/lib/creative-studio/frames";
import { signPaths } from "@/lib/creative-studio/storage";
import { CLAIM_STALE_S, SOURCE_MAX_SECONDS, tooLongMessage } from "@/lib/creative-studio/reaction-shared";

/**
 * Your own video as a clip (Nov 22 2026). Marcel: "add a new clip into the
 * Creative Studio even once Kling has generated all the clips and everything
 * has auto-cut … add this video into it and have you recut it."
 *
 * The browser uploads the file straight to storage and the clip is added
 * where it goes ("preparing"). Then one request (claimed, so two tabs never
 * do it twice) makes its take: a clean copy the cut can join with the Kling
 * takes (makeClipCopy) and its words (Scribe), the same word timings a Kling
 * take gets. The clip is then "done" and the page's cut card sees a clip
 * that isn't in the latest cut, so it auto-cuts the whole video again.
 */

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

/** Statuses a video can take a clip of your own in: the script is approved (its clips are being made, or are made). */
export const UPLOAD_CLIP_STATUSES = ["approved", "rendering", "clips_ready"];

/** What Kling would have been asked for: an added video has no prompt. */
export const UPLOAD_CLIP_PROMPT = "Your own video, added after the clips were made. It isn't made on Kling.";

/** The section an added video sits in (the script's sections are the writer's). */
export const UPLOAD_CLIP_SECTION = "Your video";

/** Plain messages for the page (anything else is logged and replaced with a generic one). */
class PrepareError extends Error {}

const UNREADABLE = "We couldn't read this video. Export it as an MP4 and add it again.";
const TOO_HEAVY = "This video is too heavy to get ready in time (probably 4K). Export it at 1080p and add it again.";

async function downloadTo(url: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new PrepareError(`Couldn't read the video from storage (${res.status}). Try again.`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(file));
}

/**
 * Take the clip for this request: only a clip of your own that isn't ready,
 * and only when no other request is on it. Returns the claimed row, or null.
 */
export async function claimUploadedClip(projectId: string, clipId: string): Promise<Clip | null> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(creativeClips)
    .set({
      upload: sql`${creativeClips.upload} || jsonb_build_object('claimedAt', ${now}::text)`,
      status: "preparing",
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creativeClips.id, clipId),
        eq(creativeClips.projectId, projectId),
        sql`${creativeClips.upload} IS NOT NULL`,
        inArray(creativeClips.status, ["preparing", "failed"]),
        sql`coalesce((${creativeClips.upload}->>'claimedAt')::timestamptz, 'epoch'::timestamptz) < now() - ${sql.raw(`interval '${CLAIM_STALE_S} seconds'`)}`
      )
    )
    .returning();
  return row ?? null;
}

/**
 * Make a claimed clip's take: download → check → clean copy → words → saved
 * as the clip's video. On a problem the clip is "failed" with a plain reason
 * (the page shows it with Try again and Remove). Never throws.
 */
export async function prepareUploadedClip(project: Project, clip: Clip, deadline: number): Promise<void> {
  const upload = clip.upload as ClipUpload;
  const dir = await tempDir("cs-upclip");
  try {
    const url = (await signPaths([upload.originalPath], 3600)).get(upload.originalPath);
    if (!url) throw new PrepareError("The video is missing. Add it again.");
    const file = path.join(dir, `original${path.extname(upload.originalPath) || ".mp4"}`);
    await downloadTo(url, file);
    const probed = await probeSpecs(file);
    if (!probed.durationS || probed.durationS <= 0 || !probed.width) throw new PrepareError(UNREADABLE);
    if (probed.durationS < 0.5) throw new PrepareError("This video is too short. Add one that's at least a second long.");
    if (probed.durationS > SOURCE_MAX_SECONDS + 0.5) throw new PrepareError(tooLongMessage(probed.durationS, SOURCE_MAX_SECONDS));

    // Leave time to store it and read its words before the route's limit.
    const out = path.join(dir, "clip.mp4");
    const timeoutMs = deadline - Date.now() - 75_000;
    if (timeoutMs < 20_000) throw new PrepareError(TOO_HEAVY);
    const started = Date.now();
    try {
      await makeClipCopy(file, out, { maxSeconds: SOURCE_MAX_SECONDS, hasAudio: probed.hasAudio, timeoutMs });
    } catch (err) {
      console.error("[creative-studio] clip copy failed:", err instanceof Error ? err.message : err);
      throw new PrepareError(Date.now() - started >= timeoutMs - 2_000 ? TOO_HEAVY : UNREADABLE);
    }
    const made = await probeSpecs(out);
    const durationS = made.durationS || probed.durationS;
    const storagePath = `${project.id}/clips/${clip.id}/upload-v${clip.version}.mp4`;
    await writeStorage(storagePath, await fs.readFile(out), "video/mp4");

    // Its words, the same way a Kling take's are read (Scribe), in whatever language it's in.
    let transcript: ClipTranscript = { version: clip.version, durationS, words: [], text: "" };
    if (probed.hasAudio) {
      const copyUrl = (await signPaths([storagePath], 3600)).get(storagePath);
      try {
        const heard = await transcribeUrl(copyUrl ?? "", () => fs.readFile(out), { language: null });
        transcript = { version: clip.version, durationS, words: heard.words, text: heard.text };
      } catch (err) {
        // Without its words the cut would keep it whole and caption nothing: better to say so and retry.
        console.error("[creative-studio] reading an added video's words failed:", err instanceof Error ? err.message : err);
        throw new PrepareError("Reading what's said in the video failed. Try again.");
      }
    }

    const [asset] = await db
      .insert(creativeAssets)
      .values({
        projectId: project.id,
        kind: "clip",
        storagePath,
        mime: "video/mp4",
        width: made.width,
        height: made.height,
        durationMs: Math.round(durationS * 1000),
        source: "upload",
        sort: clip.idx,
        metadata: { clipId: clip.id, version: clip.version, filename: upload.filename },
      })
      .returning({ id: creativeAssets.id });
    const done: ClipUpload = {
      ...upload,
      claimedAt: null,
      hasAudio: probed.hasAudio,
      hdr: probed.hdr,
      aspect: made.width && made.height ? Math.round((made.width / made.height) * 1000) / 1000 : null,
    };
    const updated = await db
      .update(creativeClips)
      .set({
        status: "done",
        videoAssetId: asset.id,
        durationS: Math.max(1, Math.round(durationS)),
        // What's said in it: the cut's captions line its words up against this.
        line: transcript.text.slice(0, 2000),
        transcript,
        upload: done,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(creativeClips.id, clip.id))
      .returning({ id: creativeClips.id });
    if (updated.length === 0) return; // removed while it was being made
    // The last clip to be ready: the video's clips are all made (as when Kling's last take lands).
    const all = await db.select({ status: creativeClips.status }).from(creativeClips).where(eq(creativeClips.projectId, project.id));
    if (all.every((c) => c.status === "done")) {
      await db
        .update(creativeProjects)
        .set({ status: "clips_ready", updatedAt: new Date() })
        .where(and(eq(creativeProjects.id, project.id), inArray(creativeProjects.status, ["approved", "rendering"])));
    }
  } catch (err) {
    const message = err instanceof PrepareError ? err.message : "Getting the video ready failed. Try again.";
    if (!(err instanceof PrepareError)) console.error("[creative-studio] preparing an added video failed:", err instanceof Error ? err.message : err);
    await db
      .update(creativeClips)
      .set({ status: "failed", error: message, upload: { ...upload, claimedAt: null }, updatedAt: new Date() })
      .where(eq(creativeClips.id, clip.id));
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
