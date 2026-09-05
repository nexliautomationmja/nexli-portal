import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  DRS_TEMPLATE_NAME,
  DRS_MONTHLY_TEMPLATE_NAME,
  DRS_MONTHLY_TEMPLATE_CONTENT,
  DRS_ANNUAL_TEMPLATE_NAME,
  DRS_ANNUAL_TEMPLATE_CONTENT,
} from "@/lib/engagement-defaults";

// Two flat all-in-one default templates (Monthly + Annual), auto-seeded for
// every user.
const DEFAULT_TEMPLATES = [
  { name: DRS_MONTHLY_TEMPLATE_NAME, content: DRS_MONTHLY_TEMPLATE_CONTENT },
  { name: DRS_ANNUAL_TEMPLATE_NAME, content: DRS_ANNUAL_TEMPLATE_CONTENT },
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

// Revision marker: every shipped default since Sep 2026 contains the Nexli
// Triple Guarantee section. A DRS-named row that has the flat-pricing ad
// section but lacks the guarantee is an older revision — either an old
// shipped seed or a user's edited copy of one. We can't tell those apart,
// so the refresh must NEVER overwrite: the old row is renamed "(previous)"
// (preserving any edits) and a fresh seed is inserted under the default
// name. The compose UI regenerates DRS letters from code anyway; this keeps
// the stored rows from drifting.
function isStaleShippedRevision(content: string): boolean {
  return (
    content.includes("AD MANAGEMENT (PERFORMANCE-BASED)") &&
    !content.includes("NEXLI TRIPLE GUARANTEE")
  );
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
      // Auto-upgrade a stale old-pricing DRS template to the flat default —
      // these markers only ever appear in pre-flat seeds, never user copy.
      await db
        .update(engagementTemplates)
        .set({ content: tmpl.content, updatedAt: new Date() })
        .where(eq(engagementTemplates.id, existing.id));
    } else if (
      existing.content !== tmpl.content &&
      isStaleShippedRevision(existing.content)
    ) {
      // Pre-guarantee revision (possibly user-edited): preserve it under a
      // "(previous)" name and seed the current default fresh.
      await db
        .update(engagementTemplates)
        .set({ name: `${tmpl.name} (previous)`, updatedAt: new Date() })
        .where(eq(engagementTemplates.id, existing.id));
      await db.insert(engagementTemplates).values({
        ownerId: session.user.id,
        name: tmpl.name,
        content: tmpl.content,
      });
    }
  }

  // Remove auto-seeded legacy templates that were superseded: the old
  // Starter template (old pricing) and the transitional single
  // "Digital Rainmaker System" template (replaced by the Monthly/Annual
  // pair). Only unedited auto-seeded content is deleted — a template the
  // user modified never matches these checks.
  const legacyNames = ["Starter Digital Rainmaker System", DRS_TEMPLATE_NAME];
  for (const legacyName of legacyNames) {
    const rows = await db
      .select({ id: engagementTemplates.id, content: engagementTemplates.content })
      .from(engagementTemplates)
      .where(
        and(
          eq(engagementTemplates.ownerId, session.user.id),
          eq(engagementTemplates.name, legacyName)
        )
      );
    for (const row of rows) {
      const isExactSeed =
        row.content === DRS_MONTHLY_TEMPLATE_CONTENT ||
        row.content === DRS_ANNUAL_TEMPLATE_CONTENT;
      // Heuristic match: an older seeded revision (old pricing markers, or
      // the flat fee-section phrasing from an earlier constants revision).
      const looksSeeded =
        isStaleOldPricing(row.content) ||
        row.content.includes("Monthly Investment:") ||
        row.content.includes("Annual Investment (Paid in Full):");

      if (isExactSeed) {
        // Provably our unedited seed — safe to delete outright.
        await db
          .delete(engagementTemplates)
          .where(eq(engagementTemplates.id, row.id));
      } else if (looksSeeded) {
        // Might carry user edits — never destroy content. Rename it out of
        // the legacy name so it stops being reprocessed but stays available.
        await db
          .update(engagementTemplates)
          .set({ name: `${legacyName} (legacy)`, updatedAt: new Date() })
          .where(eq(engagementTemplates.id, row.id));
      }
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
