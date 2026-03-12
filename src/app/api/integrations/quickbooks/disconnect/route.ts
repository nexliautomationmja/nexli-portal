import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(accountingConnections)
    .where(
      and(
        eq(accountingConnections.userId, session.user.id),
        eq(accountingConnections.provider, "quickbooks")
      )
    );

  return NextResponse.json({ ok: true });
}
