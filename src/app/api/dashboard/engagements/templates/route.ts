import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  DRS_TEMPLATE_NAME,
  DRS_TEMPLATE_CONTENT,
} from "@/lib/engagement-defaults";

// One flat all-in-one default template, auto-seeded for every user.
const DEFAULT_TEMPLATES = [
  { name: DRS_TEMPLATE_NAME, content: DRS_TEMPLATE_CONTENT },
];

// Phrases that only appear in the OLD (pre-flat) pricing templates — setup
// fees, retainers, ad tiers. An auto-seeded DRS-named template still
// containing any of these is stale and safe to refresh to the current flat
// default. The new flat template never uses these phrases (it says
// "Monthly Investment" / "Annual Investment" / "Performance Fee").
const OLD_PRICING_MARKERS = [
  "Initial Setup Fee",
  "Final Setup Fee",
  "Monthly Retainer",
  "Monthly Subscription",
  "Setup Investment",
  "Ad Management Tier",
];

function isStaleOldPricing(content: string): boolean {
  return OLD_PRICING_MARKERS.some((m) => content.includes(m));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-seed default templates if they don't exist; refresh templates that
  // still hold an older shipped default (user-edited content never matches a
  // legacy hash and is left untouched).
  for (const tmpl of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select({
        id: engagementTemplates.id,
        content: engagementTemplates.content,
      })
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
    } else if (
      existing.content !== tmpl.content &&
      isStaleOldPricing(existing.content)
    ) {
      // Auto-upgrade a stale old-pricing DRS template to the flat default.
      await db
        .update(engagementTemplates)
        .set({ content: tmpl.content, updatedAt: new Date() })
        .where(eq(engagementTemplates.id, existing.id));
    }
  }

  // Remove auto-seeded legacy "Starter Digital Rainmaker System" templates that
  // still carry old-pricing content (the flat model has a single template).
  const starterRows = await db
    .select({ id: engagementTemplates.id, content: engagementTemplates.content })
    .from(engagementTemplates)
    .where(
      and(
        eq(engagementTemplates.ownerId, session.user.id),
        eq(engagementTemplates.name, "Starter Digital Rainmaker System")
      )
    );
  for (const row of starterRows) {
    if (isStaleOldPricing(row.content)) {
      await db
        .delete(engagementTemplates)
        .where(eq(engagementTemplates.id, row.id));
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
