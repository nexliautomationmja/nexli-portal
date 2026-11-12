import { SAMPLE_MAX, SAMPLE_MIN, VOICE_DESCRIPTION_MAX, VOICE_DESCRIPTION_MIN } from "@/lib/creative-studio/avatar-shared";

/**
 * ElevenLabs Voice Design for AI avatars: a written description of a voice
 * becomes 3 voices (mp3 previews) to pick from, and the chosen one is kept
 * in the ElevenLabs voice library. Raw fetch like the rest of the portal's
 * ElevenLabs calls (ELEVENLABS_API_KEY).
 */

const API = "https://api.elevenlabs.io/v1";

export interface DesignedVoice {
  generatedVoiceId: string;
  audio: Buffer;
  mime: string;
  durationS: number | null;
}

export class VoiceError extends Error {}

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new VoiceError("ElevenLabs isn't set up (ELEVENLABS_API_KEY is missing in Vercel).");
  return k;
}

/** A plain-English reason for an ElevenLabs refusal. */
async function refusal(r: Response, what: string): Promise<VoiceError> {
  const body = (await r.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = body?.detail;
  const d = (Array.isArray(detail) ? detail[0] : detail) as { status?: string; message?: string; msg?: string } | string | undefined;
  const status = typeof d === "object" && d ? d.status ?? "" : "";
  const message = typeof d === "string" ? d : typeof d === "object" && d ? d.message ?? d.msg ?? "" : "";
  if (r.status === 401 && /permission/i.test(`${status} ${message}`)) {
    return new VoiceError(
      `The ElevenLabs API key isn't allowed to ${what}. In ElevenLabs → Developers → API Keys, edit the key and turn on Voice Generation and Voices (write).`
    );
  }
  if (r.status === 401) return new VoiceError("ElevenLabs refused the API key. Check ELEVENLABS_API_KEY in Vercel.");
  if (/quota|credit/i.test(`${status} ${message}`) || r.status === 402) {
    return new VoiceError("ElevenLabs is out of credits for this month. Top up the plan, then try again.");
  }
  if (/voice_limit|voices? limit|maximum number/i.test(`${status} ${message}`)) {
    return new VoiceError("Your ElevenLabs plan has no free voice slots left. Delete an old voice in ElevenLabs → Voices, then try again.");
  }
  if (r.status === 409) return new VoiceError("ElevenLabs is still making the last voices. Wait a few seconds and try again.");
  return new VoiceError(`ElevenLabs couldn't ${what} (${r.status}${message ? `: ${message.slice(0, 160)}` : ""}).`);
}

/** Fit the description and the line to Voice Design's limits. */
export function designInput(description: string, sample: string): { description: string; sample: string } {
  const d = description.replace(/\s+/g, " ").trim().slice(0, VOICE_DESCRIPTION_MAX);
  let s = sample.replace(/\s+/g, " ").trim().slice(0, SAMPLE_MAX);
  if (d.length < VOICE_DESCRIPTION_MIN) throw new VoiceError("Describe the voice in a sentence or two first.");
  // Too short for ElevenLabs: say it twice rather than fail.
  if (s.length < SAMPLE_MIN) s = `${s} ${s}`.slice(0, SAMPLE_MAX);
  if (s.length < SAMPLE_MIN) throw new VoiceError(`The sample line needs at least ${SAMPLE_MIN} characters.`);
  return { description: d, sample: s };
}

/** Three voices from one description, each saying `sample`. */
export async function designVoices(description: string, sample: string): Promise<DesignedVoice[]> {
  const input = designInput(description, sample);
  const r = await fetch(`${API}/text-to-voice/design?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({ voice_description: input.description, text: input.sample, auto_generate_text: false }),
  }).catch(() => null);
  if (!r) throw new VoiceError("Couldn't reach ElevenLabs. Try again.");
  if (!r.ok) throw await refusal(r, "design voices");
  const body = (await r.json().catch(() => null)) as { previews?: unknown[] } | null;
  return parsePreviews(body);
}

/** The previews in a Voice Design response (tolerant of missing fields). */
export function parsePreviews(body: { previews?: unknown[] } | null): DesignedVoice[] {
  const voices: DesignedVoice[] = [];
  for (const p of body?.previews ?? []) {
    const x = p as { audio_base_64?: unknown; generated_voice_id?: unknown; media_type?: unknown; duration_secs?: unknown };
    if (typeof x.audio_base_64 !== "string" || typeof x.generated_voice_id !== "string" || !x.audio_base_64) continue;
    voices.push({
      generatedVoiceId: x.generated_voice_id,
      audio: Buffer.from(x.audio_base_64, "base64"),
      mime: typeof x.media_type === "string" && x.media_type.startsWith("audio/") ? x.media_type : "audio/mpeg",
      durationS: typeof x.duration_secs === "number" && Number.isFinite(x.duration_secs) ? Math.round(x.duration_secs * 10) / 10 : null,
    });
  }
  if (voices.length === 0) throw new VoiceError("ElevenLabs didn't send any voices back. Try again.");
  return voices;
}

/** Keep the chosen voice in the ElevenLabs voice library; returns its voice id. */
export async function saveVoice(name: string, description: string, generatedVoiceId: string, labels?: Record<string, string>): Promise<string> {
  const r = await fetch(`${API}/text-to-voice`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_name: name.slice(0, 100),
      voice_description: description.slice(0, VOICE_DESCRIPTION_MAX),
      generated_voice_id: generatedVoiceId,
      ...(labels ? { labels } : {}),
    }),
  }).catch(() => null);
  if (!r) throw new VoiceError("Couldn't reach ElevenLabs. Try again.");
  if (!r.ok) throw await refusal(r, "keep the voice");
  const body = (await r.json().catch(() => null)) as { voice_id?: unknown } | null;
  if (typeof body?.voice_id !== "string" || !body.voice_id) throw new VoiceError("ElevenLabs didn't return the saved voice.");
  return body.voice_id;
}
