import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  pipelineLeads,
  users,
} from "@/db/schema";
import { and, eq, desc, inArray, isNull } from "drizzle-orm";
import { ensurePipelineTable } from "@/lib/pipeline-table";
import { type BillingPlan, TERM_MONTHS } from "@/lib/drs-pricing";
import { ENTERPRISE, isEnterpriseTier, isEnterpriseTemplateName } from "@/lib/enterprise-pricing";
import { createEngagement } from "@/lib/engagements";
import { fillClientPlaceholder } from "@/lib/engagement-defaults";
import { getOwnerBranding } from "@/lib/branding";

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

  // Signers for this owner's engagements only (one query).
  const engagementIds = rows.map((r) => r.id);
  const signers =
    engagementIds.length > 0
      ? await db.select().from(engagementSigners).where(inArray(engagementSigners.engagementId, engagementIds))
      : [];
  const signersByEngagement: Record<string, (typeof signers)[number][]> = {};
  for (const s of signers) {
    (signersByEngagement[s.engagementId] ??= []).push(s);
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
    // The letterhead the client saw (Nexli's for admins) — the letter view and its PDF use it.
    branding: await getOwnerBranding(session.user.id),
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
    clientCompany: rawClientCompany,
    pipelineLeadId: rawLeadId,
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

  // The client's firm name fills the letter's parties block ("Client: …");
  // falls back to the primary recipient's name.
  const clientCompany =
    typeof rawClientCompany === "string"
      ? rawClientCompany.trim().slice(0, 200) || null
      : null;
  const clientLabel = clientCompany || String(recipients[0].name).trim();

  // Optionally save as template (the raw letter, placeholder intact)
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
  // The template decides the offer — a tier value alone never makes a letter
  // Enterprise (the compose UI used to send its default "core" tier with every
  // letter, which mis-saved annual DRS letters and under-billed them).
  let selectedTemplateName = "";
  if (templateId) {
    try {
      const [tpl] = await db
        .select({ name: engagementTemplates.name })
        .from(engagementTemplates)
        .where(eq(engagementTemplates.id, templateId))
        .limit(1);
      selectedTemplateName = tpl?.name ?? "";
    } catch (err) {
      console.error("Engagement POST: template lookup failed:", err);
    }
  }
  const isEnterpriseLetter = isEnterpriseTemplateName(selectedTemplateName);
  const isDrsLetter = selectedTemplateName.toLowerCase().includes("digital rainmaker");

  let engagementMetadata: Record<string, unknown>;
  if (isEnterpriseLetter) {
    engagementMetadata = {
      offer: "enterprise",
      enterpriseTier: isEnterpriseTier(enterpriseTier) ? enterpriseTier : "core",
      termMonths: ENTERPRISE.LICENSE_MONTHS,
      clientCompany,
    };
  } else {
    // Prefer the explicit choice; fall back to the DRS template's name
    // ("… — Annual") or the letter text so annual can never silently become
    // monthly.
    const plan: BillingPlan =
      billingPlan === "annual" || billingPlan === "monthly"
        ? billingPlan
        : (isDrsLetter && selectedTemplateName.toLowerCase().includes("annual")) ||
            (typeof content === "string" && content.includes("Annual Investment (Paid in Full)"))
          ? "annual"
          : "monthly";
    engagementMetadata = {
      billingPlan: plan,
      termMonths: TERM_MONTHS[plan],
      clientCompany,
    };
  }

  // Picked from the pipeline: link the letter to the lead (it turns Won when
  // the up-front invoice is paid — lib/pipeline-won.ts), and fill in the
  // email / firm the lead didn't have yet (booked-call leads often lack them).
  if (typeof rawLeadId === "string" && /^[0-9a-f-]{36}$/i.test(rawLeadId)) {
    try {
      await ensurePipelineTable();
      const [lead] = await db
        .select()
        .from(pipelineLeads)
        .where(and(eq(pipelineLeads.id, rawLeadId), eq(pipelineLeads.ownerId, session.user.id), isNull(pipelineLeads.deletedAt)))
        .limit(1);
      if (lead) {
        engagementMetadata.pipelineLeadId = lead.id;
        const email = String(recipients[0].email).trim().slice(0, 320);
        const fill: Partial<typeof pipelineLeads.$inferInsert> = {};
        if (!lead.email && email) fill.email = email;
        if (!lead.company && clientCompany) fill.company = clientCompany;
        if (Object.keys(fill).length) {
          await db.update(pipelineLeads).set({ ...fill, updatedAt: new Date() }).where(eq(pipelineLeads.id, lead.id));
        }
      }
    } catch (err) {
      console.error("Engagement POST: pipeline lead link failed:", err);
    }
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
    content: fillClientPlaceholder(content, clientLabel),
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
