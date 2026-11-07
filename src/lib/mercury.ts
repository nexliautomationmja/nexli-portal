import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { isBankTransferInvoiceMeta } from "@/lib/drs-pricing";
import { mercuryConfigured } from "@/lib/bank-transfer";
import { getNexliAdminId } from "@/lib/foundation-project";
import { createNotification } from "@/lib/notifications";
import { ensureMercuryTables, mercurySync, mercuryTransactions } from "@/lib/mercury-tables";
import { matchCredit, type OpenInvoice } from "@/lib/mercury-match";
import { settleDateLabel, settleInvoicePayment } from "@/lib/invoice-settle";

/**
 * Up-front invoices (DRS setup $32K, annual $74K, annual renewals, Enterprise)
 * are paid by bank transfer straight into Nexli's Mercury account — no card
 * or ACH processor (Nov 7 2026, Marcel). The invoice page shows the account
 * details; this module reads Mercury's API with a READ-ONLY token (no IP
 * allowlist needed) every 10 minutes, matches incoming credits to open
 * invoices and marks them paid. Monthly invoices stay on Stripe.
 *
 * Env (Vercel):
 *   MERCURY_API_TOKEN     read-only token (Mercury → Settings → Tokens). Unset = feature off: these invoices use Stripe as before.
 *   MERCURY_ACCOUNT_ID    the account clients pay into (optional when Mercury has a single account)
 *   MERCURY_BANK_NAME     ┐ wire instructions, copied from Mercury → Account details → Wire;
 *   MERCURY_BANK_ADDRESS  │ the Wire tab only shows when these are set
 *   NEXLI_REMIT_ADDRESS   ┘ (Nexli's address as the wire beneficiary)
 */

const BASE = "https://api.mercury.com/api/v1";

export class MercuryError extends Error {}

export { mercuryConfigured, usesBankTransfer } from "@/lib/bank-transfer";

async function mercury<T>(path: string): Promise<T> {
  const token = process.env.MERCURY_API_TOKEN?.trim();
  if (!token) throw new MercuryError("MERCURY_API_TOKEN isn't set");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new MercuryError(`Couldn't reach Mercury: ${err instanceof Error ? err.message : "network error"}`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      throw new MercuryError(`Mercury refused the token (${res.status}). Create a new read-only token and update MERCURY_API_TOKEN.`);
    }
    throw new MercuryError(`Mercury API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

// ── Account ───────────────────────────────────────────────────────────

interface MercuryAccount {
  id: string;
  accountNumber: string;
  routingNumber: string;
  name: string;
  nickname?: string | null;
  status: string;
  type: string;
  kind: string;
  canReceiveTransactions?: boolean | null;
  legalBusinessName: string;
}

export type ReceivingAccount = {
  id: string;
  name: string;
  legalBusinessName: string;
  accountNumber: string;
  routingNumber: string;
};

const last4 = (n: string) => n.slice(-4);
export const accountLabel = (a: { name: string; accountNumber: string }) => `${a.name} ••${last4(a.accountNumber)}`;

let accountCache: { at: number; account: ReceivingAccount } | null = null;

/** Mercury's own accounts that can take incoming money. */
async function receivingCandidates(): Promise<MercuryAccount[]> {
  const { accounts } = await mercury<{ accounts: MercuryAccount[] }>("/accounts");
  return accounts.filter((a) => a.type === "mercury" && a.status === "active" && a.canReceiveTransactions !== false);
}

/** The account clients pay into (MERCURY_ACCOUNT_ID, or the only one). Cached for an hour. */
export async function getReceivingAccount(): Promise<ReceivingAccount> {
  if (accountCache && Date.now() - accountCache.at < 3_600_000) return accountCache.account;
  const candidates = await receivingCandidates();
  const wanted = process.env.MERCURY_ACCOUNT_ID?.trim();
  const pick = wanted ? candidates.find((a) => a.id === wanted) : candidates.length === 1 ? candidates[0] : undefined;
  if (!pick) {
    const list = candidates.map((a) => `${accountLabel({ name: a.nickname || a.name, accountNumber: a.accountNumber })} = ${a.id}`).join("; ");
    throw new MercuryError(
      wanted
        ? `MERCURY_ACCOUNT_ID doesn't match an active Mercury account. Accounts: ${list || "none"}`
        : `Mercury has ${candidates.length} accounts. Set MERCURY_ACCOUNT_ID to the one clients pay into: ${list || "none"}`
    );
  }
  const account: ReceivingAccount = {
    id: pick.id,
    name: pick.nickname || pick.name,
    legalBusinessName: pick.legalBusinessName,
    accountNumber: pick.accountNumber,
    routingNumber: pick.routingNumber,
  };
  accountCache = { at: Date.now(), account };
  return account;
}

