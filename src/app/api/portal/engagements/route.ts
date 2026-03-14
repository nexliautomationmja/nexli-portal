import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners } from "@/db/schema";
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
        engagementStatus: engagement.status || "unknown",
        sentAt: engagement.sentAt,
        expiresAt: engagement.expiresAt,
        createdAt: engagement.createdAt,
      };
    });

  return NextResponse.json({ engagements: result });
}
