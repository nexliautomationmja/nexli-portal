import { db } from "@/db";
import { invoices, engagements, engagementSigners } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Book of business for any tenant: signed engagements + paid invoices owned
 * by `ownerId`. A person becomes a "client" once they have a signed engagement
 * AND at least one paid invoice. Used for Marcel's own Client Tracker and,
 * with a client's user id, for the drill-down into that client's dashboard.
 *
 * Revenue vs pass-through: DRS invoices carry `metadata.adSpendCents`, the
 * Managed Advertising Budget included in that invoice's total (set in
 * digital-rainmaker.ts, copied to recurring children by the invoice cron).
 * That portion is deployed on the client's ad accounts, so it is reported
 * separately as `adSpendCollected` and excluded from `revenue` and `mrr`.
 */

export interface BookRow {
  email: string;
  name: string;
  company: string | null;
  /** DRS billing plan, or "enterprise" when the latest signed letter is a Nexli Enterprise License. */
  billingPlan: "monthly" | "annual" | "enterprise" | null;
  signedAt: string | null;
  /** Day the client started: the DRS engagement's execution date (fallbacks: any signed engagement, first payment). */
  startDate: string | null;
  /** Next contract-year anniversary after today — when the Success Bonus is billable (drs-pricing.ts SUCCESS_BONUS). */
  contractYearEnd: string | null;
  /** Initial contract term snapshotted on the DRS engagement (6 monthly / 12 annual); null for engagements signed before terms existed. */
  termMonths: number | null;
  /** End of the initial term (startDate + termMonths); null when unknown. */
  termEnd: string | null;
  dealsCount: number;
  /** Platform revenue actually collected — ad-budget pass-through excluded. */
  revenue: number;
  /** Managed Advertising Budget collected so far (pass-through, not revenue). */
  adSpendCollected: number;
  /** Monthly recurring platform revenue — ad budget excluded. */
  mrr: number;
  outstanding: number;
  lastPaymentAt: string | null;
  status: "active" | "signed";
}

export interface BookKpis {
  totalClients: number;
  totalDeals: number;
  totalRevenue: number;
  totalAdSpend: number;
  totalMrr: number;
  totalOutstanding: number;
}

