import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { getSupabase } from "@/lib/supabase";
import { CREATIVE_BUCKET, ensureCreativeBucket, signPaths } from "@/lib/creative-studio/storage";
import { extractAt, probeSpecs, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeUrl } from "@/lib/creative-studio/transcribe";
import { hookFacts, type ReadFrame, type ReadMedia } from "@/lib/ads/grader-shared";

/**
 * How the Ad Grader "watches" a creative: download it (streamed to /tmp,
 * hashed on the way), stills at 0, 0.5, 1, 1.5, 2 and 3 seconds (the hook),
 * four through the middle and the last moment (the ask), and every word with
 * its time (ElevenLabs Scribe). Stills are stored in the private Creative
 * Studio bucket; Meta's own video links expire, so they're never stored.
 */

const MAX_BYTES = 300 * 1024 * 1024;
const HOOK_TIMES = [0, 0.5, 1, 1.5, 2, 3];

export class MediaError extends Error {}

async function put(key: string, bytes: Buffer, contentType: string) {
  await ensureCreativeBucket();
  const { error } = await getSupabase().storage.from(CREATIVE_BUCKET).upload(key, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

/** Stream a URL to disk with a size cap, hashing as it goes. */
async function download(url: string, file: string): Promise<{ bytes: number; hash: string; contentType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) throw new MediaError(`Couldn't download the video (${res.status}).`);
  const hash = createHash("sha1");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) return cb(new MediaError("The video is bigger than 300 MB."));
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), meter, createWriteStream(file));
  return { bytes, hash: hash.digest("hex"), contentType: res.headers.get("content-type") };
}

/**
 * Watch a video at `url` and store its stills under `prefix`. `transcript`
 * false skips the words (no sound). Throws MediaError with a readable reason.
 */
export async function watchVideo(url: string, prefix: string, opts: { deadline: number }): Promise<ReadMedia> {
  const dir = await tempDir("ads-grade");
  try {
    const file = path.join(dir, "video.mp4");
    const got = await download(url, file);
    const specs = await probeSpecs(file);
    const durationS = specs.durationS ?? 0;
    if (!(durationS > 0.5)) throw new MediaError("That file doesn't play as a video.");
    const spread = Math.max(0, durationS - 3) > 4 ? [0.3, 0.5, 0.7, 0.9].map((f) => 3 + (durationS - 3) * f * 0.92) : [];
    const [heard, hook, middle] = await Promise.all([
      specs.hasAudio
        ? transcribeUrl(url, () => fs.readFile(file), { language: null })
            .then((t) => ({ t, error: null as string | null }))
            .catch((err) => ({ t: null, error: err instanceof Error ? err.message.slice(0, 200) : "Transcription failed" }))
        : Promise.resolve({ t: null, error: null as string | null }),
      extractAt(file, dir, HOOK_TIMES, durationS),
      extractAt(file, dir, [...spread, durationS - 0.15], durationS),
    ]);
    if (!hook.length) throw new MediaError("Couldn't take stills from the video.");
    if (Date.now() > opts.deadline) throw new MediaError("Ran out of time watching the video — it'll try again.");
    const frames: ReadFrame[] = [];
    const all = [...hook.map((h) => ({ ...h, role: "hook" as const })), ...middle.map((m, i) => ({ ...m, role: i === middle.length - 1 ? ("end" as const) : ("spread" as const) }))];
    const seen = new Set<number>();
    for (const f of all) {
      if (seen.has(f.t)) continue;
      seen.add(f.t);
      const key = `${prefix}/t${String(f.t).replace(".", "_")}.jpg`;
      await put(key, await fs.readFile(f.path), "image/jpeg");
      frames.push({ t: f.t, path: key, role: f.role });
    }
    frames.sort((a, b) => a.t - b.t);
    const words = (heard.t?.words ?? []).slice(0, 800).map((w) => ({ text: w.text, start: Math.round(w.start * 100) / 100, end: Math.round(w.end * 100) / 100 }));
    const facts = hookFacts(words, durationS);
    return {
      kind: "video",
      durationS: Math.round(durationS * 10) / 10,
      width: specs.width,
      height: specs.height,
      hasAudio: specs.hasAudio,
      frames,
      words,
      text: (heard.t?.text ?? "").slice(0, 6000),
      transcriptError: heard.error,
      ...facts,
      sizeBytes: got.bytes,
      fileHash: got.hash,
      quality: specs.hasAudio && !heard.t ? "no_transcript" : "full",
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** A still-only read (an image ad, or a video Meta won't hand over): one picture, no words. */
export async function watchStill(url: string, prefix: string, kind: "video" | "image"): Promise<ReadMedia> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new MediaError(`Couldn't download the picture (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const out = await img.resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const key = `${prefix}/still.jpg`;
  await put(key, out, "image/jpeg");
  return {
    kind,
    durationS: null,
    width: meta.width ?? null,
    height: meta.height ?? null,
    hasAudio: false,
    frames: [{ t: 0, path: key, role: "hook" }],
    words: [],
    text: "",
    transcriptError: null,
    hookWords: "",
    firstWordAt: null,
    wordsPerSec: null,
    sizeBytes: buf.length,
    fileHash: createHash("sha1").update(buf).digest("hex"),
    quality: "still_only",
  };
}

/** Signed URLs for a read's stills (for Claude and the page). */
export async function frameUrls(paths: string[], seconds = 3600): Promise<Map<string, string>> {
  return signPaths(paths, seconds);
}
