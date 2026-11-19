/**
 * Performance Pay (Nov 19 2026 pricing), server side.
 *
 * Marcel's rule: the portal works the 10% out from each firm's own portal
 * data, and shows for every converted prospect that Nexli's system brought
 * them in. So, per client firm on the new pricing:
 *
 *   1. LEADS — contacts in the firm's GoHighLevel location that came from a
 *      Meta ad since signing are saved with their proof (performance_leads).
 *   2. PAYING CLIENTS — the firm's own portal invoices. A payer is matched to
 *      a lead by email, then phone, then the firm's pipeline link; Marcel can
 *      link or leave out a client by hand (lib/performance/match.ts).
 *   3. AD SPEND — read from Meta for the firm's ad account (the ID from its
 *      Launch Pad) with the read-only token; if that account can't be read,
 *      the weekly updates' ad spend; else a figure Marcel types.
 *   4. STATEMENT — one per billing month (periods.ts): collected − ad spend =
 *      net; the letter's percentage of net, less the month's Agency Fee.
 *
 * A month that has ended gets a draft and Marcel is told (daily cron).
 * NOTHING is invoiced until he presses Send: the match rests on emails, so a
 * person checks it first. Sending freezes the statement and creates the
 * "performance_pay" invoice (lib/digital-rainmaker.ts).
 */

import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { clientWeeklyUpdates, engagementSigners, engagements, invoices, pipelineLeads, users } from "@/db/schema";
import { scanAdLeads } from "@/lib/ad-leads";
import { adsCreds, insights, newBudget, type Budget } from "@/lib/ads/graph";
import { setAutopayEnd } from "@/lib/autopay";
import {
  agencyEndForNotice,
  agencyTermState,
  agencyTermsOf,
  createDrsInvoices,
  drsPerformanceInvoiceSpec,
  getPrimaryClientSigner,
  isPerformanceEngagement,
} from "@/lib/digital-rainmaker";
import { AGENCY } from "@/lib/drs-pricing";
import type { PerformanceLetterTerms } from "@/lib/drs-performance-letter";
import { asFbAnswer } from "@/lib/fb-ads-setup";
import { getNexliAdminId } from "@/lib/foundation-project";
import { formatCurrency } from "@/lib/invoice-utils";
import { createNotification } from "@/lib/notifications";
import {
  matchPayers,
  normEmail,
  statementLines,
  statementTotals,
  sumCents,
  type ClientRule,
  type ExtraLine,
  type FirmInvoice,
  type Payer,
  type PerfLead,
  type PipelineLink,
} from "./match";
import { closedMonths, monthIndexAt, monthRange, periodLabel, ymd, type MonthRange } from "./periods";
import { ensurePerformanceTables, performanceClientRules, performanceLeads, performanceStatements, type StatementSnapshot } from "./tables";
import type { FirmStatementView, MonthView, PerformanceView, SpendSource } from "./view-types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Leads are re-read from the firm's CRM when the saved copy is older than this. */
const LEADS_STALE_MS = 6 * 60 * 60 * 1000;

/** A problem Marcel can act on (shown as is). */
export class PerformanceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type EngagementRow = typeof engagements.$inferSelect;
type StatementRow = typeof performanceStatements.$inferSelect;

export interface PerfContext {
  adminId: string;
  firm: { id: string; email: string; name: string; ghlLocationId: string | null };
  engagement: EngagementRow;
  terms: PerformanceLetterTerms;
  /** The signing date: Month 1 and the Initial Term begin here. */
  termStart: Date;
  /** The firm's Meta ad account (from its Launch Pad), digits only; null when it gave none. */
  adAccountId: string | null;
}

interface PerfMeta {
  termStartsAt?: string;
  billingStartedAt?: string;
  cancellation?: { noticeAt?: string; endsAt?: string };
  autopay?: { subscriptionId?: string; status?: string };
  onboarding?: { tasks?: Record<string, { submission?: unknown } | undefined> };
  performance?: { leadsSyncedAt?: string; leadsSyncError?: string | null };
}

const metaOf = (e: { metadata: unknown }): PerfMeta => (e.metadata ?? {}) as PerfMeta;

function contextFrom(
  adminId: string,
  firm: { id: string; email: string; name: string | null; companyName: string | null; ghlLocationId: string | null },
  engagement: EngagementRow
): PerfContext | null {
  if (!isPerformanceEngagement(engagement)) return null;
  const meta = metaOf(engagement);
  const termStart = meta.termStartsAt ? new Date(meta.termStartsAt) : null;
  if (!termStart || Number.isNaN(termStart.getTime())) return null;
  const fb = asFbAnswer(meta.onboarding?.tasks?.fb_ads_invite?.submission);
  return {
    adminId,
    firm: { id: firm.id, email: firm.email, name: firm.companyName || firm.name || firm.email, ghlLocationId: firm.ghlLocationId },
    engagement,
    terms: agencyTermsOf(engagement),
    termStart,
    adAccountId: fb?.adAccountId?.replace(/\D/g, "") || null,
  };
}

