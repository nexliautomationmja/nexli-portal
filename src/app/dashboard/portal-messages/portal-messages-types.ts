// Client Messages: types and pure helpers (client-safe).

export interface Conversation {
  clientEmail: string;
  lastMessage: string;
  lastKind?: "text" | "voice" | "weekly_update";
  lastMessageAt: string;
  unreadCount: number;
}

/** "Just now" / "5m" / "3h" / "2d" (empty for a brand-new conversation). */
export function timeAgo(dateStr: string | undefined, now: number = Date.now()): string {
  if (!dateStr) return "";
  const minutes = Math.floor((now - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** The last message's text without the emoji prefix the server adds to voice notes. */
export function previewOf(c: Conversation): string {
  const text = (c.lastMessage || "").replace(/^🎙\s*/u, "").trim();
  if (c.lastKind === "voice") return text || "Voice message";
  if (c.lastKind === "weekly_update") return text || "Weekly update";
  return c.lastMessage;
}

export const threadBase = (email: string) => `/api/dashboard/portal-messages/${encodeURIComponent(email)}`;
