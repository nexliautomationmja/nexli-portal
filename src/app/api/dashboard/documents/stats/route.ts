import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get counts by status
  const statusCounts = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(eq(documents.ownerId, userId))
    .groupBy(documents.status);

  // Get this month's uploads
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [monthCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, userId),
        gte(documents.createdAt, firstOfMonth)
      )
    );

  const stats = {
    total: 0,
    new: 0,
    reviewed: 0,
    archived: 0,
    thisMonth: Number(monthCount.count),
  };

  for (const row of statusCounts) {
    const count = Number(row.count);
    stats.total += count;
    if (row.status === "new") stats.new = count;
    if (row.status === "reviewed") stats.reviewed = count;
    if (row.status === "archived") stats.archived = count;
  }

  return NextResponse.json(stats);
}
