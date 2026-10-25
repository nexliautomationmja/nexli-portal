"use client";

import { useEffect, useMemo, useState } from "react";
import { formatClock, useVoiceRecorder } from "./use-voice-recorder";
import { VoicePlayer } from "./voice-player";
import { MAX_VOICE_BYTES } from "@/lib/portal-messages-types";

export function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

function StopGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

const BARS = 18;

/** Live level bars: a rolling history of the input level. */
function LevelBars({ level }: { level: number }) {
  const [history, setHistory] = useState<number[]>(() => Array(BARS).fill(0));
  const [prevLevel, setPrevLevel] = useState(level);
  if (level !== prevLevel) {
    setPrevLevel(level);
    setHistory((h) => [...h.slice(1), level]);
  }
  return (
    <div className="flex items-center gap-[3px] h-6 flex-1 min-w-0 overflow-hidden" aria-hidden="true">
      {history.map((v, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full shrink-0 transition-[height] duration-75"
          style={{ height: `${Math.max(12, Math.round(v * 100))}%`, background: "#ef4444", opacity: 0.45 + v * 0.55 }}
        />
      ))}
    </div>
  );
}

/**
 * Voice-note recorder: a mic button that expands into a recording bar
 * (pulsing dot, timer, level meter, Cancel / Stop), then a preview with
 * playback, Re-record and Send. `onActiveChange` lets a composer hide its
 * text input while the recorder is open.
 */
export function VoiceRecorder({
  onSend,
  disabled = false,
  maxMs = 600_000,
  onActiveChange,
  sendLabel = "Send",
  idleLabel,
  className = "",
}: {
  onSend: (blob: Blob, mime: string, durationMs: number) => Promise<void>;
  disabled?: boolean;
  maxMs?: number;
  onActiveChange?: (active: boolean) => void;
  sendLabel?: string;
  /** When set, the idle state is a labelled pill ("Start recording") instead of a bare mic. */
  idleLabel?: string;
  className?: string;
}) {
  const rec = useVoiceRecorder({ maxMs });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const active = rec.state !== "idle";
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const previewUrl = useMemo(() => (rec.blob ? URL.createObjectURL(rec.blob) : null), [rec.blob]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function send() {
    if (!rec.blob || sending) return;
    if (rec.blob.size > MAX_VOICE_BYTES) {
      setSendError("That recording is too large to send. Record a shorter note.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSend(rec.blob, rec.mime, rec.durationMs);
      rec.reset();
    } catch (err) {
      setSendError(err instanceof Error && err.message ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const barCls =
    "flex-1 min-w-0 flex items-center gap-2 rounded-xl px-2 py-1.5 border border-[var(--card-border)] bg-[var(--input-bg)]";
  const ghostBtn =
    "min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--glass-bg)] disabled:opacity-50";

  if (rec.state === "idle" && idleLabel) {
    return (
      <button
        type="button"
        onClick={() => {
          setSendError(null);
          void rec.start();
        }}
        disabled={disabled}
        className={`min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold border border-[var(--card-border)] bg-[var(--input-bg)] transition-colors hover:border-cyan-400 disabled:opacity-40 ${className}`}
        style={{ color: "var(--text-main)" }}
      >
        <MicIcon className="w-5 h-5 text-red-500" />
        {idleLabel}
      </button>
    );
  }

  if (rec.state === "idle") {
    return (
      <button
        type="button"
        onClick={() => {
          setSendError(null);
          void rec.start();
        }}
        disabled={disabled}
        aria-label="Record a voice note"
        title="Record a voice note"
        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center border border-[var(--card-border)] bg-[var(--input-bg)] transition-colors hover:border-cyan-400 disabled:opacity-40 ${className}`}
        style={{ color: "var(--text-main)" }}
      >
        <MicIcon className="w-5 h-5" />
      </button>
    );
  }

  if (rec.state === "error") {
    return (
      <div className={`${barCls} ${className}`} role="alert">
        <MicIcon className="w-5 h-5 shrink-0 ml-1 text-rose-400" />
        <p className="flex-1 min-w-0 text-xs" style={{ color: "var(--text-main)" }}>
          {rec.error}
        </p>
        <button type="button" onClick={rec.reset} className={ghostBtn} style={{ color: "var(--text-muted)" }}>
          Dismiss
        </button>
        <button type="button" onClick={() => void rec.start()} className={`${ghostBtn} text-cyan-500`}>
          Try again
        </button>
      </div>
    );
  }

  if (rec.state === "requesting" || rec.state === "recording") {
    const nearMax = rec.elapsedMs > maxMs - 30_000;
    return (
      <div className={`${barCls} ${className}`}>
        <span className="relative flex w-3 h-3 shrink-0 ml-2" aria-hidden="true">
          {rec.state === "recording" && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
          )}
          <span className="relative inline-flex w-3 h-3 rounded-full bg-red-500" />
        </span>
        <span
          className="text-sm font-semibold tabular-nums shrink-0 w-12"
          style={{ color: nearMax ? "#ef4444" : "var(--text-main)" }}
          aria-live="off"
        >
          {rec.state === "requesting" ? "…" : formatClock(rec.elapsedMs)}
        </span>
        {rec.state === "recording" ? (
          <LevelBars level={rec.level} />
        ) : (
          <span className="flex-1 min-w-0 text-xs truncate" style={{ color: "var(--text-muted)" }}>
            Waiting for microphone…
          </span>
        )}
        <button type="button" onClick={rec.cancel} className={ghostBtn} style={{ color: "var(--text-muted)" }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={rec.stop}
          disabled={rec.state !== "recording"}
          aria-label="Stop recording"
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-red-500 text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          <StopGlyph className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // recorded → preview
  return (
    <div className={`${barCls} flex-wrap sm:flex-nowrap ${className}`}>
      {previewUrl && (
        <VoicePlayer src={previewUrl} durationMs={rec.durationMs} tone="theirs" className="flex-1 min-w-[180px]" />
      )}
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {sendError && (
          <span className="text-[11px] text-rose-400 max-w-[140px] leading-tight">{sendError}</span>
        )}
        <button
          type="button"
          onClick={() => {
            rec.reset();
            void rec.start();
          }}
          disabled={sending}
          className={ghostBtn}
          style={{ color: "var(--text-muted)" }}
        >
          Re-record
        </button>
        <button
          type="button"
          onClick={rec.reset}
          disabled={sending}
          aria-label="Discard recording"
          className={ghostBtn}
          style={{ color: "var(--text-muted)" }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending || disabled}
          className="min-h-[44px] px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {sending && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {sending ? "Sending…" : sendLabel}
        </button>
      </div>
    </div>
  );
}
