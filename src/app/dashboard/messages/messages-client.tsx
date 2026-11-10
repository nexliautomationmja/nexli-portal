"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThreadView } from "@/components/messages/thread-view";
import type { ThreadMessage } from "@/lib/portal-messages-types";
import { MessagesView } from "./messages-view";
import {
  MAX_REPLY,
  convoName,
  inOrder,
  listStateOf,
  toThreadMessage,
  type ConversationsResponse,
  type GhlMessage,
} from "./messages-types";

async function errorText(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

/** GoHighLevel text conversations: loads them and sends replies; MessagesView draws the page. */
export function MessagesClient() {
  const [list, setList] = useState<{ data: ConversationsResponse | null; failed: boolean } | null>(null);
  const [listTick, setListTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [thread, setThread] = useState<{ key: string; messages: GhlMessage[]; error: string | null } | null>(null);
  const [sent, setSent] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Conversations (once, and on Try again).
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/dashboard/ghl/conversations", { signal: ctrl.signal })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as ConversationsResponse | null;
        if (!r.ok || !data) throw new Error(String(r.status));
        setList({ data, failed: false });
        setNow(Date.now());
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setList({ data: null, failed: true });
      });
    return () => ctrl.abort();
  }, [listTick]);

  // The open conversation's messages; switching cancels the last request.
  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    const key = selected;
    fetch(`/api/dashboard/ghl/conversations/${selected}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          setThread({ key, messages: [], error: await errorText(r, "Couldn't load this conversation.") });
          return;
        }
        const data = (await r.json().catch(() => ({}))) as { messages?: GhlMessage[] };
        setThread({ key, messages: data.messages ?? [], error: null });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setThread({ key, messages: [], error: "Couldn't load this conversation. Check your connection." });
      });
    return () => ctrl.abort();
  }, [selected]);

  const current = thread && thread.key === selected ? thread : null;
  const messages: ThreadMessage[] = current ? [...inOrder(current.messages).map(toThreadMessage), ...sent] : [];

  // Stick to the bottom when a message arrives or the thread loads.
  const lastId = messages.length ? messages[messages.length - 1].id : "";
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, current]);

  const autoGrow = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, []);

  function open(id: string | null) {
    setSelected(id);
    setSent([]);
    setInput("");
    setSendError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || !selected) return;
    const convo = selected;
    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ThreadMessage = {
      ...toThreadMessage({ id: tempId, direction: "outbound", dateAdded: new Date().toISOString(), body: text }),
    };
    setSent((prev) => [...prev, optimistic]);
    setInput("");
    requestAnimationFrame(autoGrow);
    try {
      const res = await fetch(`/api/dashboard/ghl/conversations/${convo}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await errorText(res, "Message not sent. Please try again."));
      const data = (await res.json().catch(() => ({}))) as { messageId?: string };
      const id = data.messageId || `sent-${tempId.slice(5)}`;
      setSent((prev) => prev.map((m) => (m.id === tempId ? { ...m, id } : m)));
    } catch (err) {
      // Not sent: take the bubble back and give the text back to edit or retry.
      setSent((prev) => prev.filter((m) => m.id !== tempId));
      setInput((cur) => cur || text);
      setSendError(err instanceof Error ? err.message : "Message not sent. Please try again.");
    }
  }

  const listState = list ? listStateOf(list.data, list.failed) : "loading";
  const conversations = list?.data?.conversations ?? [];
  const openConvo = conversations.find((c) => c.id === selected);

  return (
    <MessagesView
      state={listState}
      conversations={conversations}
      selected={selected}
      now={now}
      onSelect={open}
      onRetry={() => {
        setList(null);
        setListTick((t) => t + 1);
      }}
      thread={
        selected ? (
          <ThreadView
            title={openConvo ? convoName(openConvo) : "Conversation"}
            subtitle="Replies go out by SMS through GoHighLevel."
            onBack={() => open(null)}
            messages={messages}
            mineSide="cpa"
            loading={!current}
            loadError={current?.error ?? null}
            emptyText="No messages in this conversation yet."
            scrollRef={scrollRef}
            textareaRef={textareaRef}
            composer={{
              value: input,
              onChange: (v) => {
                setInput(v.slice(0, MAX_REPLY));
                autoGrow();
              },
              onSend: () => void send(),
              maxLen: MAX_REPLY,
              error: sendError,
              placeholder: "Text message…",
            }}
          />
        ) : null
      }
    />
  );
}
