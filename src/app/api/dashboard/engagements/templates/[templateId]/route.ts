import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  const [template] = await db
    .select()
    .from(engagementTemplates)
    .where(
      and(
        eq(engagementTemplates.id, templateId),
        eq(engagementTemplates.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;
  const body = await req.json();
  const { name, content } = body;

  const [template] = await db
    .select()
    .from(engagementTemplates)
    .where(
      and(
        eq(engagementTemplates.id, templateId),
        eq(engagementTemplates.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (content !== undefined) updates.content = content;

  const [updated] = await db
    .update(engagementTemplates)
    .set(updates)
    .where(eq(engagementTemplates.id, templateId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  const [template] = await db
    .select()
    .from(engagementTemplates)
    .where(
      and(
        eq(engagementTemplates.id, templateId),
        eq(engagementTemplates.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .delete(engagementTemplates)
    .where(eq(engagementTemplates.id, templateId));

  return NextResponse.json({ ok: true });
}
