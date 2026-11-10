// Date helpers and status wording for the client drill-down.
import type { Tone } from "@/components/rainmaker";
import { relativeDay, weekdayDate } from "@/lib/format";
import { npsCategory, scaleColor } from "@/lib/survey-questions";
import type { NpsStatusItem, UpdateStatusItem, WeeklyUpdateItem } from "./detail-types";

/** Monday (UTC, YYYY-MM-DD) of the week containing `d` — mirrors weekStartOf() in src/lib/client-success-tables.ts. */
export function mondayOf(d: Date = new Date()): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return day.toISOString().slice(0, 10);
}

export function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Survey link lapsed without an answer. */
export function surveyExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt) && new Date(expiresAt as string).getTime() < Date.now();
}

export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  window.crypto.getRandomValues(bytes);
  let pw = "";
  for (const b of bytes) pw += alphabet[b % alphabet.length];
  return pw;
}

export const npsTone = (score: number): Tone => {
  const c = npsCategory(score);
  return c === "detractor" ? "red" : c === "passive" ? "amber" : "green";
};

/** 1–5 rated answers, same thresholds as scaleColor. */
export const scaleTone = (score: number): Tone => {
  const hex = scaleColor(score).toLowerCase();
  return hex === "#10b981" ? "green" : hex === "#f59e0b" ? "amber" : "red";
};

/**
 * Status line + chip for the Weekly update header. Once this week's update is
 * sent from the composer the server status is stale, so the local list wins.
 */
export function updateHeaderStatus(status: UpdateStatusItem | null, updates: WeeklyUpdateItem[]): { line: string | null; chip: { tone: Tone; label: string } | null } {
  const thisWeek = mondayOf();
  const sentThisWeek = updates.find((u) => u.weekStart === thisWeek && u.status === "sent" && u.sentAt);
  const lastSent =
    sentThisWeek ??
    updates.filter((u) => u.status === "sent" && u.sentAt).sort((a, b) => (b.sentAt as string).localeCompare(a.sentAt as string))[0] ??
    null;
  const lastSentAt = lastSent?.sentAt ?? status?.lastSentAt ?? null;
  const lastViewedAt = lastSent ? lastSent.viewedAt : status?.lastViewedAt ?? null;
  const line = lastSentAt ? `Last sent ${weekdayDate(lastSentAt)} · ${relativeDay(lastSentAt)}${lastViewedAt ? " · opened" : " · not opened yet"}` : null;

  let state = status?.state ?? null;
  if (sentThisWeek) state = "sent";
  if (!state) return { line, chip: null };
  switch (state) {
    case "sent":
      return { line, chip: { tone: "green", label: "Sent this week" } };
    case "due":
      return { line, chip: { tone: "amber", label: "Due now" } };
    case "overdue":
      return { line, chip: { tone: "red", label: "Overdue" } };
    case "never":
      return { line: line ?? "No weekly update has gone out yet", chip: { tone: "red", label: "Never sent" } };
    case "pending":
      return { line: line ?? "New client: the first update isn't due yet", chip: { tone: "neutral", label: "New client" } };
  }
}

export function npsHeader(status: NpsStatusItem | null): { tone: Tone; label: string } {
  if (!status || status.state === "not_sent") return { tone: "neutral", label: "No survey sent yet" };
  if (status.state === "answered") {
    const when = status.answeredAt ? ` · answered ${relativeDay(status.answeredAt)}` : "";
    if (status.score != null) return { tone: npsTone(status.score), label: `NPS ${status.score}${when}` };
    if (status.legacyScore != null) return { tone: scaleTone(status.legacyScore), label: `${status.legacyScore}/5 (older survey)${when}` };
    return { tone: "neutral", label: `Answered${when}` };
  }
  if (status.state === "expired") return { tone: "amber", label: "Expired, no answer" };
  return { tone: "blue", label: `Sent ${status.sentAt ? weekdayDate(status.sentAt) : ""} · not answered yet`.replace("  ", " ") };
}
