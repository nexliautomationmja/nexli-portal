"use client";

import { VOICE_MESSAGE_PLACEHOLDER, type ThreadMessage } from "@/lib/portal-messages-types";
import { VoicePlayer } from "./voice-player";

export function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

/** Transcript line under a voice note: text, "Transcribing…", or failure + Retry. */
function Transcript({
  msg,
  mine,
  onRetry,
  retrying,
}: {
  msg: ThreadMessage;
  mine: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const muted = mine ? "rgba(255,255,255,0.75)" : "var(--text-muted)";
  const text = msg.transcript?.trim() || "";
  if (msg.transcriptStatus === "pending" || retrying) {
    return (
      <p className="mt-2 text-xs flex items-center gap-1.5" style={{ color: muted }}>
        <Spinner /> Transcribing…
      </p>
    );
  }
  if (msg.transcriptStatus === "failed" && !text) {
    return (
      <p className="mt-2 text-xs flex items-center gap-2 flex-wrap" style={{ color: muted }}>
        <span>Transcript unavailable</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline font-semibold min-h-[28px]"
            style={{ color: mine ? "#fff" : "#06B6D4" }}
          >
            Retry
          </button>
        )}
      </p>
    );
  }
  if (!text) return null;
  return (
    <p
      className="mt-2 text-[13px] leading-snug whitespace-pre-wrap break-words"
      style={{ color: mine ? "rgba(255,255,255,0.92)" : "var(--text-main)" }}
    >
      {text}
    </p>
  );
}

/**
 * One message in an iMessage-style thread. Text, voice note (player +
 * automatic transcript) or a weekly-update card. `mine` puts it on the right
 * in the brand gradient.
 */
export function MessageBubble({
  msg,
  mine,
  showRead = false,
  onRetry,
  retrying = false,
  senderLabel,
}: {
  msg: ThreadMessage;
  mine: boolean;
  /** Show "Read" under the bubble (latest own message that was read). */
  showRead?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  /** Optional sender prefix in the timestamp line, e.g. "Your CPA". */
  senderLabel?: string;
}) {
  const time = formatMessageTime(msg.createdAt);
  const meta = senderLabel ? `${senderLabel} · ${time}` : time;
  const align = mine ? "items-end" : "items-start";

  if (msg.kind === "weekly_update") {
    const rawBody = msg.message?.trim() === VOICE_MESSAGE_PLACEHOLDER ? "" : msg.message?.trim() || "";
    const body = (rawBody || msg.transcript?.trim() || "").trim();
    const headline = msg.weeklyUpdate?.headline?.trim() || null;
    const ad = msg.weeklyUpdate?.adSpendCents ?? null;
    const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return (
      <div className={`flex flex-col ${align}`}>
        <div
          className="w-full max-w-[min(92%,520px)] rounded-2xl p-4 border"
          style={{
            borderColor: "rgba(6,182,212,0.35)",
            background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(6,182,212,0.08))",
            color: "var(--text-main)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: "var(--text-muted)" }}>
            <span aria-hidden="true">📬</span> Weekly update
          </p>
          {headline && <p className="text-[15px] font-bold leading-snug mb-1.5">{headline}</p>}
          {msg.audioUrl && (
            <div className="my-2">
              <VoicePlayer src={msg.audioUrl} durationMs={msg.audioDurationMs} tone="theirs" />
            </div>
          )}
          {msg.audioUrl && !body ? (
            <Transcript msg={msg} mine={false} onRetry={onRetry} retrying={retrying} />
          ) : (
            <div className="space-y-2">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {p}
                </p>
              ))}
            </div>
          )}
          {msg.audioUrl && body && msg.transcriptStatus === "pending" && (
            <Transcript msg={msg} mine={false} />
          )}
          {ad != null && ad > 0 && (
            <p
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs"
              style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}
            >
              <span aria-hidden="true">📣</span>
              <span>
                Ad budget deployed this week: <span className="font-bold">{money(ad)}</span>
              </span>
            </p>
          )}
        </div>
        <p className="text-[10px] mt-1 px-1" style={{ color: "var(--text-muted)" }}>
          {meta}
          {showRead && mine ? " · Read" : ""}
        </p>
      </div>
    );
  }

  const bubbleCls = mine
    ? "rounded-2xl rounded-br-md text-white"
    : "rounded-2xl rounded-bl-md border border-[var(--card-border)] bg-[var(--glass-bg)]";
  const bubbleStyle = mine
    ? { background: "linear-gradient(135deg, #2563EB, #06B6D4)" }
    : { color: "var(--text-main)" };

  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 ${bubbleCls}`} style={bubbleStyle}>
        {msg.kind === "voice" ? (
          <>
            {msg.audioUrl ? (
              <VoicePlayer src={msg.audioUrl} durationMs={msg.audioDurationMs} tone={mine ? "mine" : "theirs"} />
            ) : (
              <p className="text-sm italic opacity-80">Voice note</p>
            )}
            <Transcript msg={msg} mine={mine} onRetry={onRetry} retrying={retrying} />
          </>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
        )}
      </div>
      <p className="text-[10px] mt-1 px-1" style={{ color: "var(--text-muted)" }}>
        {meta}
        {showRead && mine ? " · Read" : ""}
      </p>
    </div>
  );
}
