import { and, eq, gt, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { adSpendOf, getBookOfBusiness } from "@/lib/book-of-business";
import { getNexliAdminId } from "@/lib/foundation-project";
import { DRS_PRICING } from "@/lib/drs-pricing";
import { div } from "@/lib/ads/math";
import type { Business } from "@/lib/ads/types";

/**
 * New clients and the cash they paid in a window, with CAC and cash ROAS.
 * The same rules as the Overview's business tiles (copied, not imported, so
 * the Overview stays untouched): start date in the window = new client; ad
 * budget passed through on invoices isn't cash earned.
 */
export interface BusinessCounts {
  newClients: number;
  cashCents: number;
}

export async function businessCounts(ownerId: string, since: Date, until: Date): Promise<BusinessCounts> {
  const adminId = (await getNexliAdminId().catch(() => null)) ?? ownerId;
  const { clients } = await getBookOfBusiness(adminId);
  const fresh = clients.filter((c) => {
    if (!c.startDate) return false;
    const t = new Date(c.startDate).getTime();
    return t >= since.getTime() && t < until.getTime();
  });
  let cashCents = 0;
  if (fresh.length) {
    const emails = new Set(fresh.map((c) => c.email.toLowerCase().trim()));
    const paid = await db
      .select({ email: invoices.clientEmail, total: invoices.total, amountPaid: invoices.amountPaid, metadata: invoices.metadata })
      .from(invoices)
      .where(and(eq(invoices.ownerId, adminId), isNotNull(invoices.paidAt), gte(invoices.paidAt, since), lte(invoices.paidAt, until), gt(invoices.amountPaid, 0)));
    for (const r of paid) {
      if (!emails.has((r.email || "").toLowerCase().trim())) continue;
      const total = r.total || 0;
      const amountPaid = r.amountPaid || 0;
      const ratio = total > 0 ? Math.min(amountPaid / total, 1) : 0;
      cashCents += amountPaid - Math.round(adSpendOf(r.metadata, total) * ratio);
    }
  }
  return { newClients: fresh.length, cashCents };
}

/** CAC, close rate, setup coverage and cash ROAS from the counts and the window's spend. */
export function toBusiness(c: BusinessCounts, spendCents: number, booked: number | null): Business {
  const cac = div(spendCents, c.newClients);
  return {
    newClients: c.newClients,
    cashCents: c.cashCents,
    cacCents: cac === null ? null : Math.round(cac),
    closeRate: booked ? div(c.newClients, booked) : null,
    setupCoverage: cac && cac > 0 ? DRS_PRICING.SETUP_FEE_CENTS / cac : null,
    cashRoas: div(c.cashCents, spendCents),
  };
}