export interface RemitDetails {
  beneficiary: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "Checking";
  /** Null when the wire env vars aren't set: only ACH details are shown. */
  wire: { bankName: string; bankAddress: string; beneficiaryAddress: string | null } | null;
}

/** What the invoice page shows. Falls back to the last account the sync saw if Mercury is unreachable. */
export async function remitDetails(): Promise<RemitDetails | null> {
  let account: ReceivingAccount | null = null;
  try {
    account = await getReceivingAccount();
  } catch (err) {
    console.error("[mercury] account lookup failed:", err instanceof Error ? err.message : err);
    await ensureMercuryTables();
    const [row] = await db.select({ account: mercurySync.account }).from(mercurySync).where(eq(mercurySync.id, 1)).limit(1);
    account = row?.account ?? null;
  }
  if (!account) return null;
  const bankName = process.env.MERCURY_BANK_NAME?.trim();
  const bankAddress = process.env.MERCURY_BANK_ADDRESS?.trim();
  return {
    beneficiary: account.legalBusinessName,
    routingNumber: account.routingNumber,
    accountNumber: account.accountNumber,
    accountType: "Checking",
    wire:
      bankName && bankAddress
        ? { bankName, bankAddress, beneficiaryAddress: process.env.NEXLI_REMIT_ADDRESS?.trim() || null }
        : null,
  };
}

// ── Which invoices ────────────────────────────────────────────────────

async function openBankTransferInvoices(): Promise<OpenInvoice[]> {
  const adminId = await getNexliAdminId();
  if (!adminId) return [];
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.ownerId, adminId), inArray(invoices.status, ["sent", "viewed", "overdue", "partial"]), gt(invoices.balanceDue, 0)));
  return rows
    .filter((r) => isBankTransferInvoiceMeta(r.metadata))
    .map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      balanceDueCents: r.balanceDue,
      clientName: r.clientName,
      clientCompany: r.clientCompany,
      issueDate: r.issueDate,
    }));
}

// ── Sync ──────────────────────────────────────────────────────────────

interface MercuryTransaction {
  id: string;
  amount: number;
  status: string;
  kind: string;
  counterpartyName?: string | null;
  bankDescription?: string | null;
  externalMemo?: string | null;
  postedAt?: string | null;
  createdAt: string;
}

/** Ways a client can send money in. Everything else (card refunds, interest, internal moves) is ignored. */
const INCOMING_KINDS = new Set(["externalTransfer", "incomingDomesticWire", "incomingInternationalWire", "checkDeposit", "other"]);

export interface SyncResult {
  creditsSeen: number;
  matched: string[];
  review: number;
}

/** Throttle for page-triggered syncs ("I've sent the transfer", "Check now"). */
export async function recentlySynced(withinMs: number): Promise<boolean> {
  await ensureMercuryTables();
  const [row] = await db.select({ lastRunAt: mercurySync.lastRunAt }).from(mercurySync).where(eq(mercurySync.id, 1)).limit(1);
  return Boolean(row?.lastRunAt && Date.now() - row.lastRunAt.getTime() < withinMs);
}

async function saveSyncState(fields: Partial<typeof mercurySync.$inferInsert>) {
  await db
    .insert(mercurySync)
    .values({ id: 1, ...fields })
    .onConflictDoUpdate({ target: mercurySync.id, set: fields });
}

/**
 * Read the last 35 days of incoming money, and look at each new credit once:
 * apply it to its invoice, queue it for review, or ignore it. Safe to run
 * concurrently (each transaction is claimed by inserting its row first).
 */
