import type { Metadata } from "next";
import { db } from "@/db";
import { engagements, engagementSigners, engagementTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOwnerBranding, NEXLI_BRANDING } from "@/lib/branding";
import { getNexliAdminId } from "@/lib/foundation-project";
import { isCurrentDrsRevision } from "@/lib/engagement-defaults";
import { isCurrentEnterpriseRevision } from "@/lib/enterprise-engagement";
import {
  isEnterpriseTemplateName,
  isEnterpriseTier,
  type EnterpriseTier,
} from "@/lib/enterprise-pricing";
import type { BillingPlan } from "@/lib/drs-pricing";
import { EngageClient } from "./engage-client";
import { EngageLaunchPadClient } from "./engage-launch-pad-client";

export const metadata: Metadata = {
  title: "Engagement Letter | Nexli Portal",
};

type LetterView =
  | { kind: "standard" }
  | { kind: "drs"; plan: BillingPlan; showSummaries: boolean }
  | { kind: "enterprise"; tier: EnterpriseTier; showSummaries: boolean }
  | { kind: "foundation" };

interface LetterRow {
  ownerId: string;
  content: string;
  metadata: unknown;
  templateName: string | null;
}

/**
 * Which signing page a letter gets. Only letters Nexli itself issues (owned
 * by the Nexli admin) get the Launch Pad page; everything a client firm
 * sends to its own clients stays on the classic page.
 */
function classifyLetter(row: LetterRow, nexliAdminId: string | null): LetterView {
  if (!nexliAdminId || row.ownerId !== nexliAdminId) return { kind: "standard" };

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const content = row.content.trimStart();
  const templateName = (row.templateName ?? "").toLowerCase();

  if (isEnterpriseTemplateName(row.templateName) || meta.offer === "enterprise") {
    const tier: EnterpriseTier = isEnterpriseTier(meta.enterpriseTier) ? meta.enterpriseTier : "core";
    return { kind: "enterprise", tier, showSummaries: isCurrentEnterpriseRevision(row.content, tier) };
  }

  if (templateName.includes("digital rainmaker") && content.startsWith("DIGITAL RAINMAKER SYSTEM")) {
    const plan: BillingPlan = meta.billingPlan === "annual" ? "annual" : "monthly";
    return { kind: "drs", plan, showSummaries: isCurrentDrsRevision(row.content, plan) };
  }

  if (content.startsWith("FIRM FOUNDATION") || meta.foundation === true) {
    return { kind: "foundation" };
  }

  return { kind: "standard" };
}

export default async function EngagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // One lookup (signer token → engagement → template). Any failure falls back
  // to the classic page with Nexli branding.
  let row: LetterRow | undefined;
  let view: LetterView = { kind: "standard" };
  try {
    [row] = await db
      .select({
        ownerId: engagements.ownerId,
        content: engagements.content,
        metadata: engagements.metadata,
        templateName: engagementTemplates.name,
      })
      .from(engagementSigners)
      .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
      .leftJoin(engagementTemplates, eq(engagements.templateId, engagementTemplates.id))
      .where(eq(engagementSigners.token, token))
      .limit(1);
    if (row) view = classifyLetter(row, await getNexliAdminId());
  } catch (err) {
    console.error("[engage page] letter lookup failed:", err);
    view = { kind: "standard" };
  }

  if (view.kind === "drs") {
    return (
      <EngageLaunchPadClient token={token} kind="drs" plan={view.plan} showSummaries={view.showSummaries} />
    );
  }
  if (view.kind === "enterprise") {
    return (
      <EngageLaunchPadClient token={token} kind="enterprise" tier={view.tier} showSummaries={view.showSummaries} />
    );
  }
  if (view.kind === "foundation") {
    return <EngageLaunchPadClient token={token} kind="foundation" showSummaries={false} />;
  }

  // Classic page: resolve the issuing firm's branding server-side (ownerId).
  // Any lookup failure falls back to Nexli branding.
  let branding = NEXLI_BRANDING;
  try {
    branding = await getOwnerBranding(row?.ownerId);
  } catch (err) {
    console.error("[engage page] branding lookup failed:", err);
  }

  return <EngageClient token={token} branding={branding} />;
}
