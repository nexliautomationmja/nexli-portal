// Shapes returned by the performance-pay API (client-safe).

import type { ExtraLine, MatchHow, StatementLine, StatementTotals } from "./match";

export type SpendSource = "meta" | "weekly_updates" | "manual" | "none";

export interface MonthView {
  monthIndex: number;
  /** "Nov 19 – Dec 18, 2026" */
  label: string;
  periodStart: string;
  periodEnd: string;
  /** The month has fully ended (a statement can be sent). */
  closed: boolean;
  /** open = the month running now · draft = ended, not sent · sent · none_due */
  status: "open" | "draft" | "sent" | "none_due";
  totals: StatementTotals;
  lines: StatementLine[];
  extras: ExtraLine[];
  adSpendSource: SpendSource;
  /** Why the ad spend couldn't be read from Meta, when it couldn't. */
  adSpendNote: string | null;
  /** Sent statements with something due. */
  invoice: { id: string; number: string; status: string; totalCents: number; paidAt: string | null } | null;
  sentAt: string | null;
}

/** A paying client of the firm that came from an ad, with the trail. */
export interface AttributedClientView {
  email: string;
  name: string;
  company: string | null;
  how: MatchHow;
  firstSeenAt: string;
  platform: string | null;
  campaign: string | null;
  ad: string | null;
  landingUrl: string | null;
  firstPaidAt: string | null;
  /** Everything they've paid the firm, in cents. */
  totalPaidCents: number;
  /** Left out of statements, and why. */
  excluded: { by: "rule" | "existing_client"; reason: string } | null;
}

export interface UncountedPayerView {
  email: string;
  name: string;
  company: string | null;
  firstPaidAt: string | null;
  totalPaidCents: number;
}

export interface LeadOption {
  id: string;
  name: string;
  email: string | null;
  firstSeenAt: string;
  campaign: string | null;
}

export interface PerformanceView {
  /** False when this client isn't on the Nov 19 2026 pricing (the panel then doesn't show). */
  enabled: boolean;
  firm?: { id: string; name: string };
  terms?: { feeCents: number; percent: number; termMonths: number; billing: "monthly" | "prepay" };
  term?: {
    startsAt: string;
    currentEndsAt: string;
    termNumber: number;
    /** Last day a notice still stops the next renewal. */
    noticeDeadline: string;
    /** Set once a non-renewal is recorded. */
    endsAt: string | null;
    noticeAt: string | null;
    ended: boolean;
  };
  launchedAt?: string | null;
  leads?: { total: number; syncedAt: string | null; connected: boolean; error: string | null };
  /** The month running now. Null once the agreement has ended. */
  current?: MonthView | null;
  /** Months that have ended, newest first. */
  months?: MonthView[];
  attributed?: AttributedClientView[];
  /** Paying clients with no ad lead behind them. */
  uncounted?: UncountedPayerView[];
  /** Ad leads that can be linked to a paying client by hand. */
  leadOptions?: LeadOption[];
}

/** What a firm sees of its own statements. */
export interface FirmStatementView {
  monthIndex: number;
  label: string;
  status: "sent" | "none_due";
  totals: StatementTotals;
  lines: StatementLine[];
  extras: ExtraLine[];
  invoice: { number: string; status: string; token: string | null } | null;
  sentAt: string | null;
}
