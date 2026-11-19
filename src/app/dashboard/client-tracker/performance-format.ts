// Shared wording for the performance-pay screens (admin panel + the firm's own statements). Pure.

import type { MatchHow, StatementLine, StatementTotals } from "@/lib/performance/match";
import type { SpendSource } from "@/lib/performance/view-types";

/** "$15,000" / "$1,234.56" — cents only when there are some. */
export function usd(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const text = (abs / 100).toLocaleString("en-US", { minimumFractionDigits: abs % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return `${neg ? "−" : ""}$${text}`;
}

/** "Dec 12, 2026" (UTC, so a date reads the same wherever it's opened). */
export function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const PLATFORM: Record<string, string> = { facebook: "a Facebook ad", instagram: "an Instagram ad", other: "a Meta ad", unknown: "a Meta ad" };

export const HOW_LABEL: Record<MatchHow, string> = {
  email: "Matched by email",
  phone: "Matched by phone",
  pipeline: "Matched through their pipeline",
  manual: "Linked by Nexli",
};

/** "Came in Dec 12, 2026 from a Facebook ad · Tax planning — owners · Daniela hook 3" */
export function trail(lead: { firstSeenAt: string; platform: string | null; campaign: string | null; ad: string | null }): string {
  const from = PLATFORM[lead.platform ?? "unknown"] ?? "a Meta ad";
  return [`Came in ${day(lead.firstSeenAt)} from ${from}`, lead.campaign, lead.ad].filter(Boolean).join(" · ");
}

export const SPEND_SOURCE: Record<SpendSource, string> = {
  meta: "from Meta",
  weekly_updates: "from the weekly updates",
  manual: "entered by Nexli",
  none: "not known yet",
};

/** The six lines of the calculation, top to bottom. */
export function mathRows(t: StatementTotals): { label: string; value: string; strong?: boolean }[] {
  return [
    { label: `Collected from ${t.clients} ad-sourced client${t.clients === 1 ? "" : "s"}`, value: usd(t.collectedCents) },
    { label: "Less ad spend", value: usd(-t.adSpendCents) },
    { label: "Net attributed revenue", value: usd(t.netCents), strong: true },
    { label: `${t.percent}% of net`, value: usd(t.grossCents) },
    { label: "Less the agency fee paid for the month", value: usd(-t.creditCents) },
    { label: "Performance pay", value: usd(t.dueCents), strong: true },
  ];
}

/** "INV-0012 · Jan 4, 2027" for each payment, estimated dates flagged. */
export function paymentsText(line: StatementLine): string {
  return line.payments.map((p) => `${p.invoiceNumber} · ${day(p.at)}${p.estimated ? " (date estimated)" : ""}`).join(", ");
}
