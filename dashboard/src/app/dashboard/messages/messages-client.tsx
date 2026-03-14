"use client";

import { useState, useEffect } from "react";
import { MessageIcon, SendIcon } from "@/components/ui/icons";

interface Conversation {
  id: string;
  contactId: string;
  locationId: string;
  dateAdded: string;
  lastMessageDate?: string;
  contactName?: string;
}

interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  direction: "inbound" | "outbound";
  type: string;
  dateAdded: string;
  body?: string;
}

export function MessagesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Load conversations
  useEffect(() => {
    fetch("/api/dashboard/ghl/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => setConversations([]))
      .finally(() => setLoadingConvos(false));
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedConvo) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    fetch(`/api/dashboard/ghl/conversations/${selectedConvo}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [selectedConvo]);

  async function handleSend() {
    if (!replyText.trim() || !selectedConvo) return;
    setSending(true);
    try {
      await fetch(`/api/dashboard/ghl/conversations/${selectedConvo}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      // Add the message to the local list
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          conversationId: selectedConvo,
          contactId: "",
          direction: "outbound",
          type: "SMS",
          dateAdded: new Date().toISOString(),
          body: replyText,
        },
      ]);
      setReplyText("");
    } finally {
      setSending(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Conversations from GoHighLevel
        </p>
      </div>

      {/* Split layout */}
      <div className="glass-card overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex h-full">
          {/* Conversation List (left panel) */}
          <div className="w-full md:w-80 border-r border-[var(--glass-border)] flex flex-col">
            <div className="p-4 border-b border-[var(--glass-border)]">
              <p className="section-header mb-0">
                Conversations ({conversations.length})
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
                  <p className="text-xs">No conversations</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedConvo(convo.id)}
                    className={`w-full text-left px-4 py-3.5 border-b border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors ${
                      selectedConvo === convo.id ? "bg-blue-500/10 border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                        {convo.contactName || `Contact ${convo.contactId.slice(0, 8)}`}
                      </p>
                      <span className="text-[10px] shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(convo.lastMessageDate || convo.dateAdded)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Thread (right panel) */}
          <div className="hidden md:flex flex-1 flex-col">
            {!selectedConvo ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                <div className="empty-state">
                  <MessageIcon className="empty-state-icon" />
                  <p className="text-sm">Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
                  {loadingMessages ? (
                    <div className="text-center py-8">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                      No messages yet
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2.5 text-sm ${
                            msg.direction === "outbound"
                              ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-md"
                              : "bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md"
                          }`}
                          style={{
                            color: msg.direction === "outbound" ? undefined : "var(--text-main)",
                          }}
                        >
                          {msg.body || "[No content]"}
                          <p className={`text-[10px] mt-1.5 ${
                            msg.direction === "outbound" ? "text-blue-200" : ""
                          }`}
                            style={{ color: msg.direction === "outbound" ? undefined : "var(--text-muted)" }}
                          >
                            {new Date(msg.dateAdded).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply composer */}
                <div className="p-4 border-t border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Type a message..."
                      disabled={sending}
                      className="flex-1 px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                      style={{ color: "var(--text-main)" }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sending}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white disabled:opacity-50 transition-all shrink-0"
                      style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                    >
                      <SendIcon className="w-4 h-4" />
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
