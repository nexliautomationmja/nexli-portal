"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceRecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";

export interface UseVoiceRecorder {
  state: VoiceRecorderState;
  /** Milliseconds recorded so far (live while recording). */
  elapsedMs: number;
  /** Live input level 0–1 from an AnalyserNode (0 when not recording). */
  level: number;
  blob: Blob | null;
  mime: string;
  durationMs: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  reset: () => void;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // keep looking
    }
  }
  return "";
}

function friendlyError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Allow microphone access in your browser settings to record";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No microphone found. Plug one in or try another device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone is being used by another app. Close it and try again.";
    default:
      return "Couldn't start recording. Please try again.";
  }
}

type AudioContextCtor = typeof AudioContext;

/**
 * Microphone recorder for voice notes. Picks the best container the browser
 * can produce (webm/opus on Chrome/Firefox, mp4 on Safari), exposes a live
 * level meter, and always releases the mic on stop/cancel/unmount.
 */
export function useVoiceRecorder({ maxMs = 600_000 }: { maxMs?: number } = {}): UseVoiceRecorder {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const maxMsRef = useRef(maxMs);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    maxMsRef.current = maxMs;
  }, [maxMs]);

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
    teardown();
    if (mountedRef.current) setLevel(0);
  }, [teardown]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    setError(null);
    setBlob(null);
    setElapsedMs(0);
    setDurationMs(0);

    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Voice notes aren't supported in this browser. Try the latest Chrome or Safari.");
      setState("error");
      return;
    }

    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(friendlyError(err));
      setState("error");
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const chosen = pickMime();
    let rec: MediaRecorder;
    try {
      // ~32 kbps keeps a 10-minute note well under the 4 MB upload cap.
      const opts: MediaRecorderOptions = { audioBitsPerSecond: 32_000 };
      if (chosen) opts.mimeType = chosen;
      try {
        rec = new MediaRecorder(stream, opts);
      } catch {
        rec = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream);
      }
    } catch {
      teardown();
      setError("Voice notes aren't supported in this browser. Try the latest Chrome or Safari.");
      setState("error");
      return;
    }
    recorderRef.current = rec;
    chunksRef.current = [];
    cancelledRef.current = false;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const duration = Date.now() - startedAtRef.current;
      recorderRef.current = null;
      if (!mountedRef.current) return;
      if (cancelledRef.current) {
        chunksRef.current = [];
        return;
      }
      const type = (rec.mimeType || chosen || "audio/webm").trim();
      const out = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (out.size === 0) {
        setError("Nothing was recorded. Please try again.");
        setState("error");
        return;
      }
      setBlob(out);
      setMime(type);
      setDurationMs(duration);
      setElapsedMs(duration);
      setState("recorded");
    };

    // Live level meter. Failure here is cosmetic, never fatal.
    let analyser: AnalyserNode | null = null;
    try {
      const Ctor: AudioContextCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
      }
    } catch {
      analyser = null;
    }

    try {
      rec.start(1000);
    } catch {
      teardown();
      setError("Couldn't start recording. Please try again.");
      setState("error");
      return;
    }
    startedAtRef.current = Date.now();
    setState("recording");

    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
    let lastUi = 0;
    const tick = () => {
      const now = Date.now();
      const elapsed = now - startedAtRef.current;
      if (elapsed >= maxMsRef.current) {
        stopRef.current();
        return;
      }
      if (now - lastUi > 80) {
        lastUi = now;
        setElapsedMs(elapsed);
        if (analyser && buf) {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 4));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [teardown]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
    chunksRef.current = [];
    setBlob(null);
    setElapsedMs(0);
    setDurationMs(0);
    setError(null);
    setState("idle");
  }, [stop]);

  const reset = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      cancelledRef.current = true;
      stop();
    }
    setBlob(null);
    setElapsedMs(0);
    setDurationMs(0);
    setError(null);
    setLevel(0);
    setState("idle");
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      teardown();
    };
  }, [teardown]);

  return { state, elapsedMs, level, blob, mime, durationMs, error, start, stop, cancel, reset };
}

/** mm:ss for a millisecond count. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
