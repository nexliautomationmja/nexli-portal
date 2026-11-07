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
