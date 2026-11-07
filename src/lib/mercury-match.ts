/**
 * Which open invoice (if any) an incoming bank transfer pays. Pure, so it's
 * unit-testable; lib/mercury.ts feeds it Mercury credits and open
 * bank-transfer invoices.
 *
 * Money is only applied automatically when the amount is exact AND there is
 * real evidence it's that client's payment: the invoice number in the memo,
 * or the sender's name matching the client. Anything plausible but less
 * certain (partial payment, two invoices for the same amount, a payment from
 * an entity with a different name) goes to Marcel's review list instead.
 */

export interface Credit {
  amountCents: number;
  counterpartyName: string | null;
  memo: string | null;
  bankDescription: string | null;
  receivedAt: Date;
}

export interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  balanceDueCents: number;
  clientName: string;
  clientCompany: string | null;
  issueDate: Date;
}

export type MatchResult =
  | { action: "apply"; invoiceId: string; reason: string }
  | { action: "review"; suggestions: string[]; reason: string }
  | { action: "ignore"; reason: string };

const DAY_MS = 86_400_000;

/** Words too common in business names to prove anything. */
const STOPWORDS = new Set([
  "LLC", "INC", "PLLC", "LLP", "LTD", "CORP", "CORPORATION", "COMPANY", "THE", "AND", "GROUP",
  "CPA", "CPAS", "TAX", "TAXES", "ACCOUNTING", "ACCOUNTANTS", "ADVISORS", "ADVISORY", "FINANCIAL",
  "WEALTH", "PARTNERS", "ASSOCIATES", "SERVICES", "FIRM", "CONSULTING", "HOLDINGS", "BUSINESS",
  "BANK", "PAYMENT", "PAYMENTS", "TRANSFER", "WIRE", "ACH", "FROM", "FOR",
]);

function nameTokens(s: string | null | undefined): Set<string> {
  return new Set(
    (s ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  );
}

/** The sender shares a distinctive word with the client's name or company. */
export function nameResembles(counterparty: string | null, inv: Pick<OpenInvoice, "clientName" | "clientCompany">): boolean {
  const from = nameTokens(counterparty);
  if (from.size === 0) return false;
  const client = nameTokens(`${inv.clientName} ${inv.clientCompany ?? ""}`);
  for (const t of from) if (client.has(t)) return true;
  return false;
}

/** The memo mentions the invoice number ("INV-202611-0012", "INV2026110012" or "2026110012"). */
export function mentionsInvoice(text: string, invoiceNumber: string): boolean {
  const hay = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const full = invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = invoiceNumber.replace(/\D/g, "");
  return (full.length > 0 && hay.includes(full)) || (digits.length >= 8 && hay.includes(digits));
}

export function matchCredit(credit: Credit, open: OpenInvoice[]): MatchResult {
  if (credit.amountCents <= 0) return { action: "ignore", reason: "Not incoming money" };
  if (/stripe/i.test(credit.counterpartyName ?? "")) return { action: "ignore", reason: "Stripe payout" };

  // Only invoices that existed when the money arrived (a day of slack for time zones).
  const eligible = open.filter((inv) => inv.balanceDueCents > 0 && inv.issueDate.getTime() <= credit.receivedAt.getTime() + DAY_MS);
  if (eligible.length === 0) return { action: "ignore", reason: "No open bank-transfer invoices" };

  const text = `${credit.memo ?? ""} ${credit.bankDescription ?? ""}`;
  const exact = (inv: OpenInvoice) => inv.balanceDueCents === credit.amountCents;
  const named = (inv: OpenInvoice) => nameResembles(credit.counterpartyName, inv);

  const mentioned = eligible.filter((inv) => mentionsInvoice(text, inv.invoiceNumber));
  if (mentioned.length === 1) {
    const inv = mentioned[0];
    if (exact(inv)) return { action: "apply", invoiceId: inv.id, reason: `Memo names ${inv.invoiceNumber}` };
    return { action: "review", suggestions: [inv.id], reason: `Memo names ${inv.invoiceNumber} but the amount differs from its balance` };
  }
  if (mentioned.length > 1) {
    return { action: "review", suggestions: mentioned.map((i) => i.id), reason: "Memo names more than one invoice" };
  }

  const sameAmount = eligible.filter(exact);
  if (sameAmount.length > 0) {
    const sameAmountNamed = sameAmount.filter(named);
    if (sameAmountNamed.length === 1) {
      return { action: "apply", invoiceId: sameAmountNamed[0].id, reason: `Exact amount from ${credit.counterpartyName}` };
    }
    // Named first, then the rest.
    const ordered = [...sameAmountNamed, ...sameAmount.filter((i) => !sameAmountNamed.includes(i))];
    return {
      action: "review",
      suggestions: ordered.map((i) => i.id),
      reason:
        sameAmount.length === 1
          ? "Exact amount, but the sender's name doesn't match the client"
          : "More than one open invoice for this amount",
    };
  }

  const byName = eligible.filter(named);
  if (byName.length > 0) {
    return { action: "review", suggestions: byName.map((i) => i.id), reason: "Sender matches a client, but not the amount due" };
  }

  return { action: "ignore", reason: "Doesn't match an open invoice" };
}
