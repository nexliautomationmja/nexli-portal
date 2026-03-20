import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;
  const ownerId = session.ownerId;

  // Find all engagement signers for this email
  const signerRows = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.email, email))
    .orderBy(desc(engagementSigners.createdAt));

  // Fetch the parent engagements (with ownerId scoping)
  const engagementIds = [
    ...new Set(signerRows.map((s) => s.engagementId)),
  ];

  const engagementMap = new Map<string, typeof engagements.$inferSelect>();
  for (const eid of engagementIds) {
    const [eng] = await db
      .select()
      .from(engagements)
      .where(
        ownerId
          ? and(eq(engagements.id, eid), eq(engagements.ownerId, ownerId))
          : eq(engagements.id, eid)
      )
      .limit(1);
    if (eng) {
      engagementMap.set(eid, eng);
    }
  }

  // Fetch all signers for these engagements (for document signatures)
  const allSignersMap = new Map<string, { name: string; role: string | null; signatureData: string | null; signedAt: Date | null }[]>();
  for (const eid of engagementIds) {
    if (!engagementMap.has(eid)) continue;
    const signers = await db
      .select({
        name: engagementSigners.name,
        role: engagementSigners.role,
        signatureData: engagementSigners.signatureData,
        signedAt: engagementSigners.signedAt,
        order: engagementSigners.order,
      })
      .from(engagementSigners)
      .where(eq(engagementSigners.engagementId, eid));
    allSignersMap.set(
      eid,
      signers.sort((a, b) => a.order - b.order).map((s) => ({
        name: s.name,
        role: s.role,
        signatureData: s.signatureData,
        signedAt: s.signedAt,
      }))
    );
  }

  // Fetch owner info for document header
  let ownerInfo: { name: string; companyName: string } | null = null;
  if (ownerId) {
    const [o] = await db
      .select({ name: users.name, companyName: users.companyName })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    if (o) {
      ownerInfo = { name: o.name || "", companyName: o.companyName || "" };
    }
  }

  // Only include signers whose engagements belong to the session's owner
  const result = signerRows
    .filter((signer) => engagementMap.has(signer.engagementId))
    .map((signer) => {
      const engagement = engagementMap.get(signer.engagementId)!;
      return {
        signerId: signer.id,
        signerStatus: signer.status,
        signerToken: signer.token,
        signedAt: signer.signedAt,
        declinedAt: signer.declinedAt,
        role: signer.role,
        engagementId: signer.engagementId,
        subject: engagement.subject || "Engagement Letter",
        content: engagement.content,
        engagementStatus: engagement.status || "unknown",
        sentAt: engagement.sentAt,
        expiresAt: engagement.expiresAt,
        createdAt: engagement.createdAt,
        signers: allSignersMap.get(signer.engagementId) || [],
      };
    });

  return NextResponse.json({
    engagements: result,
    from: ownerInfo
      ? { name: ownerInfo.name, company: ownerInfo.companyName }
      : { name: "", company: "" },
  });
}
