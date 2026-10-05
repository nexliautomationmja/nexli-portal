import { db } from "@/db";
import { clientSurveys, clientWeeklyUpdates, users } from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull, gt } from "drizzle-orm";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { generateInvoiceToken } from "@/lib/invoice-utils";
import { getBookOfBusiness, type BookRow } from "@/lib/book-of-business";
import { getNexliAdminId } from "@/lib/foundation-project";
import { ensureClientAccount } from "@/lib/client-accounts";

/**
 * Customer-success helpers shared by the survey/update APIs, the Monday and
 * Friday crons, the Client Tracker, and the client's Overview. One source of
 * truth for "what counts as a low score" and "who is an active DRS client".
 */

/** A survey link stays usable this many days after it's created. */
export const SURVEY_EXPIRES_DAYS = 21;
/** Scores at or below this (out of 5) alert Marcel. */
export const LOW_SCORE_MAX = 2;

export type ValueAnswer = "yes" | "somewhat" | "no";
export const VALUE_ANSWERS: readonly ValueAnswer[] = ["yes", "somewhat", "no"];

export function isLowScore(score: number, valueAnswer?: string | null): boolean {
  return score <= LOW_SCORE_MAX || valueAnswer === "no";
}

export function valueAnswerLabel(v: string | null | undefined): string {
  if (v === "yes") return "Yes";
  if (v === "somewhat") return "Somewhat";
  if (v === "no") return "No";
  return "—";
}

export type SurveyRow = typeof clientSurveys.$inferSelect;
export type WeeklyUpdateRow = typeof clientWeeklyUpdates.$inferSelect;

export function isSurveyExpired(survey: Pick<SurveyRow, "expiresAt">, now = new Date()): boolean {
  return new Date(survey.expiresAt).getTime() < now.getTime();
}

// ── Surveys ──────────────────────────────────────────────

/**
 * The one survey row for (client, week). Creating it does not send anything;
 * the Monday cron stamps sentAt after the email goes out.
 */
export async function getOrCreateWeeklySurvey(
  clientUserId: string,
  weekStart: string
): Promise<SurveyRow> {
  await ensureClientSuccessTables();
  const find = () =>
    db
      .select()
      .from(clientSurveys)
      .where(and(eq(clientSurveys.clientUserId, clientUserId), eq(clientSurveys.weekStart, weekStart)))
      .limit(1);

  const [existing] = await find();
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + SURVEY_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(clientSurveys)
    .values({ clientUserId, weekStart, token: generateInvoiceToken(), expiresAt })
    .onConflictDoNothing();
  const [row] = await find();
  if (!row) throw new Error("Failed to create weekly survey");
  return row;
}

export async function getSurveyByToken(token: string): Promise<SurveyRow | null> {
  await ensureClientSuccessTables();
  const [row] = await db.select().from(clientSurveys).where(eq(clientSurveys.token, token)).limit(1);
  return row ?? null;
}

/** Latest submitted score per client, keyed by users.id. */
export async function latestSurveyScores(
  clientUserIds: string[]
): Promise<Map<string, { score: number; valueAnswer: string | null; submittedAt: Date }>> {
  const out = new Map<string, { score: number; valueAnswer: string | null; submittedAt: Date }>();
  if (clientUserIds.length === 0) return out;
  await ensureClientSuccessTables();
  const rows = await db
    .select({
      clientUserId: clientSurveys.clientUserId,
      score: clientSurveys.resultsScore,
      valueAnswer: clientSurveys.valueAnswer,
      submittedAt: clientSurveys.submittedAt,
    })
    .from(clientSurveys)
    .where(and(inArray(clientSurveys.clientUserId, clientUserIds), isNotNull(clientSurveys.submittedAt)))
    .orderBy(desc(clientSurveys.submittedAt));
  for (const r of rows) {
    if (out.has(r.clientUserId) || r.score == null || !r.submittedAt) continue;
    out.set(r.clientUserId, { score: r.score, valueAnswer: r.valueAnswer, submittedAt: new Date(r.submittedAt) });
  }
  return out;
}

/** Last `limit` surveys for one client, newest week first. */
export async function listClientSurveys(clientUserId: string, limit = 8) {
  await ensureClientSuccessTables();
  const rows = await db
    .select({
      id: clientSurveys.id,
      weekStart: clientSurveys.weekStart,
      score: clientSurveys.resultsScore,
      valueAnswer: clientSurveys.valueAnswer,
      comment: clientSurveys.comment,
      sentAt: clientSurveys.sentAt,
      submittedAt: clientSurveys.submittedAt,
    })
    .from(clientSurveys)
    .where(eq(clientSurveys.clientUserId, clientUserId))
    .orderBy(desc(clientSurveys.weekStart))
    .limit(limit);
  return rows;
}

/**
 * This week's survey for a client if it has been sent, is unanswered and
 * hasn't expired — what the Overview and the weekly-update email link to.
 * Only the client's OWN token ever leaves here.
 */
