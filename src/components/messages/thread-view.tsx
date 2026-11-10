"use client";

import type { ReactNode, RefObject } from "react";
import { ChevronLeft, MessagesSquare, Send } from "lucide-react";
import type { ThreadMessage } from "@/lib/portal-messages-types";
import { MessageBubble } from "./message-bubble";

/**
 * The look of a message thread (no data logic): header with an optional back
 * button (below lg), the bubbles, and the composer. Used by MessageThread
 * (Client Messages, Nexli Team) and the GoHighLevel Messages page. Everything
 * is CSS-var driven, so it renders dark inside the Rainmaker canvas.
 */
export interface ThreadViewProps {
  title: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  /** Shows a back button below lg (single-pane phones/tablets). */
  onBack?: () => void;
  messages: ThreadMessage[];
  mineSide: "cpa" | "client";
  theirLabel?: string;
  loading: boolean;
  loadError: string | null;
  emptyText: string;
  /** The scrolling message list (the owner keeps it pinned to the bottom). */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The composer's text box (the owner grows it as you type). */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Voice-note transcripts: retry a failed one. */
  onRetryTranscript?: (id: string) => void;
  retrying?: Set<string>;
  composer: {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    maxLen: number;
    error: string | null;
    placeholder?: string;
    /** The voice recorder (when it's open the text box hides). */
    recorder?: ReactNode;
    recorderOpen?: boolean;
  };
}

function Skeletons() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
      {["w-2/3", "ml-auto w-1/2", "w-3/5", "ml-auto w-2/5"].map((w, i) => (
        <div key={i} className={`h-12 animate-pulse rounded-2xl bg-white/[0.05] motion-reduce:animate-none ${w}`} />
      ))}
    </div>
  );
}

export function ThreadView({ scrollRef, textareaRef, ...p }: ThreadViewProps) {
  // "Read" goes under the latest message from this side, if it was read.
  let lastMineIdx = -1;
  for (let i = p.messages.length - 1; i >= 0; i--) {
    if (p.messages[i].senderType === p.mineSide) {
      lastMineIdx = i;
      break;
    }
  }
  const c = p.composer;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
        {p.onBack && (
          <button
            type="button"
            onClick={p.onBack}
            aria-label="Back to conversations"
            className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white sm:text-base">{p.title}</div>
          {p.subtitle && <div className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{p.subtitle}</div>}
        </div>
        {p.headerRight}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="cs-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        {p.loading ? (
          <Skeletons />
        ) : p.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
              <MessagesSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className={`mt-3 max-w-sm text-sm ${p.loadError ? "text-rose-300" : "text-neutral-400"}`} role={p.loadError ? "alert" : undefined}>
              {p.loadError ?? p.emptyText}
            </p>
          </div>
        ) : (
          p.messages.map((m, i) => {
            const mine = m.senderType === p.mineSide;
            return (
              <div key={m.id} className={m.id.startsWith("temp-") ? "opacity-70" : undefined}>
                <MessageBubble
                  msg={m}
                  mine={mine}
                  showRead={i === lastMineIdx && m.read}
                  senderLabel={!mine ? p.theirLabel : undefined}
                  onRetry={p.onRetryTranscript && m.audioUrl ? () => p.onRetryTranscript!(m.id) : undefined}
                  retrying={p.retrying?.has(m.id)}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 px-3 pt-3 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {c.error && (
          <p className="mb-2 text-xs text-rose-300" role="alert">
            {c.error}
          </p>
        )}
        <div className="flex items-end gap-2">
          {!c.recorderOpen && (
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                value={c.value}
                onChange={(e) => c.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    c.onSend();
                  }
                }}
                placeholder={c.placeholder ?? "Message…"}
                aria-label="Message"
                rows={1}
                maxLength={c.maxLen}
                enterKeyHint="send"
                className="block w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-[10px] text-[16px] leading-6 text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-cyan-400/60 sm:text-sm"
                style={{ maxHeight: 140 }}
              />
              {c.value.length > c.maxLen - 200 && (
                <span className={`absolute bottom-1 right-3 text-[10px] ${c.value.length > c.maxLen - 50 ? "text-rose-300" : "text-neutral-400"}`}>
                  {c.value.length}/{c.maxLen}
                </span>
              )}
            </div>
          )}
          {c.recorder}
          {!c.recorderOpen && (
            <button
              type="button"
              onClick={c.onSend}
              disabled={!c.value.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
