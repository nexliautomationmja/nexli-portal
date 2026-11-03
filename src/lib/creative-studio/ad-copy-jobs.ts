import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { normalizeCopy, type AdCopyVersion, type CopyContext } from "@/lib/creative-studio/ad-copy";
import { extractFrames, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeUrl } from "@/lib/creative-studio/transcribe";
import { readStorage, writeStorage } from "@/lib/creative-studio/frames";
import { signPaths } from "@/lib/creative-studio/storage";

/**
 * The Ad copy tool's jobs: any video or image dropped in, stored as a
 * workspace asset (kind "copy_job", no project — like Daniela references).
 * The transcript and frames are worked out once and kept on the job, so new
 * variations and changes only call Claude.
 */

type Asset = typeof creativeAssets.$inferSelect;

export interface CopyJobMeta {
  filename?: string;
  /** Set when the file was dropped in with others (up to 20 at once). */
  group?: string;
  groupIndex?: number;
  note?: string;
  transcript?: string;
  /** Stored stills of a video (JPEG), in order. */
  framePaths?: string[];
  /**
   * Big videos are prepared in the browser (storage refuses files over its
   * upload limit): only the stills and the soundtrack (WAV) are uploaded,
   * and storagePath is the first still.
   */
  prepared?: boolean;
  audioPath?: string | null;
  versions?: AdCopyVersion[];
}

export const COPY_MEDIA: Record<string, "video" | "image"> = {
  "video/mp4": "video",
  "video/quicktime": "video",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};
export const COPY_EXT: Record<string, string> = {
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const metaOf = (a: Asset) => (a.metadata ?? {}) as CopyJobMeta;

export async function loadJob(ownerId: string, jobId: string): Promise<Asset | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const [job] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, jobId), eq(creativeAssets.ownerId, ownerId), eq(creativeAssets.kind, "copy_job"), isNull(creativeAssets.projectId)))
    .limit(1);
  return job ?? null;
}

/** What the browser shows for a job (signed URLs, normalized versions). */
export async function jobViews(jobs: Asset[]) {
  const signed = await signPaths(
    jobs.flatMap((j) => [j.storagePath, metaOf(j).framePaths?.[0]]),
    6 * 3600
  );
  return jobs.map((j) => {
    const m = metaOf(j);
    const media = COPY_MEDIA[j.mime ?? ""] ?? "image";
    const mediaUrl = j.storagePath ? signed.get(j.storagePath) ?? null : null;
    return {
      id: j.id,
      filename: m.filename ?? "upload",
      media,
      mime: j.mime,
      mediaUrl,
      /** What the feed preview can show: the video, or (for a big prepared video) its first still. */
      previewKind: (m.prepared ? "image" : media) as "video" | "image",
      thumbUrl: media === "image" ? mediaUrl : m.framePaths?.[0] ? signed.get(m.framePaths[0]) ?? null : null,
      note: m.note ?? "",
      group: m.group ?? null,
      groupIndex: m.groupIndex ?? 0,
      transcript: m.transcript ?? null,
      versions: (m.versions ?? []).map(normalizeCopy),
      createdAt: j.createdAt.toISOString(),
    };
  });
}

export type CopyJobView = Awaited<ReturnType<typeof jobViews>>[number];

export async function listJobs(ownerId: string) {
  const jobs = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.ownerId, ownerId), eq(creativeAssets.kind, "copy_job"), isNull(creativeAssets.projectId)))
    .orderBy(desc(creativeAssets.createdAt))
    .limit(80);
  return jobViews(jobs);
}

const toB64 = async (buf: Buffer) => (await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString("base64");

/**
 * Everything Claude needs about the dropped-in file. A video is listened to
 * (Scribe, straight from the signed link) and watched (6 stills) the first
 * time; both are saved on the job for next time.
 */
export async function copyContextFor(job: Asset, ownerId: string): Promise<CopyContext> {
  const m = metaOf(job);
  const media = COPY_MEDIA[job.mime ?? ""] ?? "image";
  if (!job.storagePath) throw new Error("The upload is missing");

  if (media === "image") {
    return { media, note: m.note || undefined, images: [{ mediaType: "image/jpeg", data: await toB64(await readStorage(job.storagePath)) }] };
  }

  let transcript = m.transcript;
  let framePaths = m.framePaths;
  if (m.prepared) {
    // Stills and soundtrack came from the browser; the video itself was never uploaded.
    if (transcript === undefined) {
      const audio = m.audioPath;
      const url = audio ? (await signPaths([audio], 3600)).get(audio) : undefined;
      transcript = audio && url ? (await transcribeUrl(url, () => readStorage(audio))).text : "";
      await db
        .update(creativeAssets)
        .set({ metadata: { ...m, transcript } })
        .where(eq(creativeAssets.id, job.id));
    }
  } else if (transcript === undefined || !framePaths?.length) {
    const source = job.storagePath;
    const url = (await signPaths([source], 3600)).get(source);
    if (!url) throw new Error("Couldn't read the video from storage");
    const dir = await tempDir("cs-copy");
    try {
      const [heard, stills] = await Promise.all([
        transcript === undefined ? transcribeUrl(url, () => readStorage(source)).then((t) => t.text) : Promise.resolve(transcript),
        framePaths?.length
          ? Promise.resolve(framePaths)
          : (async () => {
              const file = path.join(dir, `source.${COPY_EXT[job.mime ?? ""] ?? "mp4"}`);
              await fs.writeFile(file, await readStorage(source));
              const frames = await extractFrames(file, dir, 6);
              const stored: string[] = [];
              for (let i = 0; i < frames.length; i++) {
                const p = `adcopy/${ownerId}/${job.id}/f${i + 1}.jpg`;
                await writeStorage(p, await fs.readFile(frames[i]), "image/jpeg");
                stored.push(p);
              }
              return stored;
            })(),
      ]);
      transcript = heard;
      framePaths = stills;
      await db
        .update(creativeAssets)
        .set({ metadata: { ...m, transcript, framePaths } })
        .where(eq(creativeAssets.id, job.id));
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
  const images = await Promise.all((framePaths ?? []).map(async (p) => ({ mediaType: "image/jpeg" as const, data: (await readStorage(p)).toString("base64") })));
  return { media, note: m.note || undefined, transcript: transcript ?? "", images };
}
