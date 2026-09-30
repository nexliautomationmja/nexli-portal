import type { Metadata } from "next";
import { db } from "@/db";
import { engagements, engagementSigners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOwnerBranding, NEXLI_BRANDING } from "@/lib/branding";
import { EngageClient } from "./engage-client";

export const metadata: Metadata = {
  title: "Engagement Letter | Nexli Portal",
};

export default async function EngagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolve the issuing firm's branding server-side (signer token → engagement
  // → ownerId). Any lookup failure falls back to Nexli branding.
  let branding = NEXLI_BRANDING;
  try {
    const [row] = await db
      .select({ ownerId: engagements.ownerId })
      .from(engagementSigners)
      .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
      .where(eq(engagementSigners.token, token))
      .limit(1);
    branding = await getOwnerBranding(row?.ownerId);
  } catch (err) {
    console.error("[engage page] branding lookup failed:", err);
  }

  return <EngageClient token={token} branding={branding} />;
}
