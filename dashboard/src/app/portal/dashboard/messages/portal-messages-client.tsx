"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SendIcon } from "@/components/ui/icons";

interface Message {
  id: string;
  senderType: "cpa" | "client";
  message: string;
  createdAt: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7)
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

export function PortalMessagesClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 20 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 20000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setInput("");
        await fetchMessages();
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
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

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Send messages to your CPA.
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto glass-card p-4 space-y-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center" style={{ color: "var(--text-muted)" }}>
              <SendIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                No messages yet
              </p>
              <p className="text-xs mt-1">
                Send a message to your CPA below.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderType === "client" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  msg.senderType === "client"
                    ? "text-white"
                    : "glass-bg"
                }`}
                style={
                  msg.senderType === "client"
                    ? { background: "linear-gradient(135deg, #2563EB, #06B6D4)" }
                    : { border: "1px solid var(--card-border)" }
                }
              >
                <p
                  className="text-sm whitespace-pre-wrap break-words"
                  style={{
                    color:
                      msg.senderType === "client"
                        ? "#fff"
                        : "var(--text-main)",
                  }}
                >
                  {msg.message}
                </p>
                <p
                  className="text-[10px] mt-1"
                  style={{
                    color:
                      msg.senderType === "client"
                        ? "rgba(255,255,255,0.6)"
                        : "var(--text-muted)",
                  }}
                >
                  {msg.senderType === "cpa" ? "Your CPA" : "You"} &middot;{" "}
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="mt-3 glass-card p-3 flex items-end gap-2"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Type a message..."
            rows={1}
            maxLength={2000}
            className="w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none"
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
              style={{
                color: input.length > 1950 ? "#EF4444" : "var(--text-muted)",
              }}
            >
              {input.length}/2000
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
          style={{
            background: "linear-gradient(135deg, #2563EB, #06B6D4)",
          }}
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <SendIcon className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