const FIRM_COLS = { id: users.id, email: users.email, name: users.name, companyName: users.companyName, ghlLocationId: users.ghlLocationId, role: users.role };

/**
 * The firm's engagement on the Nov 19 2026 pricing: owned by the Nexli
 * admin, fully signed, the firm's email among its signers. Null when the
 * firm isn't on that pricing (or hasn't finished signing).
 */
export async function performanceContextFor(firmUserId: string): Promise<PerfContext | null> {
  const adminId = await getNexliAdminId();
  if (!adminId) return null;
  const [firm] = await db.select(FIRM_COLS).from(users).where(eq(users.id, firmUserId)).limit(1);
  if (!firm || firm.role !== "client") return null;
  const rows = await db
    .select({ engagement: engagements })
    .from(engagements)
    .innerJoin(engagementSigners, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, adminId),
        eq(engagements.status, "signed"),
        sql`${engagementSigners.order} > 0`,
        sql`lower(trim(${engagementSigners.email})) = ${normEmail(firm.email)}`
      )
    );
  const contexts = rows
    .map((r) => contextFrom(adminId, firm, r.engagement))
    .filter((c): c is PerfContext => c !== null)
    .sort((a, b) => b.termStart.getTime() - a.termStart.getTime());
  return contexts[0] ?? null;
}

/** Every signed engagement on the new pricing whose client has a portal account (the daily job walks these). */
export async function allPerformanceContexts(): Promise<PerfContext[]> {
  const adminId = await getNexliAdminId();
  if (!adminId) return [];
  const rows = await db
    .select()
    .from(engagements)
    .where(
      and(
        eq(engagements.ownerId, adminId),
        eq(engagements.status, "signed"),
        sql`${engagements.metadata}->>'drsPricing' = 'performance'`,
        sql`${engagements.metadata}->>'termStartsAt' IS NOT NULL`
      )
    );
  const out: PerfContext[] = [];
  for (const engagement of rows) {
    try {
      const signer = await getPrimaryClientSigner(engagement.id);
      if (!signer) continue;
      const [firm] = await db
        .select(FIRM_COLS)
        .from(users)
        .where(and(sql`lower(trim(${users.email})) = ${normEmail(signer.email)}`, eq(users.role, "client")))
        .limit(1);
      if (!firm) continue;
      const ctx = contextFrom(adminId, firm, engagement);
      if (ctx) out.push(ctx);
    } catch (err) {
      console.error("[performance] context failed:", err);
    }
  }
  return out;
}

// ── Leads: the firm's ad contacts, saved with their proof ──

async function stampLeadSync(engagementId: string, error: string | null): Promise<void> {
  const patch = JSON.stringify({ leadsSyncedAt: new Date().toISOString(), leadsSyncError: error });
  await db
    .update(engagements)
    .set({
      metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{performance}', COALESCE(${engagements.metadata}->'performance', '{}'::jsonb) || ${patch}::jsonb, true)`,
    })
    .where(eq(engagements.id, engagementId));
}

/**
 * Reads the firm's CRM for contacts that came from a Meta ad since signing
 * and saves the new ones. A saved lead keeps the attribution it was first
 * saved with (that is the proof); only its name, email, phone and booked
 * flag follow later edits, since those help the match. Never throws.
 */
