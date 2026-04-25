import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners, users } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
  const engagementIds = [...new Set(signerRows.map((s) => s.engagementId))];

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

  // Visible engagement IDs (after owner scoping)
  const visibleIds = Array.from(engagementMap.keys());

  // Fetch ALL signers for visible engagements (so client can see sender signature too)
  const allSigners =
    visibleIds.length > 0
      ? await db
          .select()
          .from(engagementSigners)
          .where(inArray(engagementSigners.engagementId, visibleIds))
      : [];

  const signersByEngagement: Record<string, typeof allSigners> = {};
  for (const s of allSigners) {
    if (!signersByEngagement[s.engagementId]) {
      signersByEngagement[s.engagementId] = [];
    }
    signersByEngagement[s.engagementId].push(s);
  }

  // Fetch owner info (name + company) for sender display
  const ownerIds = [
    ...new Set(
      Array.from(engagementMap.values()).map((e) => e.ownerId)
    ),
  ];
  const ownerRows =
    ownerIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            companyName: users.companyName,
          })
          .from(users)
          .where(inArray(users.id, ownerIds))
      : [];
  const ownerMap = new Map(ownerRows.map((o) => [o.id, o]));

  // Only include signers whose engagements belong to the session's owner
  const result = signerRows
    .filter((signer) => engagementMap.has(signer.engagementId))
    .map((signer) => {
      const engagement = engagementMap.get(signer.engagementId)!;
      const owner = ownerMap.get(engagement.ownerId);
      const allEngSigners = (signersByEngagement[signer.engagementId] || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          order: s.order,
          role: s.role,
          status: s.status,
          signedAt: s.signedAt,
          signatureData: s.signatureData,
        }));
      return {
        signerId: signer.id,
        signerStatus: signer.status,
        signerToken: signer.token,
        signedAt: signer.signedAt,
        declinedAt: signer.declinedAt,
        role: signer.role,
        signatureData: signer.signatureData,
        engagementId: signer.engagementId,
        subject: engagement.subject || "Engagement Letter",
        content: engagement.content || "",
        engagementStatus: engagement.status || "unknown",
        sentAt: engagement.sentAt,
        expiresAt: engagement.expiresAt,
        createdAt: engagement.createdAt,
        clientName: signer.name,
        fromName: owner?.name || "",
        fromCompany: owner?.companyName || "",
        signers: allEngSigners,
      };
    });

  return NextResponse.json({ engagements: result });
}