export async function syncMercury(): Promise<SyncResult> {
  await ensureMercuryTables();
  const startedAt = new Date();
  try {
    const account = await getReceivingAccount();
    const since = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
    const credits: MercuryTransaction[] = [];
    for (let page = 0; page < 5; page++) {
      const q = new URLSearchParams({ start: since, status: "sent", limit: "1000", offset: String(page * 1000), order: "asc" });
      const { transactions } = await mercury<{ transactions: MercuryTransaction[] }>(`/account/${account.id}/transactions?${q}`);
      credits.push(...transactions.filter((t) => t.amount > 0));
      if (transactions.length < 1000) break;
    }

    const known = new Set<string>();
    for (let i = 0; i < credits.length; i += 500) {
      const ids = credits.slice(i, i + 500).map((t) => t.id);
      if (ids.length === 0) continue;
      const rows = await db.select({ id: mercuryTransactions.id }).from(mercuryTransactions).where(inArray(mercuryTransactions.id, ids));
      rows.forEach((r) => known.add(r.id));
    }
    const fresh = credits.filter((t) => !known.has(t.id));

    const result: SyncResult = { creditsSeen: credits.length, matched: [], review: 0 };
    let open = fresh.length > 0 ? await openBankTransferInvoices() : [];
    for (const t of fresh) {
      const amountCents = Math.round(t.amount * 100);
      const receivedAt = new Date(t.postedAt || t.createdAt);
      const match = INCOMING_KINDS.has(t.kind)
        ? matchCredit({ amountCents, counterpartyName: t.counterpartyName ?? null, memo: t.externalMemo ?? null, bankDescription: t.bankDescription ?? null, receivedAt }, open)
        : ({ action: "ignore", reason: `Not a client payment (${t.kind})` } as const);

      // Claim the transaction: whoever inserts its row handles it.
      const [claimed] = await db
        .insert(mercuryTransactions)
        .values({
          id: t.id,
          accountId: account.id,
          amountCents,
          kind: t.kind,
          status: t.status,
          counterpartyName: t.counterpartyName ?? null,
          externalMemo: t.externalMemo ?? null,
          bankDescription: t.bankDescription ?? null,
          postedAt: receivedAt,
          // An auto match is stored as review until the payment is actually applied, so a
          // failure part-way leaves it on Marcel's list instead of looking handled.
          matchStatus: match.action === "ignore" ? "ignored" : "review",
          suggestedInvoiceIds: match.action === "review" ? match.suggestions : match.action === "apply" ? [match.invoiceId] : null,
          reason: match.reason,
        })
        .onConflictDoNothing()
        .returning({ id: mercuryTransactions.id });
      if (!claimed) continue;

      if (match.action === "apply") {
        const settled = await applyCredit(match.invoiceId, t.id, "auto").catch((err) => {
          console.error("[mercury] applying a payment failed:", err instanceof Error ? err.message : err);
          return null;
        });
        if (settled) {
          result.matched.push(settled.invoice.invoiceNumber);
          open = open
            .map((inv) => (inv.id === match.invoiceId ? { ...inv, balanceDueCents: settled.invoice.balanceDue } : inv))
            .filter((inv) => inv.balanceDueCents > 0);
        } else {
          // The invoice changed underneath us (paid by hand a moment ago?) or applying
          // failed: it stays on the review list for Marcel.
          await db
            .update(mercuryTransactions)
            .set({ reason: `${match.reason} — couldn't apply it automatically`, updatedAt: new Date() })
            .where(eq(mercuryTransactions.id, t.id));
          result.review++;
          await notifyReview(amountCents, t.counterpartyName ?? null);
        }
      } else if (match.action === "review") {
        result.review++;
        await notifyReview(amountCents, t.counterpartyName ?? null);
      }
    }

    await saveSyncState({ lastRunAt: startedAt, lastOkAt: new Date(), lastError: null, creditsSeen: credits.length, account });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mercury sync failed";
    await saveSyncState({ lastRunAt: startedAt, lastError: message.slice(0, 500) }).catch(() => {});
    throw err;
  }
}

/**
 * Apply a stored Mercury credit to an invoice (automatically or by Marcel
 * from the review list). Marks the invoice paid or partial and records the
 * transaction on it.
 */
