import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const since = req.nextUrl.searchParams.get("since");

  const [{ count: unreadCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false))
    );

  const recent = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  let newNotifications: typeof recent = [];
  if (since) {
    newNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          gt(notifications.createdAt, new Date(since))
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(5);
  }

  return NextResponse.json({
    unreadCount,
    notifications: recent.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    newNotifications: newNotifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.read, false)
        )
      );
  } else if (notificationId) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, session.user.id)
        )
      );
  }

  return NextResponse.json({ ok: true });
}
