import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getBookOfBusiness } from "@/lib/book-of-business";
import {
  latestSurveyStatus,
  latestUpdateStatus,
  type SurveyStatus,
  type UpdateStatus,
} from "@/lib/client-success";

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
  let npsByAccount = new Map<string, SurveyStatus>();
  let updateByAccount = new Map<string, UpdateStatus>();

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

      // Latest pulse-check survey + weekly-update status per linked client.
      // Never fatal — the roster must render even if the success tables
      // aren't there yet.
      try {
        const ids = accounts.map((a) => a.id);
        // "Client since" lets a brand-new client show "New client" instead
        // of "Never sent" until their first week is up.
        const clientSince = new Map<string, Date | null>();
        for (const c of book) {
          const account = linkByEmail.get(c.email.toLowerCase());
          if (account) clientSince.set(account.id, c.startDate ? new Date(c.startDate) : null);
        }
        [npsByAccount, updateByAccount] = await Promise.all([
          latestSurveyStatus(ids),
          latestUpdateStatus(ids, { clientSince }),
        ]);
      } catch (err) {
        console.error("Client tracker: customer-success status unavailable:", err);
      }
    }
  }

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

  const clients = book.map((c) => {
    const account = linkByEmail.get(c.email.toLowerCase()) || null;
    const survey = account ? npsByAccount.get(account.id) : undefined;
    const update = account ? updateByAccount.get(account.id) : undefined;
    return {
      ...c,
      clientUserId: account?.id ?? null,
      websiteUrl: account?.websiteUrl ?? null,
      theirRevenue: account ? theirRevenueByOwner.get(account.id) || 0 : null,
      // Biweekly NPS survey: the newest one SENT and what came of it. Linked
      // accounts with no sent survey yet are "not_sent"; unlinked rows null.
      nps: account
        ? {
            score: survey?.npsScore ?? null,
            legacyScore: survey?.legacyScore ?? null,
            sentAt: iso(survey?.sentAt),
            answeredAt: iso(survey?.submittedAt),
            expiresAt: iso(survey?.expiresAt),
            state: survey?.state ?? ("not_sent" as const),
          }
        : null,
      // Weekly update: when the last one went out and whether one is due.
      update: account && update
        ? {
            lastSentAt: iso(update.lastSentAt),
            lastViewedAt: iso(update.lastViewedAt),
            daysSinceSent: update.daysSinceSent,
            state: update.state,
          }
        : null,
    };
  });

  const dueClients = clients
    .filter((c) => c.update && (c.update.state === "due" || c.update.state === "overdue" || c.update.state === "never"))
    .map((c) => ({ name: c.company || c.name || c.email, clientUserId: c.clientUserId as string }));

  return NextResponse.json({
    kpis: {
      ...kpis,
      totalClientRevenue: clients.reduce((s, c) => s + (c.theirRevenue || 0), 0),
      updatesDue: dueClients.length,
    },
    dueClients,
    clients,
    isAdmin,
  });
}
