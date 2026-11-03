"use client";

/**
 * Big videos never leave the browser whole: the storage upload limit
 * (Supabase → Storage → Settings, 100 MB since Nov 3 2026) would refuse them. What the copy needs is what
 * she says and what's on screen, so the browser grabs 6 stills (canvas →
 * JPEG) and the soundtrack (decoded, mono 16 kHz WAV — about 2 MB a minute)
 * and only those are uploaded.
 */

/** Videos above this are prepared in the browser instead of uploaded whole (just under the 100 MB storage limit). */
export const WHOLE_UPLOAD_LIMIT = 99_000_000;

const FRAMES = 6;
const FRAME_WIDTH = 768;

function once(el: HTMLMediaElement, event: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      el.removeEventListener(event, ok);
      reject(new Error(`The video didn't load (${event})`));
    }, timeoutMs);
    const ok = () => {
      clearTimeout(t);
      el.removeEventListener(event, ok);
      resolve();
    };
    el.addEventListener(event, ok);
  });
}

/** 6 stills at even points through the video, 768 px wide JPEGs. */
async function grabFrames(file: File): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await once(v, "loadeddata", 30_000);
    const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const scale = FRAME_WIDTH / (v.videoWidth || FRAME_WIDTH);
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round((v.videoHeight || FRAME_WIDTH) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't read video frames");
    const out: Blob[] = [];
    for (let i = 0; i < FRAMES; i++) {
      v.currentTime = (duration * (i + 0.5)) / FRAMES;
      await once(v, "seeked");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (blob) out.push(blob);
    }
    if (!out.length) throw new Error("Couldn't grab stills from this video");
    return out;
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** PCM16 WAV from mono samples. */
function wav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const d = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  d.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, rate, true);
  d.setUint32(28, rate * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  str(36, "data");
  d.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    d.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** The soundtrack as mono 16 kHz WAV, or null if the browser can't decode it. */
async function grabAudio(file: File): Promise<Blob | null> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    void ctx.close();
    const rate = 16_000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const mono = await off.startRendering();
    return wav(mono.getChannelData(0), rate);
  } catch (err) {
    console.warn("[ad copy] couldn't read the audio in the browser:", err);
    return null;
  }
}

export async function prepareVideo(file: File): Promise<{ frames: Blob[]; audio: Blob | null }> {
  const [frames, audio] = await Promise.all([grabFrames(file), grabAudio(file)]);
  return { frames, audio };
}
