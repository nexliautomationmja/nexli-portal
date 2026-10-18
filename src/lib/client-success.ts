import { db } from "@/db";
import { clientSurveys, clientWeeklyUpdates, users } from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull, gt } from "drizzle-orm";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { generateInvoiceToken } from "@/lib/invoice-utils";
import { getBookOfBusiness, type BookRow } from "@/lib/book-of-business";
import { getNexliAdminId } from "@/lib/foundation-project";
import { ensureClientAccount } from "@/lib/client-accounts";
import type { SurveyAnswers } from "@/lib/survey-questions";

/**
 * Customer-success helpers shared by the survey/update APIs, the Monday and
 * Friday crons, the Client Tracker, and the client's Overview. One source of
 * truth for "what counts as a low score" and "who is an active DRS client".
 */

/** A survey link stays usable this many days after it's created. */
/** Open window per survey. Surveys go out every other Monday, so 13 days keeps at most one open at a time. */
export const SURVEY_EXPIRES_DAYS = 13;

/** Cadence: a survey goes out on even ISO weeks (every other Monday). */
export const SURVEY_EVERY_N_WEEKS = 2;

/** ISO-8601 week number of a YYYY-MM-DD date. */
export function isoWeekNumber(dateOnly: string): number {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** True when the week starting `weekStart` (a Monday) is a survey week. */
export function isSurveyWeek(weekStart: string): boolean {
  return isoWeekNumber(weekStart) % SURVEY_EVERY_N_WEEKS === 0;
}
// Question definitions and scoring rules live in survey-questions.ts
// (client-safe); re-exported here for server callers.
export {
  SURVEY_QUESTIONS,
  SCALE_QUESTION_IDS,
  VALUE_ANSWERS,
  NPS_DETRACTOR_MAX,
  NPS_PROMOTER_MIN,
  SCALE_LOW_MAX,
  isLowScore,
  weakAnswers,
  npsCategory,
  npsColor,
  scaleColor,
  valueAnswerLabel,
  isValueAnswer,
  isNpsScore,
  parseSurveyAnswers,
  surveyComplete,
} from "@/lib/survey-questions";
export type { ValueAnswer, SurveyAnswers, NpsCategory } from "@/lib/survey-questions";

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

export interface LatestSurveyScore {
  /** NPS 0–10; null for legacy (pre-NPS) submissions. */
  npsScore: number | null;
  /** Legacy 1–5 confidence score, when the submission predates NPS. */
  legacyScore: number | null;
  answers: SurveyAnswers | null;
  valueAnswer: string | null;
  submittedAt: Date;
}

/** Latest SUBMITTED survey per client, keyed by users.id. */
export async function latestSurveyScores(clientUserIds: string[]): Promise<Map<string, LatestSurveyScore>> {
  const out = new Map<string, LatestSurveyScore>();
  if (clientUserIds.length === 0) return out;
  await ensureClientSuccessTables();
  const rows = await db
    .select({
      clientUserId: clientSurveys.clientUserId,
      npsScore: clientSurveys.npsScore,
      legacyScore: clientSurveys.resultsScore,
      answers: clientSurveys.answers,
      valueAnswer: clientSurveys.valueAnswer,
      submittedAt: clientSurveys.submittedAt,
    })
    .from(clientSurveys)
    .where(and(inArray(clientSurveys.clientUserId, clientUserIds), isNotNull(clientSurveys.submittedAt)))
    .orderBy(desc(clientSurveys.submittedAt));
  for (const r of rows) {
    if (out.has(r.clientUserId) || !r.submittedAt) continue;
    out.set(r.clientUserId, {
      npsScore: r.npsScore,
      legacyScore: r.legacyScore,
      answers: r.answers ?? null,
      valueAnswer: r.valueAnswer,
      submittedAt: new Date(r.submittedAt),
    });
  }
  return out;
}

export type SurveySendState = "not_sent" | "awaiting" | "answered" | "expired";

export interface SurveyStatus {
  sentAt: Date;
  viewedAt: Date | null;
  submittedAt: Date | null;
  expiresAt: Date;
  npsScore: number | null;
  legacyScore: number | null;
  state: SurveySendState;
}

/** Newest SENT survey per client — did it go out, was it answered, did it lapse. */
export async function latestSurveyStatus(
  clientUserIds: string[],
  now = new Date()
): Promise<Map<string, SurveyStatus>> {
  const out = new Map<string, SurveyStatus>();
  if (clientUserIds.length === 0) return out;
  await ensureClientSuccessTables();
  const rows = await db
    .select({
      clientUserId: clientSurveys.clientUserId,
      sentAt: clientSurveys.sentAt,
      viewedAt: clientSurveys.viewedAt,
      submittedAt: clientSurveys.submittedAt,
      expiresAt: clientSurveys.expiresAt,
      npsScore: clientSurveys.npsScore,
      legacyScore: clientSurveys.resultsScore,
    })
    .from(clientSurveys)
    .where(and(inArray(clientSurveys.clientUserId, clientUserIds), isNotNull(clientSurveys.sentAt)))
    .orderBy(desc(clientSurveys.sentAt));
  for (const r of rows) {
    if (out.has(r.clientUserId) || !r.sentAt) continue;
    const submittedAt = r.submittedAt ? new Date(r.submittedAt) : null;
    const expiresAt = new Date(r.expiresAt);
    const state: SurveySendState = submittedAt
      ? "answered"
      : expiresAt.getTime() < now.getTime()
        ? "expired"
        : "awaiting";
    out.set(r.clientUserId, {
      sentAt: new Date(r.sentAt),
      viewedAt: r.viewedAt ? new Date(r.viewedAt) : null,
      submittedAt,
      expiresAt,
      npsScore: r.npsScore,
      legacyScore: r.legacyScore,
      state,
    });
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
      npsScore: clientSurveys.npsScore,
      legacyScore: clientSurveys.resultsScore,
      answers: clientSurveys.answers,
      valueAnswer: clientSurveys.valueAnswer,
      comment: clientSurveys.comment,
      sentAt: clientSurveys.sentAt,
      viewedAt: clientSurveys.viewedAt,
      submittedAt: clientSurveys.submittedAt,
      expiresAt: clientSurveys.expiresAt,
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
        isNotNull(clientSurveys.sentAt),
        isNull(clientSurveys.submittedAt),
        gt(clientSurveys.expiresAt, now)
      )
    )
    .orderBy(desc(clientSurveys.weekStart))
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

export type UpdateDueState = "sent" | "due" | "overdue" | "never" | "pending";

/** A weekly update is due once a full week has passed without one; overdue after 10 days. */
export const UPDATE_DUE_DAYS = 7;
export const UPDATE_OVERDUE_DAYS = 10;

export interface UpdateStatus {
  lastSentAt: Date | null;
  lastViewedAt: Date | null;
  /** Status of the row for the current week (Monday), if any. */
  thisWeekStatus: "sent" | "draft" | null;
  state: UpdateDueState;
  /** Days since the last sent update (null when never sent). */
  daysSinceSent: number | null;
}

/**
 * "sent" when this week's update went out or the last one is under a week
 * old; "due" at 7+ days; "overdue" at 10+; "never" when no update has ever
 * been sent to a client who has been with us 7+ days; "pending" when the
 * client is brand new and nothing is due yet.
 */
export function updateDueState(input: {
  lastSentAt: Date | null;
  thisWeekStatus: "sent" | "draft" | null;
  clientSince?: Date | null;
  now?: Date;
}): { state: UpdateDueState; daysSinceSent: number | null } {
  const now = input.now ?? new Date();
  const days = input.lastSentAt
    ? Math.floor((now.getTime() - input.lastSentAt.getTime()) / 86_400_000)
    : null;
  if (input.thisWeekStatus === "sent") return { state: "sent", daysSinceSent: days };
  if (days == null) {
    const age = input.clientSince
      ? Math.floor((now.getTime() - input.clientSince.getTime()) / 86_400_000)
      : UPDATE_DUE_DAYS;
    return { state: age >= UPDATE_DUE_DAYS ? "never" : "pending", daysSinceSent: null };
  }
  if (days >= UPDATE_OVERDUE_DAYS) return { state: "overdue", daysSinceSent: days };
  if (days >= UPDATE_DUE_DAYS) return { state: "due", daysSinceSent: days };
  return { state: "sent", daysSinceSent: days };
}

/** Latest sent update + this week's row per client, keyed by users.id. */
export async function latestUpdateStatus(
  clientUserIds: string[],
  opts: { now?: Date; clientSince?: Map<string, Date | null> } = {}
): Promise<Map<string, UpdateStatus>> {
  const out = new Map<string, UpdateStatus>();
  if (clientUserIds.length === 0) return out;
  await ensureClientSuccessTables();
  const now = opts.now ?? new Date();
  const thisWeek = weekStartOf(now);
  const rows = await db
    .select({
      clientUserId: clientWeeklyUpdates.clientUserId,
      weekStart: clientWeeklyUpdates.weekStart,
      status: clientWeeklyUpdates.status,
      sentAt: clientWeeklyUpdates.sentAt,
      viewedAt: clientWeeklyUpdates.viewedAt,
    })
    .from(clientWeeklyUpdates)
    .where(inArray(clientWeeklyUpdates.clientUserId, clientUserIds))
    .orderBy(desc(clientWeeklyUpdates.sentAt));
  const acc = new Map<string, { lastSentAt: Date | null; lastViewedAt: Date | null; thisWeekStatus: "sent" | "draft" | null }>();
  for (const r of rows) {
    const a = acc.get(r.clientUserId) ?? { lastSentAt: null, lastViewedAt: null, thisWeekStatus: null };
    if (r.status === "sent" && r.sentAt && (!a.lastSentAt || new Date(r.sentAt) > a.lastSentAt)) {
      a.lastSentAt = new Date(r.sentAt);
      a.lastViewedAt = r.viewedAt ? new Date(r.viewedAt) : null;
    }
    if (r.weekStart === thisWeek) {
      const st = r.status === "sent" ? "sent" : "draft";
      if (a.thisWeekStatus !== "sent") a.thisWeekStatus = st;
    }
    acc.set(r.clientUserId, a);
  }
  for (const id of clientUserIds) {
    const a = acc.get(id) ?? { lastSentAt: null, lastViewedAt: null, thisWeekStatus: null };
    const { state, daysSinceSent } = updateDueState({
      lastSentAt: a.lastSentAt,
      thisWeekStatus: a.thisWeekStatus,
      clientSince: opts.clientSince?.get(id) ?? null,
      now,
    });
    out.set(id, { ...a, state, daysSinceSent });
  }
  return out;
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
