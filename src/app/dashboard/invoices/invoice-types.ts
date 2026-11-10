// Invoices page: types and pure helpers (client-safe). Money on the server is
// in cents, quantity ×100 and tax in basis points; the forms work in dollars
// and percent, kept as typed strings until they're sent.

import type { Tone } from "@/components/rainmaker";
import type { OwnerBranding } from "@/lib/branding";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  billingType?: string;
}

export interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientCompany: string | null;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  amountPaid: number;
  balanceDue: number;
  isRecurring: boolean;
  recurringInterval: string | null;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  terms: string | null;
  token: string;
  paymentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  canceledAt: string | null;
  reminderConfig: { schedule: { dayOffset: number }[] } | null;
  createdAt: string;
  lineItems: LineItem[];
  /** transferSentAt: the client tapped "I've sent the transfer" (bank-transfer invoices). */
  metadata?: { transferSentAt?: string } | null;
}

export interface ClientHistory {
  clientEmail: string;
  clientName: string;
  clientCompany: string;
  invoices: Invoice[];
  summary: { totalInvoices: number; totalInvoiced: number; totalPaid: number; totalOutstanding: number };
}

/** GET /api/dashboard/invoices */
export interface InvoicesResponse {
  invoices?: Invoice[];
  from?: { name: string; company: string };
  branding?: OwnerBranding;
}

// ─── Status ────────────────────────────────────────────────

export const STATUS: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  sent: { tone: "blue", label: "Sent" },
  viewed: { tone: "cyan", label: "Viewed" },
  partial: { tone: "amber", label: "Partly paid" },
  overdue: { tone: "red", label: "Overdue" },
  paid: { tone: "green", label: "Paid" },
  void: { tone: "neutral", label: "Void" },
  canceled: { tone: "neutral", label: "Canceled" },
};
export const statusOf = (s: string) => STATUS[s] ?? STATUS.draft;

/** Waiting on the client's money. */
export const OPEN = new Set(["sent", "viewed", "overdue", "partial"]);
/** What the server lets you void (invoices/[invoiceId]/route.ts). */
export const VOIDABLE = new Set(["sent", "viewed", "overdue"]);

