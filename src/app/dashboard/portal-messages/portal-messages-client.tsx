"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageThread } from "@/components/messages/message-thread";
import { PortalMessagesView } from "./portal-messages-view";
import { threadBase, type Conversation } from "./portal-messages-types";

/** Text and voice threads with clients: loads the inbox (every 30 s); PortalMessagesView draws it. */
export function PortalMessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientParam = searchParams.get("client");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(clientParam);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());

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
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setConversations(data.conversations || []);
      setState("ready");
    } catch {
      // A failed refresh keeps the last list; only a first load shows the error.
      setState((s) => (s === "ready" ? s : "error"));
    } finally {
      setNow(Date.now());
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

  // A deep-linked client with no messages yet still gets a row.
  const listed: Conversation[] =
    selectedEmail && state !== "loading" && !conversations.some((c) => c.clientEmail === selectedEmail)
      ? [{ clientEmail: selectedEmail, lastMessage: "New conversation", lastMessageAt: "", unreadCount: 0 }, ...conversations]
      : conversations;

  const base = selectedEmail ? threadBase(selectedEmail) : "";

  return (
    <PortalMessagesView
      state={state}
      conversations={listed}
      count={conversations.length}
      selected={selectedEmail}
      now={now}
      onSelect={select}
      onRetry={() => {
        setState("loading");
        void fetchConversations();
      }}
      thread={
        selectedEmail ? (
          <MessageThread
            key={selectedEmail}
            fetchUrl={base}
            postUrl={base}
            voiceUrl={`${base}/voice`}
            retryUrl={`${base}/transcript`}
            mineSide="cpa"
            title={selectedEmail}
            emptyText="No messages yet. Send the first message — type or record a voice note."
            onActivity={fetchConversations}
            onBack={() => select(null)}
          />
        ) : null
      }
    />
  );
}