export async function syncLeads(ctx: PerfContext): Promise<{ ok: boolean; error: string | null; saved: number }> {
  if (!ctx.firm.ghlLocationId) return { ok: false, error: "This client's GoHighLevel location isn't connected yet.", saved: 0 };
  try {
    await ensurePerformanceTables();
    const last = metaOf(ctx.engagement).performance?.leadsSyncedAt;
    // After the first full read, only look back two weeks before the last one.
    const since = last ? new Date(Math.max(ctx.termStart.getTime(), new Date(last).getTime() - 14 * DAY_MS)) : ctx.termStart;
    const scan = await scanAdLeads({ ownerId: ctx.firm.id, locationId: ctx.firm.ghlLocationId, since, until: new Date(), maxPages: 30 });
    let saved = 0;
    for (const c of scan.contacts) {
      if (!c.platform) continue; // not from a Meta ad
      const added = c.contact.dateAdded ? new Date(c.contact.dateAdded) : null;
      if (!added || Number.isNaN(added.getTime()) || added.getTime() < ctx.termStart.getTime()) continue;
      const name = [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ").trim() || null;
      await db
        .insert(performanceLeads)
        .values({
          firmUserId: ctx.firm.id,
          ghlContactId: c.contact.id,
          name,
          email: normEmail(c.contact.email) || null,
          phone: c.contact.phone || null,
          firstSeenAt: added,
          platform: c.platform,
          utmSource: c.utm?.source || null,
          utmCampaign: c.utm?.campaign || null,
          utmContent: c.utm?.content || null,
          landingUrl: c.utm?.url || null,
          booked: c.booked,
        })
        .onConflictDoUpdate({
          target: [performanceLeads.firmUserId, performanceLeads.ghlContactId],
          set: { name, email: normEmail(c.contact.email) || null, phone: c.contact.phone || null, booked: c.booked, updatedAt: new Date() },
        });
      saved++;
    }
    await stampLeadSync(ctx.engagement.id, scan.truncated ? "The CRM has more contacts than one read covers; the oldest may be missing." : null);
    return { ok: true, error: null, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "GoHighLevel couldn't be read";
    console.error("[performance] lead sync failed:", message);
    try {
      await stampLeadSync(ctx.engagement.id, "The CRM couldn't be read just now.");
    } catch {
      /* the marker is a convenience */
    }
    return { ok: false, error: "The client's CRM couldn't be read just now.", saved: 0 };
  }
}

// ── What the match needs ─────────────────────────────────

interface Inputs {
  leads: PerfLead[];
  invoices: FirmInvoice[];
  rules: ClientRule[];
  links: PipelineLink[];
}

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

async function loadInputs(ctx: PerfContext): Promise<Inputs> {
  const [leadRows, invoiceRows, ruleRows, linkRows] = await Promise.all([
    db.select().from(performanceLeads).where(eq(performanceLeads.firmUserId, ctx.firm.id)),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientEmail: invoices.clientEmail,
        clientName: invoices.clientName,
        clientPhone: invoices.clientPhone,
        clientCompany: invoices.clientCompany,
        status: invoices.status,
        amountPaid: invoices.amountPaid,
        paidAt: invoices.paidAt,
        updatedAt: invoices.updatedAt,
        metadata: invoices.metadata,
      })
      .from(invoices)
      .where(and(eq(invoices.ownerId, ctx.firm.id), gt(invoices.amountPaid, 0))),
    db.select().from(performanceClientRules).where(eq(performanceClientRules.firmUserId, ctx.firm.id)),
    db
      .select({ email: pipelineLeads.email, ghlContactId: pipelineLeads.ghlContactId })
      .from(pipelineLeads)
      .where(and(eq(pipelineLeads.ownerId, ctx.firm.id), isNotNull(pipelineLeads.ghlContactId), isNotNull(pipelineLeads.email), isNull(pipelineLeads.deletedAt))),
  ]);
  return {
    leads: leadRows.map((l) => ({
      id: l.id,
      ghlContactId: l.ghlContactId,
      name: l.name,
      email: l.email,
      phone: l.phone,
      firstSeenAt: new Date(l.firstSeenAt).toISOString(),
      platform: l.platform,
      campaign: l.utmCampaign,
      ad: l.utmContent,
      landingUrl: l.landingUrl,
      booked: l.booked,
    })),
    invoices: invoiceRows.map((r) => {
      const raw = (r.metadata as { payments?: unknown } | null)?.payments;
      const payments = Array.isArray(raw)
        ? raw
            .map((p) => p as { amountCents?: unknown; at?: unknown })
            .filter((p) => typeof p.amountCents === "number" && typeof p.at === "string")
            .map((p) => ({ amountCents: p.amountCents as number, at: p.at as string }))
        : [];
      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        clientEmail: r.clientEmail,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        clientCompany: r.clientCompany,
        status: r.status,
        amountPaid: r.amountPaid,
        paidAt: iso(r.paidAt),
        updatedAt: new Date(r.updatedAt).toISOString(),
        payments,
      };
    }),
    rules: ruleRows.map((r) => ({ email: r.email, rule: r.rule === "exclude" ? "exclude" : "include", leadId: r.leadId, reason: r.reason })),
    links: linkRows.map((l) => ({ email: l.email as string, ghlContactId: l.ghlContactId as string })),
  };
}

// ── Ad spend for a month ─────────────────────────────────

interface Spend {
  cents: number | null;
  source: SpendSource;
  note: string | null;
}

/**
 * What the ad platforms charged the firm in the month. Meta first (the
 * firm's own ad account, read-only token); when that account can't be read,
 * the ad spend Marcel logged in his weekly updates for the weeks that begin
 * in the month. Null when neither has a figure.
 */
async function readSpend(ctx: PerfContext, range: { start: Date; end: Date }, budget: Budget): Promise<Spend> {
  let note: string | null = null;
  const creds = ctx.adAccountId ? adsCreds(ctx.adAccountId) : null;
  if (!ctx.adAccountId) note = "No ad account ID on their Launch Pad yet.";
  else if (!creds) note = "Meta isn't connected.";
  else {
    const res = await insights(creds, budget, {
      level: "account",
      range: { since: ymd(range.start), until: ymd(new Date(range.end.getTime() - DAY_MS)) },
      fields: "lean",
      maxPages: 1,
      label: "client ad spend",
    });
    if (!res.error) {
      const dollars = res.rows.reduce((t, r) => t + (Number(r.spend) || 0), 0);
      return { cents: Math.round(dollars * 100), source: "meta", note: null };
    }
    note = "Meta wouldn't show this ad account's spend (Nexli's access may not cover it).";
  }
  try {
    const rows = await db
      .select({ cents: clientWeeklyUpdates.adSpendCents })
      .from(clientWeeklyUpdates)
      .where(
        and(
          eq(clientWeeklyUpdates.clientUserId, ctx.firm.id),
          isNotNull(clientWeeklyUpdates.adSpendCents),
          sql`${clientWeeklyUpdates.weekStart} >= ${ymd(range.start)}::date`,
          sql`${clientWeeklyUpdates.weekStart} < ${ymd(range.end)}::date`
        )
      );
    if (rows.length) return { cents: rows.reduce((t, r) => t + (r.cents ?? 0), 0), source: "weekly_updates", note };
  } catch (err) {
    console.error("[performance] weekly-update spend lookup failed:", err);
  }
  return { cents: null, source: "none", note };
}