// The end of the client's current contract year: start date + whole years,
// rolled forward until it lands after `now`. Contract years are 12 months
// from the engagement's effective date (engagement letter Section 3(c)).
export function nextContractYearEnd(start: Date, now: Date = new Date()): Date {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  while (end.getTime() <= now.getTime()) {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

/** `start` plus a whole number of months (end of the initial term). */
export function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Monthly-equivalent revenue for a recurring invoice, in cents.
function monthlyEquivalent(total: number, interval: string | null): number {
  switch (interval) {
    case "weekly":
      return Math.round((total * 52) / 12);
    case "biweekly":
      return Math.round((total * 26) / 12);
    case "monthly":
      return total;
    case "quarterly":
      return Math.round(total / 3);
    case "yearly":
      return Math.round(total / 12);
    default:
      return 0;
  }
}

/** Pass-through ad budget carried in an invoice's metadata, clamped to [0, total]. */
function adSpendOf(metadata: unknown, total: number): number {
  const raw = (metadata as { adSpendCents?: unknown } | null)?.adSpendCents;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), Math.max(total, 0));
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

interface InvoiceRollup {
  name: string | null;
  company: string | null;
  /** Collected net of ad budget. */
  netPaid: number;
  adSpendPaid: number;
  outstanding: number;
  lastPaymentAt: string | null;
  firstPaymentAt: string | null;
  mrr: number;
}

export async function getBookOfBusiness(
  ownerId: string
): Promise<{ kpis: BookKpis; clients: BookRow[] }> {
  const now = Date.now();

  // 1. Signed engagements (deals closed) by client email, with the plan and
  //    term from the most recently signed engagement.
  const signedRows = await db
    .select({
      email: engagementSigners.email,
      name: sql<string>`MAX(${engagementSigners.name})`,
      dealsCount: sql<number>`COUNT(DISTINCT ${engagementSigners.engagementId})::int`,
      firstSignedAt: sql<string | null>`MIN(${engagementSigners.signedAt})`,
      // Execution date of the Digital Rainmaker engagement specifically
      // (DRS letters snapshot metadata.billingPlan at compose time).
      drsSignedAt: sql<
        string | null
      >`MIN(${engagementSigners.signedAt}) FILTER (WHERE ${engagements.metadata}->>'billingPlan' IS NOT NULL)`,
      latestPlan: sql<
        string | null
      >`(ARRAY_AGG(${engagements.metadata}->>'billingPlan' ORDER BY ${engagementSigners.signedAt} DESC NULLS LAST))[1]`,
      latestTerm: sql<
        number | null
      >`(ARRAY_AGG((${engagements.metadata}->>'termMonths')::int ORDER BY ${engagementSigners.signedAt} DESC NULLS LAST))[1]`,
      // Offer of the most recently signed engagement ("enterprise" for the
      // Nexli Enterprise License; DRS letters leave it unset).
      latestOffer: sql<
        string | null
      >`(ARRAY_AGG(${engagements.metadata}->>'offer' ORDER BY ${engagementSigners.signedAt} DESC NULLS LAST))[1]`,
    })
    .from(engagementSigners)
    .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagementSigners.order} > 0`, // exclude the sender (order 0)
        eq(engagementSigners.status, "signed")
      )
    )
    .groupBy(engagementSigners.email);

  // 2. Every invoice for this owner, rolled up per client email in JS so the
  //    ad-budget portion of each invoice can be split out pro rata.
  const invoiceRows = await db
    .select({
      email: invoices.clientEmail,
      name: invoices.clientName,
      company: invoices.clientCompany,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      paidAt: invoices.paidAt,
      metadata: invoices.metadata,
      isRecurring: invoices.isRecurring,
      recurringInterval: invoices.recurringInterval,
      recurringEndDate: invoices.recurringEndDate,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId));

  const invoiceMap = new Map<string, InvoiceRollup>();
  for (const r of invoiceRows) {
    const roll =
      invoiceMap.get(r.email) ??
      ({
        name: null,
        company: null,
        netPaid: 0,
        adSpendPaid: 0,
        outstanding: 0,
        lastPaymentAt: null,
        firstPaymentAt: null,
        mrr: 0,
      } as InvoiceRollup);
    roll.name = roll.name || r.name || null;
    roll.company = roll.company || r.company || null;

    const total = r.total || 0;
    const adSpend = adSpendOf(r.metadata, total);
    const paidRatio = total > 0 ? Math.min((r.amountPaid || 0) / total, 1) : 0;
    const adPaid = Math.round(adSpend * paidRatio);
    roll.adSpendPaid += adPaid;
    roll.netPaid += (r.amountPaid || 0) - adPaid;
    roll.outstanding += r.balanceDue || 0;

    const paidAt = iso(r.paidAt);
    if (paidAt) {
      if (!roll.lastPaymentAt || paidAt > roll.lastPaymentAt) roll.lastPaymentAt = paidAt;
      if (!roll.firstPaymentAt || paidAt < roll.firstPaymentAt) roll.firstPaymentAt = paidAt;
    }

    // MRR: active recurring parents only, platform portion only.
    if (
      r.isRecurring &&
      r.status !== "canceled" &&
      r.status !== "void" &&
      r.status !== "draft" &&
      !(r.recurringEndDate && new Date(r.recurringEndDate).getTime() < now)
    ) {
      roll.mrr += monthlyEquivalent(total - adSpend, r.recurringInterval);
    }
    invoiceMap.set(r.email, roll);
  }

  // A client = has a signed engagement AND at least one paid invoice.
  const clients: BookRow[] = signedRows
    .map((sg) => {
      const inv = invoiceMap.get(sg.email);
      const mrr = inv?.mrr || 0;
      const startDate =
        sg.drsSignedAt || sg.firstSignedAt || inv?.firstPaymentAt || null;
      const contractYearEnd = startDate
        ? nextContractYearEnd(new Date(startDate), new Date(now)).toISOString()
        : null;
      const termMonths =
        typeof sg.latestTerm === "number" && sg.latestTerm > 0 ? sg.latestTerm : null;
      const termEnd =
        startDate && termMonths ? addMonths(new Date(startDate), termMonths).toISOString() : null;
      const billingPlan: BookRow["billingPlan"] =
        sg.latestOffer === "enterprise"
          ? "enterprise"
          : (sg.latestPlan as "monthly" | "annual" | null) || null;
      return {
        email: sg.email,
        name: inv?.name || sg.name || sg.email.split("@")[0],
        company: inv?.company || null,
        billingPlan,
        signedAt: sg.firstSignedAt,
        startDate,
        contractYearEnd,
        termMonths,
        termEnd,
        dealsCount: sg.dealsCount,
        revenue: inv?.netPaid || 0,
        adSpendCollected: inv?.adSpendPaid || 0,
        mrr,
        outstanding: inv?.outstanding || 0,
        lastPaymentAt: inv?.lastPaymentAt || null,
        status: (mrr > 0 ? "active" : "signed") as "active" | "signed",
      };
    })
    .filter((c) => c.revenue > 0 || c.adSpendCollected > 0);

  clients.sort((a, b) => b.revenue - a.revenue);

  const kpis: BookKpis = {
    totalClients: clients.length,
    totalDeals: clients.reduce((s, c) => s + c.dealsCount, 0),
    totalRevenue: clients.reduce((s, c) => s + c.revenue, 0),
    totalAdSpend: clients.reduce((s, c) => s + c.adSpendCollected, 0),
    totalMrr: clients.reduce((s, c) => s + c.mrr, 0),
    totalOutstanding: clients.reduce((s, c) => s + c.outstanding, 0),
  };

  return { kpis, clients };
}
