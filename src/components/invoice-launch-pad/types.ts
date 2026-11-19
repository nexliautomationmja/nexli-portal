// ─── Invoice pay page shared types ─────────────────────────

/** What the invoice is for (GET /api/invoice/[token] → invoice.kind). */
export type InvoiceKind =
  | "setup"
  | "annual"
  | "monthly"
  | "ad_budget"
  | "renewal"
  | "enterprise"
  // Nov 19 2026 pricing:
  | "agency" // the monthly Agency Fee
  | "prepay" // the six-month prepayment
  | "performance" // a month's Performance Pay
  | "other";

/** The totals of a month's Performance Pay statement (GET /api/invoice/[token] → statement). All cents. */
export interface InvoiceStatement {
  /** "Nov 19 – Dec 18, 2026" */
  periodLabel: string;
  collectedCents: number;
  adSpendCents: number;
  netCents: number;
  percent: number;
  creditCents: number;
  dueCents: number;
  /** How many ad-sourced clients paid in the month. */
  clients: number;
}

export type BillingType = "one_time" | "monthly" | "yearly";

export interface InvoiceLine {
  description: string;
  billingType: BillingType;
  amountCents: number;
}

export type PayMethod = "ach" | "card";

/** Nexli's bank details for invoices paid by bank transfer into Mercury (GET /api/invoice/[token] → remit). */
export interface BankRemit {
  beneficiary: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  /** Null when only ACH details are configured. */
  wire: { bankName: string; bankAddress: string; beneficiaryAddress: string | null } | null;
}

/** Hero status pill. */
export type HeroStatus =
  | { kind: "due"; due: Date }
  | { kind: "overdue"; days: number }
  | { kind: "paid"; paidOn: Date }
  | { kind: "processing" };
