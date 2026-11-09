import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, desc, and, or, like, inArray } from "drizzle-orm";
import {
  DRS_TEMPLATE_NAME,
  DRS_MONTHLY_TEMPLATE_NAME,
  DRS_MONTHLY_TEMPLATE_CONTENT,
  DRS_ANNUAL_TEMPLATE_NAME,
  DRS_ANNUAL_TEMPLATE_CONTENT,
  isCurrentDrsRevision,
} from "@/lib/engagement-defaults";
import type { BillingPlan } from "@/lib/drs-pricing";
import {
  ENTERPRISE_TEMPLATE_CONTENT,
  isCurrentEnterpriseRevision,
} from "@/lib/enterprise-engagement";
import { ENTERPRISE_TEMPLATE_NAME } from "@/lib/enterprise-pricing";
import { getNexliAdminId } from "@/lib/foundation-project";

// Default templates auto-seeded for every user: the two flat all-in-one DRS
// letters (Monthly + Annual) and the Nexli Enterprise License letter (seeded
// at the Core tier; the compose UI regenerates per tier).
type DefaultTemplate =
  | { name: string; content: string; kind: "drs"; plan: BillingPlan }
  | { name: string; content: string; kind: "enterprise"; plan?: undefined };

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  { name: DRS_MONTHLY_TEMPLATE_NAME, content: DRS_MONTHLY_TEMPLATE_CONTENT, kind: "drs", plan: "monthly" },
  { name: DRS_ANNUAL_TEMPLATE_NAME, content: DRS_ANNUAL_TEMPLATE_CONTENT, kind: "drs", plan: "annual" },
  { name: ENTERPRISE_TEMPLATE_NAME, content: ENTERPRISE_TEMPLATE_CONTENT, kind: "enterprise" },
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

// Revision check: a default-named row that is the right kind of agreement
// but does not match the currently shipped revision (same fee line, same
// section headings, current revision markers — see isCurrentDrsRevision /
// isCurrentEnterpriseRevision) is an older revision: for DRS the 20%/6%
// revenue-share letters, the $39,997 annual letter, the stacking-bonus
// letter, etc.
function isStaleShippedRevision(content: string, tmpl: DefaultTemplate): boolean {
  if (tmpl.kind === "enterprise") {
    return (
      content.includes("LICENSE AND IMPLEMENTATION AGREEMENT") &&
      !isCurrentEnterpriseRevision(content, "core")
    );
  }
  return (
    content.includes("SERVICE ENGAGEMENT AGREEMENT") &&
    !isCurrentDrsRevision(content, tmpl.plan)
  );
}

// Superseded DRS template names that earlier revisions of this route seeded
// or renamed: the old Starter template, the transitional single
// "Digital Rainmaker System" template, and the "(previous …)" / "(legacy)"
// copies the old non-destructive refresh left behind. Marcel asked (Sep 20
// 2026) for all of these to go so only the current Monthly/Annual pair is
// listed. Edits to DRS-named templates were never used anyway — the compose
// UI regenerates DRS letters from code — so nothing functional is lost.
const SUPERSEDED_EXACT_NAMES = ["Starter Digital Rainmaker System", DRS_TEMPLATE_NAME];
const SUPERSEDED_NAME_PATTERNS = [
  "%Digital Rainmaker System%(previous%",
  "%Digital Rainmaker System%(legacy)%",
  "%Nexli Enterprise License%(previous%",
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Nexli's own letters (Digital Rainmaker + Enterprise) name Nexli
  // Automation LLC as the provider and auto-invoice Nexli's prices on
  // signing, so only the Nexli admin account (and its team logins, which
  // share its user id) gets them. A firm tenant is never offered them, and
  // default-named rows seeded into a tenant before this fix are removed.
  // When the admin lookup fails, nothing is seeded or removed this time.
  const nexliAdminId = await getNexliAdminId();
  if (nexliAdminId && session.user.id === nexliAdminId) {
    // Auto-seed the default templates if missing; overwrite in place any
    // default-named row that still holds an older revision, so the Templates
    // list always shows exactly the current letters. Only default-named rows
    // (DRS + Enterprise) are ever touched.
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
        (isStaleOldPricing(existing.content) ||
          isStaleShippedRevision(existing.content, tmpl))
      ) {
        await db
          .update(engagementTemplates)
          .set({ content: tmpl.content, updatedAt: new Date() })
          .where(eq(engagementTemplates.id, existing.id));
      }
    }
  } else if (nexliAdminId) {
    await db.delete(engagementTemplates).where(
      and(
        eq(engagementTemplates.ownerId, session.user.id),
        inArray(
          engagementTemplates.name,
          DEFAULT_TEMPLATES.map((t) => t.name)
        )
      )
    );
  }

  // Delete superseded DRS template rows (see SUPERSEDED_* above).
  await db.delete(engagementTemplates).where(
    and(
      eq(engagementTemplates.ownerId, session.user.id),
      or(
        inArray(engagementTemplates.name, SUPERSEDED_EXACT_NAMES),
        ...SUPERSEDED_NAME_PATTERNS.map((p) => like(engagementTemplates.name, p))
      )
    )
  );

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
