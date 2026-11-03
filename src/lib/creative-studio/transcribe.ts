import type { ClipTranscript, TranscriptWord } from "@/lib/creative-studio/tables";

/**
 * Word-level speech-to-text for a rendered clip, via ElevenLabs Scribe (the
 * same service the portal uses for voice-note transcripts). Scribe takes the
 * mp4 directly and returns each word with start/end seconds — the auto-cut
 * builds its cut points from these.
 */
export async function transcribeClip(video: Buffer, version: number): Promise<ClipTranscript> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY isn't set, so clips can't be transcribed for the auto-cut.");
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("language_code", "en");
  form.append("file", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "clip.mp4");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Speech-to-text failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    text?: string;
    words?: { text?: string; start?: number; end?: number; type?: string }[];
  };
  const words: TranscriptWord[] = (data.words ?? [])
    .filter((w) => w.type === "word" && typeof w.start === "number" && typeof w.end === "number" && (w.text ?? "").trim())
    .map((w) => ({ text: (w.text ?? "").trim(), start: w.start!, end: Math.max(w.end!, w.start!) }));
  const last = words[words.length - 1];
  return { version, durationS: last ? last.end : 0, words, text: (data.text ?? "").trim() };
}
