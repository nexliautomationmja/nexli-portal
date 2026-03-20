import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { calendarConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, session.user.id),
        eq(calendarConnections.provider, "google")
      )
    );

  return NextResponse.json({ ok: true });
}
