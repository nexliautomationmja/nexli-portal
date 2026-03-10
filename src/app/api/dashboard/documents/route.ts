import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const conditions = [eq(documents.ownerId, session.user.id)];

  if (status && status !== "all") {
    conditions.push(eq(documents.status, status as "new" | "reviewed" | "archived"));
  }

  if (category) {
    conditions.push(eq(documents.category, category));
  }

  if (search) {
    conditions.push(
      or(
        ilike(documents.fileName, `%${search}%`),
        ilike(documents.clientName, `%${search}%`),
        ilike(documents.clientEmail, `%${search}%`)
      )!
    );
  }

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({
    documents: rows,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}