// ── A month ──────────────────────────────────────────────

async function invoiceRef(invoiceId: string | null): Promise<MonthView["invoice"]> {
  if (!invoiceId) return null;
  const [inv] = await db
    .select({ id: invoices.id, number: invoices.invoiceNumber, status: invoices.status, total: invoices.total, paidAt: invoices.paidAt })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return inv ? { id: inv.id, number: inv.number, status: inv.status, totalCents: inv.total, paidAt: iso(inv.paidAt) } : null;
}

async function monthView(
  ctx: PerfContext,
  payers: Payer[],
  range: MonthRange,
  row: StatementRow | undefined,
  now: Date,
  budget: Budget
): Promise<MonthView> {
  const base = {
    monthIndex: range.index,
    label: periodLabel(range),
    periodStart: range.start.toISOString(),
    periodEnd: range.end.toISOString(),
    closed: range.end.getTime() <= now.getTime(),
  };
  if (row && row.status !== "draft" && row.snapshot) {
    const snap = row.snapshot;
    return {
      ...base,
      status: row.status === "sent" ? "sent" : "none_due",
      totals: snap.totals,
      lines: snap.lines,
      extras: snap.extras,
      adSpendSource: (snap.adSpendSource as SpendSource) ?? "manual",
      adSpendNote: null,
      invoice: await invoiceRef(row.invoiceId),
      sentAt: iso(row.sentAt),
    };
  }
  const lines = statementLines(payers, range.start, range.end);
  const extras = row?.extras ?? [];
  let spend: Spend;
  if (row && row.adSpendOverrideCents !== null && row.adSpendOverrideCents !== undefined) {
    spend = { cents: row.adSpendOverrideCents, source: "manual", note: null };
  } else {
    spend = await readSpend(ctx, range, budget);
  }
  // A month already sent whose frozen copy is missing (its save failed after
  // the invoice went out) still reads as sent, with today's numbers.
  const sent = row && row.status !== "draft" ? (row.status === "sent" ? "sent" : "none_due") : null;
  return {
    ...base,
    status: sent ?? (base.closed ? "draft" : "open"),
    totals: statementTotals(lines, extras, spend.cents ?? 0, ctx.terms),
    lines,
    extras,
    adSpendSource: spend.source,
    adSpendNote: spend.note,
    invoice: sent ? await invoiceRef(row?.invoiceId ?? null) : null,
    sentAt: sent ? iso(row?.sentAt) : null,
  };
}

async function statementRows(engagementId: string): Promise<Map<number, StatementRow>> {
  const rows = await db.select().from(performanceStatements).where(eq(performanceStatements.engagementId, engagementId));
  return new Map(rows.map((r) => [r.monthIndex, r]));
}

// ── The admin view ───────────────────────────────────────