export async function applyCredit(invoiceId: string, transactionId: string, by: "auto" | "admin") {
  await ensureMercuryTables();
  // Take it off the review list first, so the same money can never be applied twice.
  const [t] = await db
    .update(mercuryTransactions)
    .set({ matchStatus: "applying", updatedAt: new Date() })
    .where(and(eq(mercuryTransactions.id, transactionId), eq(mercuryTransactions.matchStatus, "review")))
    .returning();
  if (!t) return null;
  const from = t.counterpartyName ? ` from ${t.counterpartyName}` : "";
  try {
    const settled = await settleInvoicePayment({
      invoiceId,
      amountCents: t.amountCents,
      method: "bank_transfer",
      noteLine: `Payment received by bank transfer on ${settleDateLabel(t.postedAt ?? new Date())}${from}.`,
      payment: { source: "mercury", mercuryTransactionId: t.id, counterpartyName: t.counterpartyName, memo: t.externalMemo, matchedBy: by },
    });
    await db
      .update(mercuryTransactions)
      .set(settled ? { matchStatus: "matched", matchedBy: by, invoiceId, updatedAt: new Date() } : { matchStatus: "review", updatedAt: new Date() })
      .where(eq(mercuryTransactions.id, t.id));
    return settled;
  } catch (err) {
    await db.update(mercuryTransactions).set({ matchStatus: "review", updatedAt: new Date() }).where(eq(mercuryTransactions.id, t.id));
    throw err;
  }
}

async function notifyReview(amountCents: number, from: string | null) {
  const adminId = await getNexliAdminId();
  if (!adminId) return;
  await createNotification({
    userId: adminId,
    type: "bank_transfer_review",
    title: "A bank transfer needs a look",
    message: `${(amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}${from ? ` from ${from}` : ""} arrived in Mercury but couldn't be matched to an invoice with certainty. Open Invoices → Needs review.`,
  }).catch((err) => console.error("[mercury] review notification failed:", err));
}

// ── Admin status ──────────────────────────────────────────────────────

export interface MercuryStatus {
  configured: boolean;
  account: string | null;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  creditsSeen: number | null;
  review: {
    id: string;
    amountCents: number;
    counterpartyName: string | null;
    memo: string | null;
    postedAt: string | null;
    reason: string | null;
    suggestions: { id: string; invoiceNumber: string; clientName: string; clientCompany: string | null; balanceDueCents: number }[];
  }[];
  /** Every open bank-transfer invoice, for "apply to a different invoice". */
  openInvoices: { id: string; invoiceNumber: string; clientName: string; clientCompany: string | null; balanceDueCents: number }[];
}

export async function mercuryStatus(): Promise<MercuryStatus> {
  if (!mercuryConfigured()) {
    return { configured: false, account: null, lastRunAt: null, lastOkAt: null, lastError: null, creditsSeen: null, review: [], openInvoices: [] };
  }
  await ensureMercuryTables();
  const [sync] = await db.select().from(mercurySync).where(eq(mercurySync.id, 1)).limit(1);
  const reviewRows = await db
    .select()
    .from(mercuryTransactions)
    .where(eq(mercuryTransactions.matchStatus, "review"))
    .orderBy(desc(mercuryTransactions.postedAt))
    .limit(50);
  const open = await openBankTransferInvoices();
  const toOption = (inv: OpenInvoice) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    balanceDueCents: inv.balanceDueCents,
  });
  return {
    configured: true,
    account: sync?.account ? accountLabel(sync.account) : null,
    lastRunAt: sync?.lastRunAt?.toISOString() ?? null,
    lastOkAt: sync?.lastOkAt?.toISOString() ?? null,
    lastError: sync?.lastError ?? null,
    creditsSeen: sync?.creditsSeen ?? null,
    review: reviewRows.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      counterpartyName: r.counterpartyName,
      memo: r.externalMemo || r.bankDescription,
      postedAt: r.postedAt?.toISOString() ?? null,
      reason: r.reason,
      suggestions: (r.suggestedInvoiceIds ?? []).map((id) => open.find((o) => o.id === id)).filter((o): o is OpenInvoice => Boolean(o)).map(toOption),
    })),
    openInvoices: open.map(toOption),
  };
}

/** "Not an invoice payment": drop it from the review list. */
export async function dismissCredit(transactionId: string) {
  await ensureMercuryTables();
  await db
    .update(mercuryTransactions)
    .set({ matchStatus: "ignored", reason: "Dismissed by admin", updatedAt: new Date() })
    .where(and(eq(mercuryTransactions.id, transactionId), eq(mercuryTransactions.matchStatus, "review")));
}
