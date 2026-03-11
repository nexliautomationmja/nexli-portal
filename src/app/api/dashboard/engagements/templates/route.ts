import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await db
    .select()
    .from(engagementTemplates)
    .where(eq(engagementTemplates.ownerId, session.user.id))
    .orderBy(desc(engagementTemplates.createdAt));

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, content } = body;

  if (!name || !content) {
    return NextResponse.json(
      { error: "name and content are required" },
      { status: 400 }
    );
  }

  const [template] = await db
    .insert(engagementTemplates)
    .values({
      ownerId: session.user.id,
      name,
      content,
    })
    .returning();

  return NextResponse.json({ template }, { status: 201 });
}
