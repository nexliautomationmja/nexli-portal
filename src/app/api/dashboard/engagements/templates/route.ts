import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// SHA-256 hashes of every previously-shipped default template content.
// A stored template whose content matches one of these was seeded by us and
// never edited by the user, so it's safe to overwrite with the current
// default. Append the outgoing hashes here on each future pricing change.
const LEGACY_CONTENT_HASHES = new Set([
  // Original DRS — seed route @ 0851cab ("Engagement letter to invoice pipeline")
  "33bf09c519e150b853c9d259d9486a5fb008616818d984f4f87ae882603ad89f",
  // Original DRS — seed route @ b7aa2aa ("Rename GHL to Nexli Whitelabel Dashboard")
  "9510da7bf3d4ffac543a1989de71b489d8c57853700e547ecfc531d0ef7109a3",
  // Original DRS — engagement-defaults @ 9c237e9 ($997/mo, ACH-only)
  "d22d790233ddb3151cc055e0276bc76df6c1caa0ba5f50d6f4d8434f17182d61",
  // Starter DRS — engagement-defaults @ 9c237e9 ($997/mo, ACH-only)
  "571cd4e1bcfd52f335cbd688c10f3752260e6b1340179095ec23c14bd6b13401",
]);

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
      LEGACY_CONTENT_HASHES.has(sha256(existing.content))
    ) {
      await db
        .update(engagementTemplates)
        .set({ content: tmpl.content, updatedAt: new Date() })
        .where(eq(engagementTemplates.id, existing.id));
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