/** Everything the "Ads and performance pay" panel shows for one client firm. */
export async function performanceView(firmUserId: string, opts: { sync?: boolean } = {}): Promise<PerformanceView> {
  let ctx = await performanceContextFor(firmUserId);
  if (!ctx) return { enabled: false };
  await ensurePerformanceTables();

  const lastSync = metaOf(ctx.engagement).performance?.leadsSyncedAt;
  const stale = !lastSync || Date.now() - new Date(lastSync).getTime() > LEADS_STALE_MS;
  if ((opts.sync || stale) && ctx.firm.ghlLocationId) {
    await syncLeads(ctx);
    ctx = (await performanceContextFor(firmUserId)) ?? ctx; // pick up the new sync marker
  }

  const now = new Date();
  const meta = metaOf(ctx.engagement);
  const term = agencyTermState(ctx.engagement, now);
  const endsAt = term?.endsAt ? new Date(term.endsAt) : null;
  const inputs = await loadInputs(ctx);
  const payers = matchPayers(inputs);
  const rows = await statementRows(ctx.engagement.id);
  const budget = newBudget(20_000);

  const closed = closedMonths(ctx.termStart, now, endsAt).reverse(); // newest first
  // Sent months cost nothing to show; live ones each read Meta, so keep those to the latest dozen.
  let live = 0;
  const months: MonthView[] = [];
  for (const range of closed) {
    const row = rows.get(range.index);
    const frozen = Boolean(row && row.status !== "draft" && row.snapshot);
    if (!frozen && ++live > 12) continue;
    months.push(await monthView(ctx, payers, range, row, now, budget));
  }
  const currentIndex = monthIndexAt(ctx.termStart, now);
  const currentRange = currentIndex > 0 ? monthRange(ctx.termStart, currentIndex) : null;
  const current =
    currentRange && !(endsAt && currentRange.start.getTime() >= endsAt.getTime())
      ? await monthView(ctx, payers, currentRange, rows.get(currentIndex), now, budget)
      : null;

  const matched = payers.filter((p) => p.lead && p.how);
  return {
    enabled: true,
    firm: { id: ctx.firm.id, name: ctx.firm.name },
    terms: { feeCents: ctx.terms.feeCents, percent: ctx.terms.percent, termMonths: ctx.terms.termMonths, billing: ctx.terms.billing },
    term: term
      ? {
          startsAt: term.startsAt,
          currentEndsAt: term.currentEndsAt,
          termNumber: term.termNumber,
          noticeDeadline: term.noticeDeadline,
          endsAt: term.endsAt,
          noticeAt: meta.cancellation?.noticeAt ?? null,
          ended: term.ended,
        }
      : undefined,
    launchedAt: meta.billingStartedAt ?? null,
    leads: {
      total: inputs.leads.length,
      syncedAt: meta.performance?.leadsSyncedAt ?? null,
      connected: Boolean(ctx.firm.ghlLocationId),
      error: meta.performance?.leadsSyncError ?? null,
    },
    current,
    months,
    attributed: matched
      .map((p) => ({
        email: p.email,
        name: p.name,
        company: p.company,
        how: p.how as NonNullable<Payer["how"]>,
        firstSeenAt: (p.lead as PerfLead).firstSeenAt,
        platform: (p.lead as PerfLead).platform,
        campaign: (p.lead as PerfLead).campaign,
        ad: (p.lead as PerfLead).ad,
        landingUrl: (p.lead as PerfLead).landingUrl,
        firstPaidAt: p.firstPaidAt,
        totalPaidCents: sumCents(p.payments),
        excluded: p.excluded,
      }))
      .sort((a, b) => b.totalPaidCents - a.totalPaidCents),
    uncounted: payers
      .filter((p) => !p.lead)
      .map((p) => ({ email: p.email, name: p.name, company: p.company, firstPaidAt: p.firstPaidAt, totalPaidCents: sumCents(p.payments) }))
      .sort((a, b) => b.totalPaidCents - a.totalPaidCents)
      .slice(0, 60),
    leadOptions: [...inputs.leads]
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
      .slice(0, 300)
      .map((l) => ({ id: l.id, name: l.name || l.email || "Unnamed lead", email: l.email, firstSeenAt: l.firstSeenAt, campaign: l.campaign })),
  };
}

// ── Marcel's inputs on a draft ───────────────────────────

function rangeFor(ctx: PerfContext, monthIndex: number): MonthRange {
  if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 600) throw new PerformanceError("That month doesn't exist.");
  const range = monthRange(ctx.termStart, monthIndex);
  const endsAt = metaOf(ctx.engagement).cancellation?.endsAt;
  if (endsAt && range.start.getTime() >= new Date(endsAt).getTime()) throw new PerformanceError("That month is after the agreement ended.");
  return range;
}

/** The month's statement row, created as a draft the first time it's touched. */
async function ensureRow(ctx: PerfContext, range: MonthRange): Promise<StatementRow> {
  await ensurePerformanceTables();
  await db
    .insert(performanceStatements)
    .values({ engagementId: ctx.engagement.id, firmUserId: ctx.firm.id, monthIndex: range.index, periodStart: range.start, periodEnd: range.end })
    .onConflictDoNothing({ target: [performanceStatements.engagementId, performanceStatements.monthIndex] });
  const [row] = await db
    .select()
    .from(performanceStatements)
    .where(and(eq(performanceStatements.engagementId, ctx.engagement.id), eq(performanceStatements.monthIndex, range.index)))
    .limit(1);
  if (!row) throw new PerformanceError("Couldn't open that month's statement.", 500);
  return row;
}

async function draftRow(ctx: PerfContext, monthIndex: number): Promise<{ row: StatementRow; range: MonthRange }> {
  const range = rangeFor(ctx, monthIndex);
  const row = await ensureRow(ctx, range);
  if (row.status !== "draft") throw new PerformanceError("That statement was already sent, so it can't be changed.", 409);
  return { row, range };
}

/** Marcel's own ad spend figure for a month (cents), or null to go back to Meta / the weekly updates. */
export async function setAdSpend(ctx: PerfContext, monthIndex: number, cents: number | null): Promise<void> {
  const { row } = await draftRow(ctx, monthIndex);
  if (cents !== null && (!Number.isFinite(cents) || cents < 0 || cents > 100_000_000_00)) throw new PerformanceError("Enter the ad spend as a dollar amount.");
  await db
    .update(performanceStatements)
    .set({ adSpendOverrideCents: cents === null ? null : Math.round(cents), updatedAt: new Date() })
    .where(eq(performanceStatements.id, row.id));
}

