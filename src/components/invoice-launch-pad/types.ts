// ─── Invoice pay page shared types ─────────────────────────

/** What the invoice is for (GET /api/invoice/[token] → invoice.kind). */
export type InvoiceKind =
  | "setup"
  | "annual"
  | "monthly"
  | "ad_budget"
  | "renewal"
  | "enterprise"
  | "other";

export type BillingType = "one_time" | "monthly" | "yearly";

export interface InvoiceLine {
  description: string;
  billingType: BillingType;
  amountCents: number;
}

export type PayMethod = "ach" | "card";

/** Hero status pill. */
export type HeroStatus =
  | { kind: "due"; due: Date }
  | { kind: "overdue"; days: number }
  | { kind: "paid"; paidOn: Date }
  | { kind: "processing" };
