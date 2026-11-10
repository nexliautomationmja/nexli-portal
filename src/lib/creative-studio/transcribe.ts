import type { ClipTranscript, TranscriptWord } from "@/lib/creative-studio/tables";

/**
 * Word-level speech-to-text for a rendered clip, via ElevenLabs Scribe (the
 * same service the portal uses for voice-note transcripts). Scribe takes the
 * mp4 directly and returns each word with start/end seconds — the auto-cut
 * builds its cut points from these.
 */
export async function transcribeClip(video: Buffer, version: number): Promise<ClipTranscript> {
  const form = scribeForm();
  form.append("file", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "clip.mp4");
  return toTranscript(await scribe(form), version);
}

/**
 * Word timings for a whole uploaded cut. Scribe fetches it straight from the
 * signed URL (no download through the function); if it can't, the file is
 * sent the same way as a clip.
 */
export async function transcribeUrl(
  url: string,
  fallback: () => Promise<Buffer>,
  /** language null = let Scribe detect it (a reaction video's source can be in any language). */
  opts: { language?: string | null } = {}
): Promise<ClipTranscript> {
  const language = opts.language === undefined ? "en" : opts.language;
  const form = scribeForm(language);
  form.append("cloud_storage_url", url);
  try {
    return toTranscript(await scribe(form), 1);
  } catch (err) {
    console.warn("[creative-studio] Scribe by URL failed, sending the file:", err instanceof Error ? err.message : err);
    const retry = scribeForm(language);
    retry.append("file", new Blob([new Uint8Array(await fallback())], { type: "video/mp4" }), "clip.mp4");
    return toTranscript(await scribe(retry), 1);
  }
}

function scribeForm(language: string | null = "en"): FormData {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  if (language) form.append("language_code", language);
  return form;
}

type ScribeResponse = { text?: string; words?: { text?: string; start?: number; end?: number; type?: string }[] };

async function scribe(form: FormData): Promise<ScribeResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY isn't set, so videos can't be transcribed.");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Speech-to-text failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as ScribeResponse;
}

function toTranscript(data: ScribeResponse, version: number): ClipTranscript {
  const words: TranscriptWord[] = (data.words ?? [])
    .filter((w) => w.type === "word" && typeof w.start === "number" && typeof w.end === "number" && (w.text ?? "").trim())
    .map((w) => ({ text: (w.text ?? "").trim(), start: w.start!, end: Math.max(w.end!, w.start!) }));
  const last = words[words.length - 1];
  return { version, durationS: last ? last.end : 0, words, text: (data.text ?? "").trim() };
}
