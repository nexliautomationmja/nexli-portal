// ─── Invoice pay page formatting helpers ───────────────────

export const DAY_MS = 86_400_000;

export function money(cents: number, currency = "usd"): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

/** "Oct 18" */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Oct 18, 2026" */
export function fmtLongDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Human label for a stored payment method ("ach" | "card"). */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === "card") return "Card";
  if (method === "ach") return "Bank transfer (ACH)";
  return "Online payment";
}

const AD_BUDGET_RE = /advertising budget|ad budget/i;

/**
 * Platform vs ad-budget split for a monthly invoice, from its line items.
 * Null unless the invoice carries both a platform line and an ad-budget line.
 */
export function monthlySplit(
  items: { description: string; amountCents: number }[]
): { platformCents: number; adCents: number } | null {
  let platformCents = 0;
  let adCents = 0;
  for (const it of items) {
    if (AD_BUDGET_RE.test(it.description)) adCents += it.amountCents;
    else platformCents += it.amountCents;
  }
  return platformCents > 0 && adCents > 0 ? { platformCents, adCents } : null;
}
