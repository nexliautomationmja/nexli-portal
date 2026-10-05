import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  users,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { type BillingPlan, TERM_MONTHS } from "@/lib/drs-pricing";
import { ENTERPRISE, isEnterpriseTier } from "@/lib/enterprise-pricing";
import { createEngagement } from "@/lib/engagements";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(engagements)
    .where(eq(engagements.ownerId, session.user.id))
    .orderBy(desc(engagements.createdAt));

  // Fetch signers for all engagements
  const engagementIds = rows.map((r) => r.id);
  const allSigners =
    engagementIds.length > 0
      ? await db
          .select()
          .from(engagementSigners)
          .where(
            eq(
              engagementSigners.engagementId,
              engagementIds.length === 1 ? engagementIds[0] : engagementIds[0]
            )
          )
      : [];

  // If more than one engagement, fetch all signers at once
  const signersByEngagement: Record<string, (typeof allSigners)[number][]> = {};
  if (engagementIds.length > 0) {
    const signers = await db.select().from(engagementSigners);
    const ownerEngagementIds = new Set(engagementIds);
    for (const s of signers) {
      if (!ownerEngagementIds.has(s.engagementId)) continue;
      if (!signersByEngagement[s.engagementId]) {
        signersByEngagement[s.engagementId] = [];
      }
      signersByEngagement[s.engagementId].push(s);
    }
  }

  const enriched = rows.map((eng) => ({
    ...eng,
    signers: (signersByEngagement[eng.id] || []).sort(
      (a, b) => a.order - b.order
    ),
  }));

  // Fetch owner info for document preview
  const [owner] = await db
    .select({ name: users.name, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    engagements: enriched,
    from: {
      name: owner?.name || "",
      company: owner?.companyName || "",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    recipients,
    subject,
    content,
    templateId,
    expiresInDays = 30,
    saveAsTemplate,
    templateName,
    billingPlan,
    enterpriseTier,
  } = body;

  if (
    !recipients ||
    !Array.isArray(recipients) ||
    recipients.length === 0 ||
    recipients.length > 5
  ) {
    return NextResponse.json(
      { error: "1 to 5 recipients are required" },
      { status: 400 }
    );
  }

  for (const r of recipients) {
    if (!r.name || !r.email) {
      return NextResponse.json(
        { error: "Each recipient must have a name and email" },
        { status: 400 }
      );
    }
  }

  if (!subject || !content) {
    return NextResponse.json(
      { error: "subject and content are required" },
      { status: 400 }
    );
  }

  // Optionally save as template
  if (saveAsTemplate && templateName) {
    await db.insert(engagementTemplates).values({
      ownerId: session.user.id,
      name: templateName,
      content,
    });
  }

  // Snapshot the chosen offer onto the engagement so auto-invoicing bills
  // exactly what the signed contract says. Enterprise letters carry their
  // tier (no billingPlan key — DRS-only logic keys on billingPlan); DRS
  // letters carry the flat billing plan.
  let engagementMetadata: Record<string, unknown>;
  if (isEnterpriseTier(enterpriseTier)) {
    engagementMetadata = {
      offer: "enterprise",
      enterpriseTier,
      termMonths: ENTERPRISE.LICENSE_MONTHS,
    };
  } else {
    const plan: BillingPlan = billingPlan === "annual" ? "annual" : "monthly";
    engagementMetadata = { billingPlan: plan, termMonths: TERM_MONTHS[plan] };
  }

  const senderName =
    session.user.name || session.user.email || "Your Service Provider";
  const cpaEmail = session.user.email || "";

  // Fetch company name for CPA representative role
  const [ownerInfo] = await db
    .select({ companyName: users.companyName })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const senderIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "system";

  const { engagement, signers, emailErrors } = await createEngagement({
    ownerId: session.user.id,
    senderName,
    senderEmail: cpaEmail,
    senderCompanyName: ownerInfo?.companyName || "",
    subject,
    content,
    templateId: templateId || null,
    expiresInDays,
    recipients: recipients.map((r: { name: string; email: string }) => ({
      name: r.name,
      email: r.email,
    })),
    metadata: engagementMetadata,
    requestIp: senderIp,
  });

  return NextResponse.json(
    {
      engagement,
      // Same shape the client expects today (no tokens exposed).
      signers: signers.map(({ name, email, engageUrl }) => ({
        name,
        email,
        engageUrl,
      })),
      emailErrors: emailErrors.length > 0 ? emailErrors : null,
    },
    { status: 201 }
  );
}
