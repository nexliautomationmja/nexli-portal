import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners, emailLog, users } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import {
  sendEmailWithLog,
  buildOnboardingDueReminderEmail,
} from "@/lib/email";
import { getOwnerBranding } from "@/lib/branding";
import { getOnboardingUrl } from "@/lib/engagements";
import { createNotification } from "@/lib/notifications";
import {
  TASK_INFO,
  clientItemsOutstanding,
  daysUntilDue,
  setOnboardingValues,
  appendActivity,
  toDateOnly,
  type OnboardingState,
} from "@/lib/onboarding";

// Daily (vercel.json → 10:00 UTC). For every Launch Pad with items still
// outstanding: email the client signers two days before the due date, on
// the due date, and then every third day after it; alert the owner once
// the first time it's overdue. All state lives in engagements.metadata.
//   onboarding.dueRemindersSent[]  — YYYY-MM-DD dates a reminder went out
//   onboarding.overdueNotifiedAt   — ISO timestamp of the admin alert

const EMAIL_TYPE = "onboarding_due_reminder";

function formatDueDate(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Reminder cadence: due−2, due day, then every 3rd day starting day after due. */
function shouldRemindToday(days: number): boolean {
  if (days === 2 || days === 0) return true;
  if (days < 0) {
    const daysOverdue = -days;
    return (daysOverdue - 1) % 3 === 0;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = toDateOnly(now);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  let remindersSent = 0;
  let overdueAlerts = 0;
  let skipped = 0;

  try {
    const rows = await db
      .select({
        id: engagements.id,
        ownerId: engagements.ownerId,
        metadata: engagements.metadata,
      })
      .from(engagements)
      .where(sql`${engagements.metadata}->'onboarding' IS NOT NULL`);

    for (const row of rows) {
      try {
        const state = ((row.metadata || {}) as Record<string, unknown>)
          .onboarding as OnboardingState | undefined;
        if (!state || !state.clientDueAt) {
          skipped++;
          continue;
        }

        const outstanding = clientItemsOutstanding(state);
        if (outstanding.length === 0) {
          skipped++;
          continue;
        }

        const days = daysUntilDue(state, now);
        if (days === null) {
          skipped++;
          continue;
        }

        const dueDate = state.clientDueAt;
        const overdue = days < 0;

        // ── Admin alert — once, on the first overdue run ──
        if (overdue && !state.overdueNotifiedAt) {
          const [client] = await db
            .select({ name: engagementSigners.name })
            .from(engagementSigners)
            .where(
              and(
                eq(engagementSigners.engagementId, row.id),
                gt(engagementSigners.order, 0)
              )
            )
            .orderBy(engagementSigners.order)
            .limit(1);
          const clientName = client?.name || "A client";
          const n = outstanding.length;
          try {
            await createNotification({
              userId: row.ownerId,
              type: "onboarding_overdue",
              title: `${clientName} is past their onboarding due date`,
              message: `${n} item${n === 1 ? "" : "s"} still outstanding since ${formatDueDate(dueDate)}`,
              metadata: { engagementId: row.id },
            });
            await setOnboardingValues(row.id, [
              { segments: ["overdueNotifiedAt"], value: now.toISOString() },
            ]);
            overdueAlerts++;
          } catch (err) {
            console.error(`Overdue alert failed for engagement ${row.id}:`, err);
          }
        }

        // ── Client reminder ──
        if (!shouldRemindToday(days)) {
          skipped++;
          continue;
        }

        const sentDates = Array.isArray(state.dueRemindersSent)
          ? state.dueRemindersSent
          : [];
        if (sentDates.includes(today)) {
          skipped++;
          continue;
        }

        const [recentReminder] = await db
          .select({ id: emailLog.id })
          .from(emailLog)
          .where(
            and(
              eq(emailLog.emailType, EMAIL_TYPE),
              eq(emailLog.relatedId, row.id),
              gt(emailLog.createdAt, midnight)
            )
          )
          .limit(1);
        if (recentReminder) {
          skipped++;
          continue;
        }

        const signers = await db
          .select({
            name: engagementSigners.name,
            email: engagementSigners.email,
            token: engagementSigners.token,
            order: engagementSigners.order,
            status: engagementSigners.status,
          })
          .from(engagementSigners)
          .where(
            and(
              eq(engagementSigners.engagementId, row.id),
              gt(engagementSigners.order, 0)
            )
          )
          .orderBy(engagementSigners.order);
        const recipients = signers.filter(
          (s) => s.status !== "declined" && s.email
        );
        if (recipients.length === 0) {
          skipped++;
          continue;
        }

        const [owner] = await db
          .select({ name: users.name, companyName: users.companyName })
          .from(users)
          .where(eq(users.id, row.ownerId))
          .limit(1);
        const branding = await getOwnerBranding(row.ownerId);
        const senderName =
          owner?.companyName || owner?.name || branding.displayName;
        const outstandingItems = outstanding.map((id) => TASK_INFO[id].title);

        let delivered = 0;
        for (const s of recipients) {
          try {
            const { subject, html } = buildOnboardingDueReminderEmail({
              clientName: s.name,
              senderName,
              dueDate,
              daysLeft: days,
              outstandingItems,
              onboardingUrl: getOnboardingUrl(s.token),
              branding,
            });
            await sendEmailWithLog({
              to: s.email,
              subject,
              html,
              fromName: branding.fromName,
              recipientName: s.name,
              emailType: EMAIL_TYPE,
              relatedId: row.id,
              sentBy: row.ownerId,
            });
            delivered++;
          } catch (err) {
            console.error(
              `Onboarding reminder to ${s.email} failed (engagement ${row.id}):`,
              err
            );
          }
        }

        if (delivered === 0) {
          skipped++;
          continue;
        }

        // Write the whole array — jsonb_set replaces the value at the path.
        await setOnboardingValues(row.id, [
          { segments: ["dueRemindersSent"], value: [...sentDates, today] },
        ]);
        const n = outstanding.length;
        await appendActivity(row.id, {
          actor: "system",
          type: "due_reminder",
          message: `Reminder sent: ${n} item${n === 1 ? "" : "s"} still needed by ${formatDueDate(dueDate)}`,
        });
        remindersSent++;
      } catch (err) {
        console.error(
          `Failed to process onboarding reminder for engagement ${row.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("Failed to process onboarding reminders:", err);
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    overdueAlerts,
    skipped,
  });
}