export const INTERVAL_LABEL: Record<string, string> = {
  weekly: "weekly",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

// ─── Formatting ────────────────────────────────────────────

const SYMBOL: Record<string, string> = { usd: "$", cad: "CA$", gbp: "£", eur: "€", aud: "A$" };

export function money(cents: number, currency = "usd"): string {
  const symbol = SYMBOL[currency] || "$";
  return `${symbol}${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const CURRENCIES = [
  { value: "usd", label: "USD ($)" },
  { value: "cad", label: "CAD (CA$)" },
  { value: "gbp", label: "GBP (£)" },
  { value: "eur", label: "EUR (€)" },
  { value: "aud", label: "AUD (A$)" },
] as const;

export const REMINDER_OPTIONS = [
  { dayOffset: -7, label: "7 days before due" },
  { dayOffset: -3, label: "3 days before due" },
  { dayOffset: 0, label: "On the due date" },
  { dayOffset: 3, label: "3 days after due" },
  { dayOffset: 7, label: "7 days after due" },
] as const;

export const BILLING_TYPES = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

/** YYYY-MM-DD in the browser's own day (not UTC — late evenings used to get tomorrow). */
export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const todayISO = () => localISO(new Date());
export const maxDueISO = () => localISO(new Date(Date.now() + 365 * 86_400_000));

// ─── Drafts (the forms) ────────────────────────────────────

export interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  billingType: string;
}

export interface ClientFields {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany: string;
}

export interface InvoiceOptions {
  /** Percent, as typed. */
  taxRate: string;
  dueDate: string;
  notes: string;
  terms: string;
  currency: string;
  /** Reminder day offsets (−7 … +7). */
  reminders: number[];
}

export interface InvoiceDraft extends ClientFields, InvoiceOptions {
  lines: DraftLine[];
}

export interface Recipient extends ClientFields {
  key: string;
}

let seq = 0;
export const newKey = () => `k${(seq++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const blankLine = (): DraftLine => ({ key: newKey(), description: "", quantity: "1", unitPrice: "", billingType: "one_time" });
export const blankOptions = (): InvoiceOptions => ({ taxRate: "", dueDate: "", notes: "", terms: "", currency: "usd", reminders: [] });
export const blankClient = (): ClientFields => ({ clientName: "", clientEmail: "", clientPhone: "", clientCompany: "" });
export const blankDraft = (): InvoiceDraft => ({ ...blankClient(), lines: [blankLine()], ...blankOptions() });
export const blankRecipient = (): Recipient => ({ key: newKey(), ...blankClient() });

/** A typed number (what the page has always done: parseFloat or 0). */
export const num = (v: string) => parseFloat(v) || 0;

export const lineTotal = (l: Pick<DraftLine, "quantity" | "unitPrice">) => num(l.quantity) * num(l.unitPrice);

/** Dollars. */
export function totals(lines: Pick<DraftLine, "quantity" | "unitPrice">[], taxRate: string) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tax = (subtotal * num(taxRate)) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

export const isRepeating = (lines: Pick<DraftLine, "billingType">[]) => lines.some((l) => l.billingType !== "one_time");

/** What's still missing, in words (null = ready). */
export function linesProblem(lines: DraftLine[]): string | null {
  if (lines.some((l) => !l.description.trim())) return "Every line needs a description.";
  if (lines.some((l) => num(l.quantity) <= 0)) return "Every line needs a quantity above 0.";
  if (lines.some((l) => num(l.unitPrice) <= 0)) return "Every line needs a rate above $0.";
  return null;
}

export function draftProblem(d: InvoiceDraft): string | null {
  if (!d.clientName.trim() || !d.clientEmail.trim()) return "Add the client's name and email.";
  return linesProblem(d.lines) ?? (d.dueDate ? null : "Pick a due date.");
}

export function batchProblem(recipients: Recipient[], lines: DraftLine[], o: InvoiceOptions): string | null {
  if (!recipients.length) return "Add at least one client.";
  if (recipients.some((r) => !r.clientName.trim() || !r.clientEmail.trim())) return "Every client needs a name and email.";
  return linesProblem(lines) ?? (o.dueDate ? null : "Pick a due date.");
}

// ─── Request bodies (the same as the page always sent) ─────

const lineItemsBody = (lines: DraftLine[]) =>
  lines.map((li) => ({ description: li.description.trim(), quantity: num(li.quantity), unitPrice: num(li.unitPrice), billingType: li.billingType }));

const reminderConfig = (reminders: number[]) => (reminders.length > 0 ? { schedule: reminders.map((dayOffset) => ({ dayOffset })) } : undefined);

/** POST /api/dashboard/invoices */
export function createBody(d: InvoiceDraft) {
  const repeat = d.lines.find((li) => li.billingType !== "one_time")?.billingType;
  return {
    clientName: d.clientName.trim(),
    clientEmail: d.clientEmail.trim(),
    clientPhone: d.clientPhone.trim() || undefined,
    clientCompany: d.clientCompany.trim() || undefined,
    lineItems: lineItemsBody(d.lines),
    taxRate: Math.round(num(d.taxRate) * 100),
    dueDate: d.dueDate,
    notes: d.notes.trim() || undefined,
    terms: d.terms.trim() || undefined,
    currency: d.currency,
    isRecurring: isRepeating(d.lines),
    recurringInterval: repeat || undefined,
    reminderConfig: reminderConfig(d.reminders),
  };
}

/** POST /api/dashboard/invoices/batch */
export function batchBody(recipients: Recipient[], lines: DraftLine[], o: InvoiceOptions, sendImmediately: boolean) {
  return {
    clients: recipients.map((c) => ({
      clientName: c.clientName.trim(),
      clientEmail: c.clientEmail.trim(),
      clientPhone: c.clientPhone.trim() || undefined,
      clientCompany: c.clientCompany.trim() || undefined,
    })),
    lineItems: lineItemsBody(lines),
    taxRate: Math.round(num(o.taxRate) * 100),
    dueDate: o.dueDate,
    notes: o.notes.trim() || undefined,
    terms: o.terms.trim() || undefined,
    currency: o.currency,
    sendImmediately,
    reminderConfig: reminderConfig(o.reminders),
  };
}

// ─── The list's numbers ────────────────────────────────────

/** Sum of cents across invoices, in words: one currency → "$1,234.00", mixed → "3 currencies". */
export function sumLabel(list: Invoice[], cents: (i: Invoice) => number): string {
  const currencies = new Set(list.map((i) => i.currency || "usd"));
  if (currencies.size > 1) return `in ${currencies.size} currencies`;
  return money(list.reduce((s, i) => s + cents(i), 0), [...currencies][0] ?? "usd");
}

export function summarize(list: Invoice[]) {
  const open = list.filter((i) => OPEN.has(i.status));
  const paid = list.filter((i) => i.status === "paid");
  const overdue = list.filter((i) => i.status === "overdue");
  return {
    total: list.length,
    drafts: list.filter((i) => i.status === "draft").length,
    outstanding: open.length,
    outstandingLabel: open.length ? sumLabel(open, (i) => i.balanceDue) : null,
    paid: paid.length,
    paidLabel: paid.length ? sumLabel(paid, (i) => i.total) : null,
    overdue: overdue.length,
    overdueLabel: overdue.length ? sumLabel(overdue, (i) => i.balanceDue) : null,
  };
}
