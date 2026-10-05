import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientWeeklyUpdates } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { activeDrsClients } from "@/lib/client-success";

/**
 * Friday 14:00 UTC (vercel.json): nudge Marcel about every active DRS client
 * who hasn't been sent this week's update yet. One notification listing them
 * all (also emailed to mail@nexli.net by createNotification).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = weekStartOf(new Date());

  try {
    await ensureClientSuccessTables();
    const { adminId, clients } = await activeDrsClients();
    if (!adminId || clients.length === 0) {
      return NextResponse.json({ ok: true, weekStart, clients: 0, pending: 0, notified: false });
    }

    const sentRows = await db
      .select({ clientUserId: clientWeeklyUpdates.clientUserId })
      .from(clientWeeklyUpdates)
      .where(
        and(
          inArray(
            clientWeeklyUpdates.clientUserId,
            clients.map((c) => c.clientUserId)
          ),
          eq(clientWeeklyUpdates.weekStart, weekStart),
          eq(clientWeeklyUpdates.status, "sent")
        )
      );
    const sentIds = new Set(sentRows.map((r) => r.clientUserId));
    const pending = clients.filter((c) => !sentIds.has(c.clientUserId));

    if (pending.length === 0) {
      return NextResponse.json({
        ok: true,
        weekStart,
        clients: clients.length,
        pending: 0,
        notified: false,
      });
    }

    const names = pending.map((c) => c.company || c.name || c.email);
    const n = pending.length;
    await createNotification({
      userId: adminId,
      type: "weekly_update_due",
      title: "Weekly client updates due",
      message: `${n} client${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} this week's update: ${names.join(", ")}`,
      metadata: {
        weekStart,
        clients: pending.map((c) => ({ clientUserId: c.clientUserId, name: c.name, email: c.email })),
      },
    });

    return NextResponse.json({
      ok: true,
      weekStart,
      clients: clients.length,
      pending: n,
      notified: true,
    });
  } catch (err) {
    console.error("Weekly update reminder cron failed:", err);
    return NextResponse.json({ ok: false, weekStart, error: "failed" }, { status: 500 });
  }
}