export async function getPendingSurvey(
  clientUserId: string,
  now = new Date()
): Promise<{ token: string; weekStart: string } | null> {
  await ensureClientSuccessTables();
  const [row] = await db
    .select({ token: clientSurveys.token, weekStart: clientSurveys.weekStart })
    .from(clientSurveys)
    .where(
      and(
        eq(clientSurveys.clientUserId, clientUserId),
        eq(clientSurveys.weekStart, weekStartOf(now)),
        isNotNull(clientSurveys.sentAt),
        isNull(clientSurveys.submittedAt),
        gt(clientSurveys.expiresAt, now)
      )
    )
    .limit(1);
  return row ?? null;
}

// ── Weekly updates ───────────────────────────────────────

export async function listClientWeeklyUpdates(clientUserId: string, limit = 6) {
  await ensureClientSuccessTables();
  return db
    .select({
      id: clientWeeklyUpdates.id,
      weekStart: clientWeeklyUpdates.weekStart,
      headline: clientWeeklyUpdates.headline,
      body: clientWeeklyUpdates.body,
      adSpendCents: clientWeeklyUpdates.adSpendCents,
      status: clientWeeklyUpdates.status,
      sentAt: clientWeeklyUpdates.sentAt,
      viewedAt: clientWeeklyUpdates.viewedAt,
      updatedAt: clientWeeklyUpdates.updatedAt,
    })
    .from(clientWeeklyUpdates)
    .where(eq(clientWeeklyUpdates.clientUserId, clientUserId))
    .orderBy(desc(clientWeeklyUpdates.weekStart))
    .limit(limit);
}

export interface LatestUpdate {
  id: string;
  weekStart: string;
  headline: string | null;
  body: string;
  adSpendCents: number | null;
  sentAt: string;
  viewedAt: string | null;
}

/** The most recently SENT update for a client (drafts never reach them). */
export async function getLatestSentUpdate(clientUserId: string): Promise<LatestUpdate | null> {
  await ensureClientSuccessTables();
  const [row] = await db
    .select({
      id: clientWeeklyUpdates.id,
      weekStart: clientWeeklyUpdates.weekStart,
      headline: clientWeeklyUpdates.headline,
      body: clientWeeklyUpdates.body,
      adSpendCents: clientWeeklyUpdates.adSpendCents,
      sentAt: clientWeeklyUpdates.sentAt,
      viewedAt: clientWeeklyUpdates.viewedAt,
    })
    .from(clientWeeklyUpdates)
    .where(and(eq(clientWeeklyUpdates.clientUserId, clientUserId), eq(clientWeeklyUpdates.status, "sent")))
    .orderBy(desc(clientWeeklyUpdates.sentAt))
    .limit(1);
  if (!row || !row.sentAt) return null;
  return {
    ...row,
    sentAt: new Date(row.sentAt).toISOString(),
    viewedAt: row.viewedAt ? new Date(row.viewedAt).toISOString() : null,
  };
}

/** Everything the client's Overview needs, in one call. */
export async function getClientSuccessForUser(clientUserId: string): Promise<{
  latestUpdate: LatestUpdate | null;
  pendingSurvey: { token: string; weekStart: string } | null;
}> {
  const [latestUpdate, pendingSurvey] = await Promise.all([
    getLatestSentUpdate(clientUserId),
    getPendingSurvey(clientUserId),
  ]);
  return { latestUpdate, pendingSurvey };
}

/** Stamp an update as seen by its own client. No-op for anyone else's. */
export async function markUpdateViewed(clientUserId: string, updateId: string): Promise<boolean> {
  await ensureClientSuccessTables();
  const rows = await db
    .update(clientWeeklyUpdates)
    .set({ viewedAt: new Date() })
    .where(
      and(
        eq(clientWeeklyUpdates.id, updateId),
        eq(clientWeeklyUpdates.clientUserId, clientUserId),
        isNull(clientWeeklyUpdates.viewedAt)
      )
    )
    .returning({ id: clientWeeklyUpdates.id });
  return rows.length > 0;
}

// ── Active DRS clients ───────────────────────────────────

export interface ActiveDrsClient extends BookRow {
  clientUserId: string;
}

/**
 * Nexli's active Digital Rainmaker clients (signed + paying, per the owner's
 * book of business), each resolved to a client dashboard account. Rows
 * without an account yet get one created so surveys/updates have a users.id
 * to attach to. Firm Foundation accounts are excluded — they don't get the
 * agency pulse check.
 */
export async function activeDrsClients(): Promise<{ adminId: string; clients: ActiveDrsClient[] }> {
  const adminId = await getNexliAdminId();
  if (!adminId) return { adminId: "", clients: [] };

  const { clients: book } = await getBookOfBusiness(adminId);
  const active = book.filter((c) => c.status === "active");
  const out: ActiveDrsClient[] = [];
  for (const row of active) {
    try {
      const { clientUserId } = await ensureClientAccount({
        email: row.email,
        name: row.name,
        company: row.company,
      });
      out.push({ ...row, clientUserId });
    } catch (err) {
      console.error(`[client-success] could not resolve account for ${row.email}:`, err);
    }
  }

  if (out.length === 0) return { adminId, clients: [] };
  const tiers = await db
    .select({ id: users.id, tier: users.tier })
    .from(users)
    .where(inArray(users.id, out.map((c) => c.clientUserId)));
  const foundation = new Set(tiers.filter((t) => t.tier === "foundation").map((t) => t.id));
  return { adminId, clients: out.filter((c) => !foundation.has(c.clientUserId)) };
}
