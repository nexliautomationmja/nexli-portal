"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SendIcon } from "@/components/ui/icons";
import type { ThreadMessage } from "@/lib/portal-messages-types";
import { MessageBubble } from "./message-bubble";
import { VoiceRecorder } from "./voice-recorder";

const MAX_LEN = 2000;
const SLOW_POLL_MS = 20_000;
const FAST_POLL_MS = 4_000;
const FAST_POLL_WINDOW_MS = 60_000;

/** File extension for an uploaded recording, from its MIME type. */
export function audioExtension(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "webm";
}

/** Multipart body for the `.../voice` routes. */
export function voiceFormData(blob: Blob, mime: string, durationMs: number): FormData {
  const fd = new FormData();
  const type = mime || blob.type || "audio/webm";
  const file = new File([blob], `voice-note.${audioExtension(type)}`, { type });
  fd.append("file", file);
  fd.append("durationMs", String(Math.round(durationMs)));
  return fd;
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

function isPending(messages: ThreadMessage[]): boolean {
  return messages.some((m) => m.transcriptStatus === "pending");
}

/**
 * iMessage-style thread between Nexli/a firm and one client. Loads and polls
 * `fetchUrl` (faster while a transcript is pending), sends text optimistically
 * to `postUrl` and voice notes to `voiceUrl`. Fills its parent's height —
 * give the parent an explicit (100dvh-aware) height. Remount with a `key`
 * to switch threads.
 */
export function MessageThread({
  fetchUrl,
  postUrl,
  voiceUrl,
  retryUrl,
  mineSide,
  title,
  subtitle,
  emptyText,
  headerRight,
  theirLabel,
  onActivity,
  className = "",
}: {
  fetchUrl: string;
  postUrl: string;
  voiceUrl: string;
  /** When set, failed transcripts get a Retry button posting `{ messageId }` here. */
  retryUrl?: string;
  mineSide: "cpa" | "client";
  title: ReactNode;
  subtitle?: ReactNode;
  emptyText: string;
  headerRight?: ReactNode;
  /** Prefix for the other side's timestamps, e.g. "Nexli Team". */
  theirLabel?: string;
  /** Called after this side sends something or the thread is (re)loaded. */
  onActivity?: () => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [retrying, setRetrying] = useState<Set<string>>(() => new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSinceRef = useRef<number | null>(null);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  // Merge server messages with any optimistic ones still in flight.
  const applyServer = useCallback((server: ThreadMessage[]) => {
    setMessages((prev) => {
      const temps = prev.filter((m) => m.id.startsWith("temp-"));
      return temps.length ? [...server, ...temps] : server;
    });
  }, []);

  const load = useCallback(async (): Promise<ThreadMessage[] | null> => {
    try {
      const res = await fetch(fetchUrl, { cache: "no-store" });
      if (!res.ok) {
        setLoadError(await errorText(res, "Couldn't load messages."));
        return null;
      }
      const data = await res.json();
      const list: ThreadMessage[] = Array.isArray(data.messages) ? data.messages : [];
      setLoadError(null);
      applyServer(list);
      return list;
    } catch {
      setLoadError("Couldn't load messages. Check your connection.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, applyServer]);

  // Initial load + adaptive polling (4s while a transcript is pending, for up
  // to 60s; otherwise 20s).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    pendingSinceRef.current = null;

    const run = async (first: boolean) => {
      const list = await load();
      if (cancelled) return;
      if (first) onActivityRef.current?.();
      let delay = SLOW_POLL_MS;
      if (list && isPending(list)) {
        if (pendingSinceRef.current == null) pendingSinceRef.current = Date.now();
        if (Date.now() - pendingSinceRef.current < FAST_POLL_WINDOW_MS) delay = FAST_POLL_MS;
      } else if (list) {
        pendingSinceRef.current = null;
      }
      timer = setTimeout(() => void run(false), delay);
    };
    void run(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  // A just-sent voice note starts its own fast-poll window.
  const kickFastPoll = useCallback(() => {
    pendingSinceRef.current = Date.now();
    let n = 0;
    const tick = async () => {
      n += 1;
      const list = await load();
      if (list && isPending(list) && n < FAST_POLL_WINDOW_MS / FAST_POLL_MS) {
        setTimeout(() => void tick(), FAST_POLL_MS);
      }
    };
    setTimeout(() => void tick(), FAST_POLL_MS);
  }, [load]);

  // Stick to the bottom when a new message arrives.
  const lastId = messages.length ? messages[messages.length - 1].id : "";
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, loading]);

  function autoGrow() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }

  async function sendText() {
    const text = input.trim();
    if (!text) return;
    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ThreadMessage = {
      id: tempId,
      senderType: mineSide,
      kind: "text",
      message: text,
      transcript: null,
      transcriptStatus: null,
      audioUrl: null,
      audioDurationMs: null,
      weeklyUpdate: null,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    requestAnimationFrame(autoGrow);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await errorText(res, "Message not sent. Please try again."));
      const data = await res.json().catch(() => ({}));
      const saved = data.message as ThreadMessage | undefined;
      setMessages((prev) =>
        saved && saved.id ? prev.map((m) => (m.id === tempId ? saved : m)) : prev.filter((m) => m.id !== tempId)
      );
      if (!saved?.id) void load();
      onActivityRef.current?.();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput((cur) => cur || text);
      setSendError(err instanceof Error ? err.message : "Message not sent. Please try again.");
    }
  }

  async function sendVoice(blob: Blob, mime: string, durationMs: number) {
    setSendError(null);
    const res = await fetch(voiceUrl, { method: "POST", body: voiceFormData(blob, mime, durationMs) });
    if (!res.ok) throw new Error(await errorText(res, "Voice note not sent. Please try again."));
    const data = await res.json().catch(() => ({}));
    const saved = data.message as ThreadMessage | undefined;
    if (saved?.id) {
      setMessages((prev) => [...prev.filter((m) => m.id !== saved.id), saved]);
    } else {
      void load();
    }
    if (!saved || saved.transcriptStatus === "pending") kickFastPoll();
    onActivityRef.current?.();
  }

  async function retryTranscript(messageId: string) {
    if (!retryUrl) return;
    setRetrying((s) => new Set(s).add(messageId));
    try {
      const res = await fetch(retryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const saved = data.message as ThreadMessage | undefined;
        if (saved?.id) setMessages((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        if (saved?.transcriptStatus === "pending") kickFastPoll();
      } else {
        setSendError(await errorText(res, "Transcript retry failed."));
      }
    } catch {
      setSendError("Transcript retry failed.");
    } finally {
      setRetrying((s) => {
        const next = new Set(s);
        next.delete(messageId);
        return next;
      });
    }
  }

  // "Read" goes under the latest message from this side, if it was read.
  let lastMineIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderType === mineSide) {
      lastMineIdx = i;
      break;
    }
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* Header */}
      <div className="px-4 md:px-5 py-3 border-b border-[var(--card-border)] flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-semibold truncate" style={{ color: "var(--text-main)" }}>
            {title}
          </div>
          {subtitle && (
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>
        {headerRight}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 md:px-5 py-4 space-y-3 no-scrollbar"
      >
        {loading ? (
          <div className="py-10 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-sm" style={{ color: loadError ? "#f43f5e" : "var(--text-muted)" }}>
              {loadError ?? emptyText}
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderType === mineSide;
            return (
              <div key={m.id} className={m.id.startsWith("temp-") ? "opacity-70" : undefined}>
                <MessageBubble
                  msg={m}
                  mine={mine}
                  showRead={i === lastMineIdx && m.read}
                  senderLabel={!mine ? theirLabel : undefined}
                  onRetry={retryUrl && m.audioUrl ? () => void retryTranscript(m.id) : undefined}
                  retrying={retrying.has(m.id)}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div
        className="shrink-0 border-t border-[var(--card-border)] px-3 md:px-4 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {sendError && (
          <p className="text-xs text-rose-400 mb-2" role="alert">
            {sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          {!recorderOpen && (
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.slice(0, MAX_LEN));
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void sendText();
                  }
                }}
                placeholder="Message…"
                rows={1}
                maxLength={MAX_LEN}
                enterKeyHint="send"
                className="block w-full resize-none rounded-2xl px-4 py-[10px] text-base md:text-sm leading-6 outline-none border border-[var(--card-border)] bg-[var(--input-bg)] focus:border-cyan-400 transition-colors"
                style={{ color: "var(--text-main)", maxHeight: 140 }}
              />
              {input.length > MAX_LEN - 200 && (
                <span
                  className="absolute bottom-1 right-3 text-[10px]"
                  style={{ color: input.length > MAX_LEN - 50 ? "#EF4444" : "var(--text-muted)" }}
                >
                  {input.length}/{MAX_LEN}
                </span>
              )}
            </div>
          )}
          <VoiceRecorder
            onSend={sendVoice}
            onActiveChange={setRecorderOpen}
            className={recorderOpen ? "flex-1" : ""}
          />
          {!recorderOpen && (
            <button
              type="button"
              onClick={() => void sendText()}
              disabled={!input.trim()}
              aria-label="Send message"
              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              <SendIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
