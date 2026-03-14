import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const typeFilter = searchParams.get("type");
  const offset = (page - 1) * limit;

  const conditions = [eq(emailLog.sentBy, session.user.id)];
  if (typeFilter) {
    conditions.push(eq(emailLog.emailType, typeFilter));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLog)
    .where(whereClause);

  const total = Number(countResult.count);

  const emails = await db
    .select()
    .from(emailLog)
    .where(whereClause)
    .orderBy(desc(emailLog.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    emails,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
