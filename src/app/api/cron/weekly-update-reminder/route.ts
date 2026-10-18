import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { activeDrsClients, latestUpdateStatus } from "@/lib/client-success";

/**
 * Friday 14:00 UTC (vercel.json): nudge Marcel about every active DRS client
 * whose weekly update is due, overdue or has never been sent (same rule as
 * the Client Tracker's "Update" column and the sidebar pill). One
 * notification listing them all (also emailed to mail@nexli.net by
 * createNotification). Brand-new clients ("pending") are skipped.
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

    const clientSince = new Map<string, Date | null>(
      clients.map((c) => [c.clientUserId, c.startDate ? new Date(c.startDate) : null])
    );
    const statuses = await latestUpdateStatus(
      clients.map((c) => c.clientUserId),
      { clientSince }
    );
    const pending = clients.filter((c) => {
      const state = statuses.get(c.clientUserId)?.state;
      return state === "due" || state === "overdue" || state === "never";
    });

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
        clients: pending.map((c) => ({
          clientUserId: c.clientUserId,
          name: c.name,
          email: c.email,
          state: statuses.get(c.clientUserId)?.state ?? null,
          daysSinceSent: statuses.get(c.clientUserId)?.daysSinceSent ?? null,
        })),
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
