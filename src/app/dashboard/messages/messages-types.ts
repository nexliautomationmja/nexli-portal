// GoHighLevel Messages: types and pure helpers (client-safe).

import type { ThreadMessage } from "@/lib/portal-messages-types";

export interface GhlConversation {
  id: string;
  contactId: string;
  locationId?: string;
  /** GHL sends these as ISO strings or epoch milliseconds. */
  dateAdded?: string | number;
  lastMessageDate?: string | number;
  contactName?: string;
  fullName?: string;
}

export interface GhlMessage {
  id: string;
  conversationId?: string;
  contactId?: string;
  direction: "inbound" | "outbound";
  type?: string | number;
  dateAdded: string;
  body?: string;
}

/** GET /api/dashboard/ghl/conversations. `connected` / `error` are newer: older deploys don't send them. */
export interface ConversationsResponse {
  conversations?: GhlConversation[];
  total?: number;
  connected?: boolean;
  error?: string;
}

export type ListState = "loading" | "ready" | "error" | "disconnected";

/** Same sanity cap as the reply route. */
export const MAX_REPLY = 5000;

export const convoName = (c: GhlConversation) => c.contactName || c.fullName || `Contact ${c.contactId}`;

const ms = (d: string | number | undefined) => (d == null || d === "" ? NaN : new Date(d).getTime());

/** "Just now" / "5m" / "3h" / "2d". */
export function timeAgo(d: string | number | undefined, now: number): string {
  const t = ms(d);
  if (Number.isNaN(t)) return "";
  const minutes = Math.floor((now - t) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export const lastActivity = (c: GhlConversation) => c.lastMessageDate ?? c.dateAdded;

/** A GHL message drawn with the shared bubbles: ours on the right. */
export function toThreadMessage(m: GhlMessage): ThreadMessage {
  return {
    id: m.id,
    senderType: m.direction === "outbound" ? "cpa" : "client",
    kind: "text",
    message: m.body?.trim() ? m.body : "[No content]",
    transcript: null,
    transcriptStatus: null,
    audioUrl: null,
    audioDurationMs: null,
    weeklyUpdate: null,
    read: false,
    createdAt: m.dateAdded,
  };
}

/** Oldest first, so the newest sits at the bottom next to the reply box. */
export function inOrder(messages: GhlMessage[]): GhlMessage[] {
  return [...messages].sort((a, b) => (ms(a.dateAdded) || 0) - (ms(b.dateAdded) || 0));
}

export function listStateOf(data: ConversationsResponse | null, failed: boolean): ListState {
  if (failed) return "error";
  if (!data) return "loading";
  if (data.connected === false) return "disconnected";
  if (data.error) return "error";
  return "ready";
}
