import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getBookOfBusiness } from "@/lib/book-of-business";

/**
 * Client Tracker — internal book of business, built entirely from the owner's
 * own signed engagements + paid invoices (no GoHighLevel). A person becomes a
 * "client" once they have a signed engagement AND at least one paid invoice.
 *
 * For admins, each row is also matched (by email) to a client dashboard
 * account when one exists, and reports THAT tenant's collected revenue —
 * what the client is earning from their own clients, as opposed to what
 * they pay us.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kpis, clients: book } = await getBookOfBusiness(session.user.id);

  // Cross-tenant enrichment (linked dashboards + their revenue) is admin-only.
  const isAdmin = session.user.role === "admin";
  const linkByEmail = new Map<string, { id: string; websiteUrl: string | null }>();
  const theirRevenueByOwner = new Map<string, number>();

  if (isAdmin && book.length > 0) {
    // Client accounts are few; match in JS so the email join is
    // case-insensitive (signer emails are stored verbatim).
    const bookEmails = new Set(book.map((c) => c.email.toLowerCase()));
    const accounts = (
      await db
        .select({ id: users.id, email: users.email, websiteUrl: users.websiteUrl })
        .from(users)
        .where(eq(users.role, "client"))
    ).filter((a) => bookEmails.has(a.email.toLowerCase()));
    for (const a of accounts) linkByEmail.set(a.email.toLowerCase(), a);

    if (accounts.length > 0) {
      const revenueRows = await db
        .select({
          ownerId: invoices.ownerId,
          totalPaid: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)::int`,
        })
        .from(invoices)
        .where(
          inArray(
            invoices.ownerId,
            accounts.map((a) => a.id)
          )
        )
        .groupBy(invoices.ownerId);
      for (const r of revenueRows) theirRevenueByOwner.set(r.ownerId, r.totalPaid);
    }
  }

  const clients = book.map((c) => {
    const account = linkByEmail.get(c.email.toLowerCase()) || null;
    return {
      ...c,
      clientUserId: account?.id ?? null,
      websiteUrl: account?.websiteUrl ?? null,
      theirRevenue: account ? theirRevenueByOwner.get(account.id) || 0 : null,
    };
  });

  return NextResponse.json({
    kpis: {
      ...kpis,
      totalClientRevenue: clients.reduce((s, c) => s + (c.theirRevenue || 0), 0),
    },
    clients,
    isAdmin,
  });
}
