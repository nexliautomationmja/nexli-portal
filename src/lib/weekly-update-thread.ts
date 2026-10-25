import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientWeeklyUpdates, portalMessages, users } from "@/db/schema";
import { sendEmailWithLog } from "@/lib/email";
import { buildWeeklyUpdateEmail, FOUNDATION_SENDER_NAME } from "@/lib/email-foundation";
import { getPortalUrl } from "@/lib/foundation-config";
import { getNexliAdminId } from "@/lib/foundation-project";
import { weekStartOf } from "@/lib/client-success-tables";
import { getPendingSurvey } from "@/lib/client-success";
import { MAX_MESSAGE_LENGTH, excerpt } from "@/lib/portal-messages";

/**
 * Shared pieces of the weekly-update send flow (text + voice routes): input
 * parsing, posting the update into the client's Nexli message thread, and
 * the client email (whose CTA now opens that thread).
 */

export const MAX_HEADLINE = 200;
export const MAX_BODY = 10_000;

export type WeeklyUpdateRow = typeof clientWeeklyUpdates.$inferSelect;
export type WeeklyUpdateClient = { id: string; email: string; name: string | null };

export async function loadWeeklyUpdateClient(clientId: string): Promise<WeeklyUpdateClient | null> {
  const [client] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  return client && client.role === "client"
    ? { id: client.id, email: client.email, name: client.name }
    : null;
}

export function parseWeekStart(v: unknown): string | null {
  if (v == null || v === "") return weekStartOf(new Date());
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return weekStartOf(d); // snap to that week's Monday
}

export function parseAdSpend(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export function parseHeadline(v: unknown): string | null {
  return typeof v === "string" ? v.trim().slice(0, MAX_HEADLINE) || null : null;
}

/**
 * Owner of the client's Nexli thread: the Nexli admin account (what the
 * client's /dashboard/nexli-messages reads), falling back to the sender.
 */
export async function weeklyUpdateThreadOwner(senderAdminId: string): Promise<string> {
  return (await getNexliAdminId()) ?? senderAdminId;
}

/**
 * Post (or, on a re-send, refresh) a text weekly update in the client's
 * thread. One message per weeklyUpdateId. Never throws.
 */
export async function postTextWeeklyUpdateToThread(params: {
  update: WeeklyUpdateRow;
  client: WeeklyUpdateClient;
  senderAdminId: string;
}): Promise<void> {
  const { update, client, senderAdminId } = params;
  try {
    const ownerId = await weeklyUpdateThreadOwner(senderAdminId);
    const text = (update.headline ? `${update.headline}\n\n${update.body}` : update.body).slice(
      0,
      MAX_MESSAGE_LENGTH
    );
    const [existing] = await db
      .select({ id: portalMessages.id })
      .from(portalMessages)
      .where(eq(portalMessages.weeklyUpdateId, update.id))
      .limit(1);
    if (existing) {
      await db
        .update(portalMessages)
        .set({
          message: text,
          kind: "weekly_update",
          audioPath: null,
          audioMime: null,
          audioDurationMs: null,
          transcript: null,
          transcriptStatus: null,
          read: false,
        })
        .where(eq(portalMessages.id, existing.id));
    } else {
      await db.insert(portalMessages).values({
        ownerId,
        clientEmail: client.email.toLowerCase().trim(),
        senderType: "cpa",
        senderUserId: senderAdminId,
        kind: "weekly_update",
        weeklyUpdateId: update.id,
        message: text,
      });
    }
  } catch (err) {
    console.error("[weekly-update] posting to thread failed:", err);
  }
}

/** Email the client the update; CTA opens their Nexli thread. Returns emailed. */
export async function emailWeeklyUpdate(params: {
  update: WeeklyUpdateRow;
  client: WeeklyUpdateClient;
  senderAdminId: string;
  voice?: { transcript: string | null } | null;
  now?: Date;
}): Promise<boolean> {
  const { update, client, senderAdminId, voice } = params;
  try {
    const portalUrl = getPortalUrl();
    const pending = await getPendingSurvey(client.id, params.now ?? new Date());
    const { subject, html } = buildWeeklyUpdateEmail({
      clientName: client.name,
      weekStart: update.weekStart,
      headline: update.headline,
      body: update.body,
      adSpendCents: update.adSpendCents ?? null,
      dashboardUrl: `${portalUrl}/dashboard/nexli-messages`,
      ctaLabel: voice ? "Listen & reply" : "Reply in messages",
      surveyUrl: pending ? `${portalUrl}/survey/${pending.token}` : null,
      voice: voice ? { transcriptExcerpt: excerpt(voice.transcript, 300) || null } : null,
    });
    await sendEmailWithLog({
      to: client.email,
      subject,
      html,
      fromName: FOUNDATION_SENDER_NAME,
      recipientName: client.name || undefined,
      emailType: "weekly_update",
      relatedId: update.id,
      sentBy: senderAdminId,
    });
    return true;
  } catch (err) {
    console.error("Weekly update email failed:", err);
    return false;
  }
}
