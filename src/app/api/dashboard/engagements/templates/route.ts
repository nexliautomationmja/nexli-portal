import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  ORIGINAL_DRS_TEMPLATE_NAME,
  ORIGINAL_DRS_TEMPLATE_CONTENT,
  STARTER_DRS_TEMPLATE_NAME,
  STARTER_DRS_TEMPLATE_CONTENT,
} from "@/lib/engagement-defaults";

// Default templates to auto-seed for every user (checked by exact name)
const DEFAULT_TEMPLATES = [
  { name: ORIGINAL_DRS_TEMPLATE_NAME, content: ORIGINAL_DRS_TEMPLATE_CONTENT },
  { name: STARTER_DRS_TEMPLATE_NAME, content: STARTER_DRS_TEMPLATE_CONTENT },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-seed default templates if they don't exist
  for (const tmpl of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select({ id: engagementTemplates.id })
      .from(engagementTemplates)
      .where(
        and(
          eq(engagementTemplates.ownerId, session.user.id),
          eq(engagementTemplates.name, tmpl.name)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(engagementTemplates).values({
        ownerId: session.user.id,
        name: tmpl.name,
        content: tmpl.content,
      });
    }
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
