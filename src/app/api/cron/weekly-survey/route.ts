import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientSurveys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailWithLog } from "@/lib/email";
import { buildWeeklySurveyEmail, FOUNDATION_SENDER_NAME } from "@/lib/email-foundation";
import { getPortalUrl } from "@/lib/foundation-config";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { activeDrsClients, getOrCreateWeeklySurvey } from "@/lib/client-success";

/**
 * Monday 14:00 UTC (vercel.json): email every active DRS client this week's
 * 60-second pulse check. One survey row per (client, week); sentAt is the
 * dedupe, so re-running the cron is safe.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = weekStartOf(new Date());
  const portalUrl = getPortalUrl();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let clientsSeen = 0;

  try {
    await ensureClientSuccessTables();
    const { adminId, clients } = await activeDrsClients();
    clientsSeen = clients.length;

    for (const client of clients) {
      try {
        const survey = await getOrCreateWeeklySurvey(client.clientUserId, weekStart);
        if (survey.sentAt) {
          skipped++;
          continue;
        }

        const { subject, html } = buildWeeklySurveyEmail({
          clientName: client.name,
          weekStart,
          surveyUrl: `${portalUrl}/survey/${survey.token}`,
        });
        await sendEmailWithLog({
          to: client.email,
          subject,
          html,
          fromName: FOUNDATION_SENDER_NAME,
          recipientName: client.name || undefined,
          emailType: "weekly_survey",
          relatedId: survey.id,
          sentBy: adminId || undefined,
        });
        await db
          .update(clientSurveys)
          .set({ sentAt: new Date() })
          .where(eq(clientSurveys.id, survey.id));
        sent++;
      } catch (err) {
        failed++;
        console.error(`Weekly survey failed for ${client.email}:`, err);
      }
    }
  } catch (err) {
    console.error("Weekly survey cron failed:", err);
  }

  return NextResponse.json({ ok: true, weekStart, clients: clientsSeen, sent, skipped, failed });
}
