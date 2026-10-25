"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageIcon } from "@/components/ui/icons";
import { MessageThread } from "@/components/messages/message-thread";

interface Conversation {
  clientEmail: string;
  lastMessage: string;
  lastKind?: "text" | "voice" | "weekly_update";
  lastMessageAt: string;
  unreadCount: number;
}

function timeAgo(dateStr: string | undefined) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function previewText(convo: Conversation): string {
  const text = (convo.lastMessage || "").replace(/^🎙\s*/u, "").trim();
  if (convo.lastKind === "voice") return `🎙 ${text || "Voice message"}`;
  if (convo.lastKind === "weekly_update") return `📬 ${text || "Weekly update"}`;
  return convo.lastMessage;
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function PortalMessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientParam = searchParams.get("client");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(clientParam);
  const [loadingConvos, setLoadingConvos] = useState(true);

  // Follow ?client= when it changes while the page is mounted (deep links
  // from Clients / Client Tracker).
  const [prevParam, setPrevParam] = useState(clientParam);
  if (clientParam !== prevParam) {
    setPrevParam(clientParam);
    if (clientParam) setSelectedEmail(clientParam);
  }

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/portal-messages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  function select(email: string | null) {
    setSelectedEmail(email);
    const qs = email ? `?client=${encodeURIComponent(email)}` : "";
    router.replace(`/dashboard/portal-messages${qs}`, { scroll: false });
  }

  const base = selectedEmail
    ? `/api/dashboard/portal-messages/${encodeURIComponent(selectedEmail)}`
    : "";

  // A deep-linked client with no messages yet still gets a row.
  const listed =
    selectedEmail && !conversations.some((c) => c.clientEmail === selectedEmail) && !loadingConvos
      ? [
          { clientEmail: selectedEmail, lastMessage: "New conversation", lastMessageAt: "", unreadCount: 0 },
          ...conversations,
        ]
      : conversations;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className={selectedEmail ? "hidden md:block" : undefined}>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Client Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Text and voice notes with your clients
        </p>
      </div>

      {/* Split layout */}
      <div
        className={`glass-card overflow-hidden ${
          selectedEmail ? "h-[calc(100dvh-96px)]" : "h-[calc(100dvh-180px)]"
        } md:h-[calc(100dvh-150px)]`}
      >
        <div className="flex h-full">
          {/* Conversation List (left panel) */}
          <div
            className={`w-full md:w-80 border-r border-[var(--glass-border)] flex-col ${
              selectedEmail ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-4 border-b border-[var(--glass-border)]">
              <p className="section-header mb-0">Clients ({conversations.length})</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {loadingConvos ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : listed.length === 0 ? (
                <div className="empty-state py-12">
                  <MessageIcon className="empty-state-icon" />
                  <p className="text-xs">No client messages yet</p>
                </div>
              ) : (
                listed.map((convo) => (
                  <button
                    key={convo.clientEmail}
                    onClick={() => select(convo.clientEmail)}
                    className={`w-full text-left px-4 py-3.5 border-b border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors ${
                      selectedEmail === convo.clientEmail ? "bg-blue-500/10 border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                        {convo.clientEmail}
                      </p>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {convo.unreadCount > 0 && (
                          <span
                            className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                          >
                            {convo.unreadCount}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {previewText(convo)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Thread (right panel) */}
          <div className={`flex-1 min-w-0 flex-col ${selectedEmail ? "flex" : "hidden md:flex"}`}>
            {!selectedEmail ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                <div className="empty-state">
                  <MessageIcon className="empty-state-icon" />
                  <p className="text-sm">Select a conversation</p>
                </div>
              </div>
            ) : (
              <MessageThread
                key={selectedEmail}
                fetchUrl={base}
                postUrl={base}
                voiceUrl={`${base}/voice`}
                retryUrl={`${base}/transcript`}
                mineSide="cpa"
                title={
                  <span className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => select(null)}
                      className="md:hidden -ml-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-[var(--input-bg)]"
                      aria-label="Back to conversations"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="truncate">{selectedEmail}</span>
                  </span>
                }
                emptyText="No messages yet. Send the first message — type or record a voice note."
                onActivity={fetchConversations}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
