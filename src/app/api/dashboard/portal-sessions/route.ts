import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { portalSessions } from "@/db/schema";
import { desc, sql, gte } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Active sessions (not expired)
  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(portalSessions)
    .where(gte(portalSessions.expiresAt, now));

  // Unique clients in last 7 days
  const [uniqueClients] = await db
    .select({ count: sql<number>`count(distinct ${portalSessions.email})` })
    .from(portalSessions)
    .where(gte(portalSessions.createdAt, sevenDaysAgo));

  // Recent sessions
  const sessions = await db
    .select()
    .from(portalSessions)
    .orderBy(desc(portalSessions.createdAt))
    .limit(50);

  return NextResponse.json({
    stats: {
      totalActive: Number(activeCount.count),
      uniqueClients7d: Number(uniqueClients.count),
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      email: s.email,
      clientName: s.clientName,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isActive: new Date(s.expiresAt) > now,
    })),
  });
}
