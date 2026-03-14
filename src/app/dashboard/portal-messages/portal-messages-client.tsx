"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SendIcon, MessageIcon } from "@/components/ui/icons";

interface Conversation {
  clientEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderType: "cpa" | "client";
  message: string;
  createdAt: string;
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

export function PortalMessagesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/portal-messages");
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
    fetchConversations();
  }, [fetchConversations]);

  // Poll conversation list every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Load messages when conversation changes
  const fetchMessages = useCallback(async () => {
    if (!selectedEmail) return;
    try {
      const res = await fetch(
        `/api/dashboard/portal-messages/${encodeURIComponent(selectedEmail)}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedEmail]);

  useEffect(() => {
    if (selectedEmail) {
      setLoadingMessages(true);
      setMessages([]);
      fetchMessages();
    }
  }, [selectedEmail, fetchMessages]);

  // Poll thread every 20 seconds when a conversation is selected
  useEffect(() => {
    if (!selectedEmail) return;
    const interval = setInterval(fetchMessages, 20000);
    return () => clearInterval(interval);
  }, [selectedEmail, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    if (!replyText.trim() || !selectedEmail || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/dashboard/portal-messages/${encodeURIComponent(selectedEmail)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: replyText }),
        }
      );
      if (res.ok) {
        setReplyText("");
        await fetchMessages();
        await fetchConversations();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-main)" }}
        >
          Client Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Messages from your portal clients
        </p>
      </div>

      {/* Split layout */}
      <div
        className="glass-card overflow-hidden"
        style={{ height: "calc(100vh - 220px)" }}
      >
        <div className="flex h-full">
          {/* Conversation List (left panel) */}
          <div className="w-full md:w-80 border-r border-[var(--glass-border)] flex flex-col">
            <div className="p-4 border-b border-[var(--glass-border)]">
              <p className="section-header mb-0">
                Clients ({conversations.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {loadingConvos ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="empty-state py-12">
                  <MessageIcon className="empty-state-icon" />
                  <p className="text-xs">No client messages yet</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.clientEmail}
                    onClick={() => setSelectedEmail(convo.clientEmail)}
                    className={`w-full text-left px-4 py-3.5 border-b border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors ${
                      selectedEmail === convo.clientEmail
                        ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-main)" }}
                      >
                        {convo.clientEmail}
                      </p>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {convo.unreadCount > 0 && (
                          <span
                            className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{
                              background:
                                "linear-gradient(135deg, #2563EB, #06B6D4)",
                            }}
                          >
                            {convo.unreadCount}
                          </span>
                        )}
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {convo.lastMessage}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Thread (right panel) */}
          <div className="hidden md:flex flex-1 flex-col">
            {!selectedEmail ? (
              <div
                className="flex-1 flex items-center justify-center"
                style={{ color: "var(--text-muted)" }}
              >
                <div className="empty-state">
                  <MessageIcon className="empty-state-icon" />
                  <p className="text-sm">Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-5 py-3 border-b border-[var(--glass-border)]">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {selectedEmail}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
                  {loadingMessages ? (
                    <div className="text-center py-8">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p
                      className="text-center text-sm py-8"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No messages yet. Send the first message below.
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderType === "cpa"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2.5 text-sm ${
                            msg.senderType === "cpa"
                              ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-md"
                              : "bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md"
                          }`}
                          style={{
                            color:
                              msg.senderType === "cpa"
                                ? undefined
                                : "var(--text-main)",
                          }}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                          <p
                            className={`text-[10px] mt-1.5 ${
                              msg.senderType === "cpa" ? "text-blue-200" : ""
                            }`}
                            style={{
                              color:
                                msg.senderType === "cpa"
                                  ? undefined
                                  : "var(--text-muted)",
                            }}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply composer */}
                <div className="p-4 border-t border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && !e.shiftKey && handleSend()
                        }
                        placeholder="Type a message..."
                        disabled={sending}
                        maxLength={2000}
                        className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                        style={{ color: "var(--text-main)" }}
                      />
                      {replyText.length > 1800 && (
                        <span
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
                          style={{
                            color:
                              replyText.length > 1950
                                ? "#EF4444"
                                : "var(--text-muted)",
                          }}
                        >
                          {replyText.length}/2000
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sending}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white disabled:opacity-50 transition-all shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #2563EB, #06B6D4)",
                      }}
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <SendIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