/** A payment added by hand: money an ad-sourced client paid outside the portal, or a correction (negative). */
export async function addExtra(ctx: PerfContext, monthIndex: number, input: { name: string; amountCents: number; at?: string | null; note?: string | null }): Promise<void> {
  const { row } = await draftRow(ctx, monthIndex);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new PerformanceError("Say whose payment this is.");
  if (!Number.isFinite(input.amountCents) || input.amountCents === 0 || Math.abs(input.amountCents) > 100_000_000_00) throw new PerformanceError("Enter the amount as dollars.");
  if (row.extras.length >= 100) throw new PerformanceError("That's a lot of added payments for one month. Remove some first.");
  const at = input.at && /^\d{4}-\d{2}-\d{2}$/.test(input.at) ? input.at : null;
  const extra: ExtraLine = { id: randomUUID(), name, amountCents: Math.round(input.amountCents), at, note: input.note?.trim().slice(0, 300) || null };
  await db
    .update(performanceStatements)
    .set({ extras: [...row.extras, extra], updatedAt: new Date() })
    .where(eq(performanceStatements.id, row.id));
}

export async function removeExtra(ctx: PerfContext, monthIndex: number, extraId: string): Promise<void> {
  const { row } = await draftRow(ctx, monthIndex);
  await db
    .update(performanceStatements)
    .set({ extras: row.extras.filter((e) => e.id !== extraId), updatedAt: new Date() })
    .where(eq(performanceStatements.id, row.id));
}

/**
 * Marcel's call on one paying client: "include" ties the payer to an ad lead
 * (same person, different email), "exclude" leaves a matched client out
 * (with a reason), null removes his call. It applies to every month not yet sent.
 */
export async function setClientRule(
  ctx: PerfContext,
  input: { email: string; rule: "include" | "exclude" | null; leadId?: string | null; reason?: string | null; actorId: string }
): Promise<void> {
  await ensurePerformanceTables();
  const email = normEmail(input.email);
  if (!email) throw new PerformanceError("Which client?");
  if (input.rule === null) {
    await db.delete(performanceClientRules).where(and(eq(performanceClientRules.firmUserId, ctx.firm.id), eq(performanceClientRules.email, email)));
    return;
  }
  let leadId: string | null = null;
  if (input.rule === "include") {
    const [lead] = input.leadId
      ? await db
          .select({ id: performanceLeads.id })
          .from(performanceLeads)
          .where(and(eq(performanceLeads.id, input.leadId), eq(performanceLeads.firmUserId, ctx.firm.id)))
          .limit(1)
      : [];
    if (!lead) throw new PerformanceError("Pick the ad lead this client is.");
    leadId = lead.id;
  }
  const reason = input.reason?.trim().slice(0, 300) || null;
  await db
    .insert(performanceClientRules)
    .values({ firmUserId: ctx.firm.id, email, rule: input.rule, leadId, reason, createdBy: input.actorId })
    .onConflictDoUpdate({
      target: [performanceClientRules.firmUserId, performanceClientRules.email],
      set: { rule: input.rule, leadId, reason, createdBy: input.actorId, updatedAt: new Date() },
    });
}

// ── Sending a month ──────────────────────────────────────

const usd = (cents: number) => formatCurrency(cents, "usd");

function summaryOf(v: MonthView): string {
  const t = v.totals;
  return `${usd(t.collectedCents)} collected from ${t.clients} ad-sourced client${t.clients === 1 ? "" : "s"}, less ${usd(t.adSpendCents)} ad spend, is ${usd(t.netCents)} of net attributed revenue. ${t.percent}% of that is ${usd(t.grossCents)}; less the ${usd(t.creditCents)} agency fee already paid for the month, ${usd(t.dueCents)} is due.`;
}

/**
 * Freezes a month that has ended and, when something is due, sends its
 * Performance Pay invoice. With nothing due the month is closed as "nothing
 * due" and no invoice goes out. Only Marcel calls this: nothing is ever
 * invoiced by the daily job.
 */
