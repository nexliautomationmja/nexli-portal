import type { CompactLead } from "@/lib/ads/attribution";
import type { MetaPayload } from "@/lib/ads/meta-changes-shared";

/**
 * Marcel's corrections from the Ask chat (client-safe, pure). Only applied
 * changes count:
 *  - lead_not_real: that CRM contact isn't a lead at all (a test, spam, a duplicate).
 *  - booking_not_real: still a lead, but the booked call didn't happen.
 *  - call_override: his own Cut / Keep on a creative until a date.
 *  - goals: new targets (applied to Goals, listed here so they can be undone).
 *  - meta_status / meta_budget / meta_copy: changes in Meta itself (see
 *    meta-changes-shared.ts) — they change the ad account, not the numbers.
 */

export interface LeadFixPayload {
  contactId: string;
  adId: string;
  adName: string;
  /** Account-local day the lead came in (YYYY-MM-DD). */
  date: string;
  /** Short name shown in the list ("Jane D."). */
  who: string;
}

export interface CallOverridePayload {
  adId: string;
  adName: string;
  call: "keep" | "cut";
  /** Marcel's call holds through this account-local day (YYYY-MM-DD). */
  untilDate: string;
  /** What the rules said when it was proposed. */
  ruleCall: string;
}

export interface GoalsValues {
  targetCpbCents: number | null;
  targetCplCents: number | null;
  monthlyBudgetCents: number | null;
  context: string;
}

export interface GoalsPayload {
  before: GoalsValues;
  after: GoalsValues;
}

export type ChangeKind = "lead_not_real" | "booking_not_real" | "call_override" | "goals" | "meta_status" | "meta_budget" | "meta_copy";
/** applying / undoing: Meta is being changed right now (a stuck one counts as applied after a few minutes). */
export type ChangeStatus = "proposed" | "applying" | "applied" | "undoing" | "dismissed" | "undone";

export const CORRECTION_KINDS: ChangeKind[] = ["lead_not_real", "booking_not_real", "call_override", "goals"];

/** A change as the page sees it. */
export interface ChangeView {
  id: string;
  kind: ChangeKind;
  adId: string | null;
  summary: string;
  reason: string;
  status: ChangeStatus;
  payload: LeadFixPayload | CallOverridePayload | GoalsPayload | MetaPayload;
  createdAt: string;
  appliedAt: string | null;
  undoneAt: string | null;
}

/** Marcel's own call on one creative (the live one, if several were applied). */
export interface CallOverride {
  changeId: string;
  call: "keep" | "cut";
  untilDate: string;
  reason: string;
}

export interface SnapshotCorrections {
  /** adId → Marcel's call. Expired ones are left in; decideAds ignores them. */
  overrides: Record<string, CallOverride>;
  /** Applied lead fixes per ad (for "1 lead removed by you" notes). */
  leadFixes: Record<string, { leads: number; bookings: number }>;
  count: number;
}

export interface LeadCorrection {
  kind: "lead_not_real" | "booking_not_real";
  contactId: string;
}

/** Leads with Marcel's fixes: dropped contacts gone, un-booked ones no longer booked. */
export function applyLeadCorrections<L extends Pick<CompactLead, "i" | "b"> = CompactLead>(leads: L[], fixes: LeadCorrection[]): L[] {
  if (!fixes.length) return leads;
  const drop = new Set(fixes.filter((f) => f.kind === "lead_not_real").map((f) => f.contactId));
  const unbook = new Set(fixes.filter((f) => f.kind === "booking_not_real").map((f) => f.contactId));
  const out: L[] = [];
  for (const l of leads) {
    if (l.i && drop.has(l.i)) continue;
    out.push(l.i && unbook.has(l.i) && l.b ? { ...l, b: 0 } : l);
  }
  return out;
}

/** The snapshot's view of the applied changes (newest override per ad wins). */
export function snapshotCorrections(applied: { id: string; kind: ChangeKind; adId: string | null; reason: string; payload: unknown; appliedAt: string | null }[]): SnapshotCorrections {
  const overrides: Record<string, CallOverride> = {};
  const leadFixes: Record<string, { leads: number; bookings: number }> = {};
  const byTime = [...applied].sort((a, b) => (a.appliedAt ?? "").localeCompare(b.appliedAt ?? ""));
  for (const c of byTime) {
    if (c.kind === "call_override") {
      const p = c.payload as CallOverridePayload;
      if (p?.adId && (p.call === "keep" || p.call === "cut") && /^\d{4}-\d{2}-\d{2}$/.test(p.untilDate ?? "")) {
        overrides[p.adId] = { changeId: c.id, call: p.call, untilDate: p.untilDate, reason: c.reason };
      }
    } else if ((c.kind === "lead_not_real" || c.kind === "booking_not_real") && c.adId) {
      const f = leadFixes[c.adId] ?? { leads: 0, bookings: 0 };
      if (c.kind === "lead_not_real") f.leads++;
      else f.bookings++;
      leadFixes[c.adId] = f;
    }
  }
  return { overrides, leadFixes, count: applied.filter((c) => CORRECTION_KINDS.includes(c.kind)).length };
}

/** Is Marcel's call still in force on `day` (the plan's date)? */
export const overrideActive = (o: CallOverride | undefined, day: string): o is CallOverride => Boolean(o && o.untilDate >= day);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 24" from YYYY-MM-DD. */
export const dayLabel = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return m && d ? `${MON[m - 1]} ${d}` : ymd;
};
