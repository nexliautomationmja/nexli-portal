"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SendIcon } from "@/components/ui/icons";
import type { ThreadMessage } from "@/lib/portal-messages-types";
import { MessageBubble } from "@/components/messages/message-bubble";
import { VoiceRecorder } from "@/components/messages/voice-recorder";
import { voiceFormData } from "@/components/messages/message-thread";

const SLOW_POLL_MS = 20_000;
const FAST_POLL_MS = 4_000;
const FAST_POLL_WINDOW_MS = 60_000;

export function PortalMessagesClient() {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSinceRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async (): Promise<ThreadMessage[] | null> => {
    try {
      const res = await fetch("/api/portal/messages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const list: ThreadMessage[] = Array.isArray(data.messages) ? data.messages : [];
        setMessages(list);
        return list;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  // Poll every 20s; every 4s (for up to 60s) while a transcript is pending.
  const schedule = useCallback(
    (list: ThreadMessage[] | null) => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      let delay = SLOW_POLL_MS;
      if (list?.some((m) => m.transcriptStatus === "pending")) {
        if (pendingSinceRef.current == null) pendingSinceRef.current = Date.now();
        if (Date.now() - pendingSinceRef.current < FAST_POLL_WINDOW_MS) delay = FAST_POLL_MS;
      } else if (list) {
        pendingSinceRef.current = null;
      }
      pollTimerRef.current = setTimeout(async () => {
        const next = await fetchMessages();
        schedule(next);
      }, delay);
    },
    [fetchMessages]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchMessages().then((list) => {
      if (!cancelled) schedule(list);
    });
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchMessages, schedule]);

  // Scroll to bottom when a new message arrives
  const lastId = messages.length ? messages[messages.length - 1].id : "";
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, loading]);

  function autoGrow() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setInput("");
        requestAnimationFrame(autoGrow);
        schedule(await fetchMessages());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Message not sent. Please try again.");
      }
    } catch {
      setError("Message not sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function sendVoice(blob: Blob, mime: string, durationMs: number) {
    setError(null);
    const res = await fetch("/api/portal/messages/voice", {
      method: "POST",
      body: voiceFormData(blob, mime, durationMs),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Voice note not sent. Please try again.");
    }
    pendingSinceRef.current = null;
    schedule(await fetchMessages());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading messages...</p>
        </div>
      </div>
    );
  }

  let lastMineIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderType === "client") {
      lastMineIdx = i;
      break;
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-100px)] md:h-[calc(100dvh-60px)]">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Send messages or voice notes to your CPA.
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain glass-card p-4 space-y-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center" style={{ color: "var(--text-muted)" }}>
              <SendIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                No messages yet
              </p>
              <p className="text-xs mt-1">Type a message or record a voice note for your CPA below.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              mine={msg.senderType === "client"}
              senderLabel={msg.senderType === "cpa" ? "Your CPA" : "You"}
              showRead={i === lastMineIdx && msg.read}
            />
          ))
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="mt-3 glass-card p-3 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <p className="text-xs text-rose-400 mb-2" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          {!recorderOpen && (
            <div className="flex-1 relative min-w-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                maxLength={2000}
                enterKeyHint="send"
                className="block w-full resize-none rounded-xl px-4 py-2.5 text-base md:text-sm outline-none"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-main)",
                  maxHeight: "120px",
                }}
              />
              {input.length > 1800 && (
                <span
                  className="absolute bottom-1 right-2 text-[10px]"
                  style={{ color: input.length > 1950 ? "#EF4444" : "var(--text-muted)" }}
                >
                  {input.length}/2000
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
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <SendIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