export async function sendStatement(ctx: PerfContext, monthIndex: number): Promise<{ status: "sent" | "none_due"; dueCents: number; invoiceId: string | null }> {
  const { row, range } = await draftRow(ctx, monthIndex);
  const now = new Date();
  if (range.end.getTime() > now.getTime()) throw new PerformanceError("That month hasn't ended yet.");

  const payers = matchPayers(await loadInputs(ctx));
  const view = await monthView(ctx, payers, range, row, now, newBudget(15_000));
  if (view.adSpendSource === "none" && view.totals.collectedCents > 0) {
    throw new PerformanceError("Enter the ad spend for this month first (type 0 if there was none). It couldn't be read from Meta or the weekly updates.");
  }
  const due = view.totals.dueCents;
  const status = due > 0 ? "sent" : "none_due";

  // Claim the month before anything is invoiced, so a double tap can't send two.
  const claimed = await db
    .update(performanceStatements)
    .set({ status, updatedAt: now })
    .where(and(eq(performanceStatements.id, row.id), eq(performanceStatements.status, "draft")))
    .returning({ id: performanceStatements.id });
  if (claimed.length === 0) throw new PerformanceError("That statement was already sent.", 409);

  let invoiceId: string | null = null;
  try {
    if (due > 0) {
      const signer = await getPrimaryClientSigner(ctx.engagement.id);
      if (!signer) throw new PerformanceError("This engagement has no client signer to invoice.");
      const created = await createDrsInvoices({
        engagement: ctx.engagement,
        signer,
        specs: [
          drsPerformanceInvoiceSpec({
            monthIndex: range.index,
            periodLabel: view.label,
            dueCents: due,
            dueDate: new Date(now.getTime() + AGENCY.PERFORMANCE_DUE_DAYS * DAY_MS),
            statement: { periodLabel: view.label, ...view.totals },
            summary: summaryOf(view),
          }),
        ],
      });
      // No invoice came back: one already exists for this month (it was sent before and this row was reset).
      if (!created[0]) throw new PerformanceError("An invoice for this month already exists. Check their invoices before sending again.", 409);
      invoiceId = created[0].id;
    }
    const snapshot: StatementSnapshot = { periodLabel: view.label, totals: view.totals, lines: view.lines, extras: view.extras, adSpendSource: view.adSpendSource };
    await db
      .update(performanceStatements)
      .set({ snapshot, invoiceId, sentAt: now, updatedAt: now })
      .where(eq(performanceStatements.id, row.id));
  } catch (err) {
    if (!invoiceId) {
      await db.update(performanceStatements).set({ status: "draft", updatedAt: new Date() }).where(eq(performanceStatements.id, row.id));
    }
    throw err;
  }
  return { status, dueCents: due, invoiceId };
}

/** A month closed as "nothing due" goes back to a live draft (a late payment turned up). Sent months stay sent. */
export async function reopenStatement(ctx: PerfContext, monthIndex: number): Promise<void> {
  const range = rangeFor(ctx, monthIndex);
  const row = await ensureRow(ctx, range);
  if (row.status === "sent") throw new PerformanceError("That month's invoice was sent. Add what was left out to the next statement instead.", 409);
  if (row.status === "draft") return;
  await db
    .update(performanceStatements)
    .set({ status: "draft", snapshot: null, sentAt: null, updatedAt: new Date() })
    .where(and(eq(performanceStatements.id, row.id), eq(performanceStatements.status, "none_due")));
}

// ── The daily job ────────────────────────────────────────

/**
 * For every client on the new pricing: refresh its leads, open a draft for
 * each month that has ended, and tell Marcel (once per month) when a month
 * has money collected from ad-sourced clients to review. Months with nothing
 * collected stay quiet drafts; they are looked at again each day in case a
 * payment is recorded late. Sends nothing to clients. Never throws.
 */
export async function prepareStatements(now: Date = new Date()): Promise<{ clients: number; notified: number }> {
  let notified = 0;
  let contexts: PerfContext[] = [];
  try {
    await ensurePerformanceTables();
    contexts = await allPerformanceContexts();
  } catch (err) {
    console.error("[performance] daily job could not start:", err);
    return { clients: 0, notified: 0 };
  }
  for (let ctx of contexts) {
    try {
      const endsAtRaw = metaOf(ctx.engagement).cancellation?.endsAt;
      const closed = closedMonths(ctx.termStart, now, endsAtRaw ? new Date(endsAtRaw) : null);
      if (closed.length === 0) continue;
      const rows = await statementRows(ctx.engagement.id);
      const pending = closed.filter((r) => {
        const row = rows.get(r.index);
        return !row || (row.status === "draft" && !row.notifiedAt);
      });
      if (pending.length === 0) continue;

      if (ctx.firm.ghlLocationId) {
        await syncLeads(ctx);
        ctx = (await performanceContextFor(ctx.firm.id)) ?? ctx;
      }
      const payers = matchPayers(await loadInputs(ctx));
      const budget = newBudget(20_000);
      // Oldest first, and no more than six in one run (a long backlog catches up over a few days).
      for (const range of pending.slice(0, 6)) {
        const row = await ensureRow(ctx, range);
        if (row.status !== "draft" || row.notifiedAt) continue;
        const lines = statementLines(payers, range.start, range.end);
        if (sumCents(lines) + sumCents(row.extras) <= 0) continue; // nothing collected: stay quiet
        const view = await monthView(ctx, payers, range, row, now, budget);
        const claimed = await db
          .update(performanceStatements)
          .set({ notifiedAt: now, updatedAt: now })
          .where(and(eq(performanceStatements.id, row.id), isNull(performanceStatements.notifiedAt)))
          .returning({ id: performanceStatements.id });
        if (claimed.length === 0) continue;
        const spendCaveat = view.adSpendSource === "none" ? " The ad spend couldn't be read, so it shows as $0 until you enter it." : "";
        await createNotification({
          userId: ctx.adminId,
          type: "performance_statement",
          title: `Performance pay ready to review — ${ctx.firm.name}`,
          message: `${view.label}: ${summaryOf(view)}${spendCaveat} Open ${ctx.firm.name} in Client Tracker, check the clients listed, and press Send. Nothing is invoiced until you do.`,
          metadata: { clientUserId: ctx.firm.id, engagementId: ctx.engagement.id, monthIndex: range.index },
        });
        notified++;
      }
    } catch (err) {
      console.error(`[performance] daily job failed for ${ctx.firm.id}:`, err);
    }
  }
  return { clients: contexts.length, notified };
}

