import type { ChangeView } from "@/lib/ads/corrections-shared";

/**
 * The Ask chat on the Ads page (client-safe): what each turn shows, the
 * events the server streams while Claude answers, and the line reader.
 */

export const CHAT_MAX_USER_TURNS = 40;
export const CHAT_MAX_MESSAGE = 4000;

export interface WindowNumbers {
  spendCents: number;
  impressions: number;
  ctr: number | null;
  frequency: number | null;
  metaLeads: number;
  crmLeads: number | null;
  booked: number | null;
  cplCents: number | null;
  cpbCents: number | null;
}

export interface CreativeCardData {
  adId: string;
  name: string;
  thumbnailUrl: string | null;
  adsManagerUrl: string;
  live: boolean;
  adsetName: string;
  ageDays: number | null;
  hasUtm: boolean | null;
  call: { call: "cut" | "keep"; tag: string | null; reason: string; done: boolean; yours: boolean } | null;
  w7: WindowNumbers | null;
  w30: WindowNumbers | null;
  fatigue: { state: string; reasons: string[] };
  fixes: { leads: number; bookings: number } | null;
}

export interface LeadRowData {
  contactId: string;
  name: string;
  email: string | null;
  /** When the lead came in (ISO). */
  at: string;
  booked: boolean;
  won: boolean;
  /** Marcel already marked it: the whole lead, or just its booked call. */
  removed: "lead" | "booking" | null;
  ghlUrl: string | null;
}

export type ChatBlock =
  | { kind: "creative"; card: CreativeCardData }
  | { kind: "leads"; adId: string; adName: string; days: number; total: number; booked: number; rows: LeadRowData[] }
  | { kind: "change"; changeId: string }
  | { kind: "creatives"; count: number; note: string };

export type DisplayItem = { type: "text"; text: string } | { type: "tool"; label: string } | { type: "block"; block: ChatBlock };

export interface DisplayTurn {
  role: "user" | "assistant";
  at: string;
  items: DisplayItem[];
  /** The answer stopped early (shown under it). */
  error?: string;
}

export interface ChatView {
  id: string;
  turns: DisplayTurn[];
  userTurns: number;
  full: boolean;
  updatedAt: string;
}

export type ChatEvent =
  | { t: "chat"; id: string }
  | { t: "text"; d: string }
  | { t: "tool"; label: string }
  | { t: "block"; block: ChatBlock }
  | { t: "change"; change: ChangeView }
  | { t: "ping" }
  | { t: "done"; turn: DisplayTurn }
  | { t: "error"; message: string };

/** Complete lines out of a growing buffer (NDJSON over a stream); the unfinished tail stays in `rest`. */
export function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((l) => l.trim()).filter(Boolean), rest };
}

/** Add streamed text to a turn (joins the last text piece). */
export function addText(items: DisplayItem[], d: string): DisplayItem[] {
  const last = items[items.length - 1];
  if (last?.type === "text") return [...items.slice(0, -1), { type: "text", text: last.text + d }];
  return [...items, { type: "text", text: d }];
}
