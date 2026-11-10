// What each status means, in words. Every state gets a visible label and a
// sub-line (phones can't hover a tooltip), plus a tone for its chip.

import type { Tone } from "@/components/rainmaker";
import { dateOrDash, relativeDay, weekdayDate } from "@/lib/format";
import { npsCategory } from "@/lib/survey-questions";
import type { ClientRow, NpsStatus, UpdateStatus } from "./tracker-types";

export type StatusView = { tone: Tone; label: string; sub: string };

export function npsView(nps: NpsStatus | null | undefined): StatusView {
  if (!nps || nps.state === "not_sent") return { tone: "neutral", label: "No survey yet", sub: "goes out every other Monday" };
  if (nps.state === "answered") {
    const when = nps.answeredAt ? `answered ${relativeDay(nps.answeredAt)}` : "answered";
    if (nps.score != null) {
      const cat = npsCategory(nps.score);
      const tone: Tone = cat === "detractor" ? "red" : cat === "passive" ? "amber" : "green";
      const word = cat === "detractor" ? "Detractor" : cat === "passive" ? "Passive" : "Promoter";
      return { tone, label: `NPS ${nps.score}`, sub: `${word} · ${when}` };
    }
    if (nps.legacyScore != null) return { tone: "neutral", label: `${nps.legacyScore}/5`, sub: `older 1–5 survey · ${when}` };
    return { tone: "neutral", label: "Answered", sub: when };
  }
  if (nps.state === "expired") return { tone: "amber", label: "No answer", sub: nps.sentAt ? `survey sent ${weekdayDate(nps.sentAt)}, link expired` : "link expired" };
  return {
    tone: "blue",
    label: "Survey sent",
    sub: nps.expiresAt ? `open until ${weekdayDate(nps.expiresAt)}` : nps.sentAt ? `sent ${weekdayDate(nps.sentAt)}` : "waiting for an answer",
  };
}

/** null = not connected yet (no update to show). */
export function updateView(update: UpdateStatus | null | undefined): StatusView | null {
  if (!update) return null;
  switch (update.state) {
    case "sent":
      return {
        tone: "green",
        label: update.lastSentAt ? `Update sent ${relativeDay(update.lastSentAt)}` : "Update sent",
        sub: update.lastViewedAt ? `opened ${relativeDay(update.lastViewedAt)}` : "not opened yet",
      };
    case "due":
      return { tone: "amber", label: `Update due · ${update.daysSinceSent ?? 7}d`, sub: "a week since the last one" };
    case "overdue":
      return { tone: "red", label: `Update overdue · ${update.daysSinceSent ?? "10+"}d`, sub: "more than 10 days since the last one" };
    case "never":
      return { tone: "red", label: "No update yet", sub: "never sent a weekly update" };
    case "pending":
      return { tone: "neutral", label: "New client", sub: "first update after week one" };
  }
}

export function planView(plan: ClientRow["billingPlan"]): { tone: Tone; label: string } | null {
  if (plan === "enterprise") return { tone: "amber", label: "Enterprise" };
  if (plan === "annual") return { tone: "violet", label: "Annual" };
  if (plan === "monthly") return { tone: "blue", label: "Monthly" };
  return null;
}

export function statusView(status: ClientRow["status"]): { tone: Tone; label: string } {
  return status === "active" ? { tone: "green", label: "Active" } : { tone: "neutral", label: "Signed" };
}

export function termView(c: ClientRow): { started: string; ends: string; atLaunch: boolean } {
  const atLaunch = Boolean(c.termStartsAtLaunch && !c.termEnd);
  return { started: dateOrDash(c.startDate ?? c.signedAt), ends: atLaunch ? "Starts at launch" : dateOrDash(c.termEnd), atLaunch };
}

/** Tone of a "weekly update due" link: red when overdue or never sent. */
export function dueTone(c: ClientRow | undefined): Tone {
  return c?.update && (c.update.state === "overdue" || c.update.state === "never") ? "red" : "amber";
}