// ── What the firm sees ───────────────────────────────────

/** The firm's own statements once Marcel has sent or closed them, newest first, with the client-by-client list. */
export async function firmStatements(firmUserId: string): Promise<FirmStatementView[]> {
  const ctx = await performanceContextFor(firmUserId);
  if (!ctx) return [];
  await ensurePerformanceTables();
  const rows = await db
    .select()
    .from(performanceStatements)
    .where(and(eq(performanceStatements.engagementId, ctx.engagement.id), inArray(performanceStatements.status, ["sent", "none_due"])))
    .orderBy(desc(performanceStatements.monthIndex));
  const ids = rows.map((r) => r.invoiceId).filter((id): id is string => Boolean(id));
  const invs = ids.length
    ? await db.select({ id: invoices.id, number: invoices.invoiceNumber, status: invoices.status, token: invoices.token }).from(invoices).where(inArray(invoices.id, ids))
    : [];
  const byId = new Map(invs.map((i) => [i.id, i]));
  return rows
    .filter((r) => r.snapshot)
    .map((r) => {
      const snap = r.snapshot as StatementSnapshot;
      const inv = r.invoiceId ? byId.get(r.invoiceId) : undefined;
      return {
        monthIndex: r.monthIndex,
        label: snap.periodLabel,
        status: r.status === "sent" ? "sent" : "none_due",
        totals: snap.totals,
        lines: snap.lines,
        extras: snap.extras,
        invoice: inv ? { number: inv.number, status: inv.status, token: inv.token } : null,
        sentAt: iso(r.sentAt),
      };
    });
}

// ── Non-renewal ──────────────────────────────────────────

/**
 * Records a client's written notice of non-renewal. The agreement then ends
 * at the end of the term running on the notice date when the notice came at
 * least 30 days before it, otherwise at the end of the following term
 * (letter 4(d)); the monthly autopay is set to stop that day. The last
 * month's Performance Pay is still prepared after the end.
 */
export async function recordCancellation(ctx: PerfContext, noticeAt: Date): Promise<{ endsAt: string; autopay: "stopped" | "none" | "failed" }> {
  if (Number.isNaN(noticeAt.getTime()) || noticeAt.getTime() < ctx.termStart.getTime()) throw new PerformanceError("The notice date can't be before the agreement was signed.");
  if (noticeAt.getTime() > Date.now() + DAY_MS) throw new PerformanceError("The notice date can't be in the future.");
  const endsAt = agencyEndForNotice(ctx.termStart, ctx.terms.termMonths, noticeAt, AGENCY.CANCEL_NOTICE_DAYS);
  const record = JSON.stringify({ noticeAt: noticeAt.toISOString(), endsAt: endsAt.toISOString(), recordedAt: new Date().toISOString() });
  await db
    .update(engagements)
    .set({ metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{cancellation}', ${record}::jsonb, true)`, updatedAt: new Date() })
    .where(eq(engagements.id, ctx.engagement.id));
  const sub = metaOf(ctx.engagement).autopay;
  const live = sub?.subscriptionId && sub.status !== "canceled" && sub.status !== "incomplete_expired";
  const autopay = live ? ((await setAutopayEnd(sub.subscriptionId as string, endsAt)) ? "stopped" : "failed") : "none";
  return { endsAt: endsAt.toISOString(), autopay };
}

/** Removes a recorded non-renewal (the client changed its mind): the agreement renews again and autopay runs on. */
export async function clearCancellation(ctx: PerfContext): Promise<{ autopay: "resumed" | "none" | "failed" }> {
  await db
    .update(engagements)
    .set({ metadata: sql`${engagements.metadata} - 'cancellation'`, updatedAt: new Date() })
    .where(eq(engagements.id, ctx.engagement.id));
  const sub = metaOf(ctx.engagement).autopay;
  const live = sub?.subscriptionId && sub.status !== "canceled" && sub.status !== "incomplete_expired";
  return { autopay: live ? ((await setAutopayEnd(sub.subscriptionId as string, null)) ? "resumed" : "failed") : "none" };
}
