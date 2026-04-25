import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentLinks, eSignatures, users } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;
  const ownerId = session.ownerId;

  // Documents uploaded by/for the client
  const clientDocs = await db
    .select()
    .from(documents)
    .where(
      ownerId
        ? and(eq(documents.clientEmail, email), eq(documents.ownerId, ownerId))
        : eq(documents.clientEmail, email)
    )
    .orderBy(desc(documents.createdAt));

  // Active upload links
  const uploadLinks = await db
    .select()
    .from(documentLinks)
    .where(
      ownerId
        ? and(eq(documentLinks.clientEmail, email), eq(documentLinks.ownerId, ownerId))
        : eq(documentLinks.clientEmail, email)
    )
    .orderBy(desc(documentLinks.createdAt));

  // E-signature requests
  const esignRequests = await db
    .select()
    .from(eSignatures)
    .where(
      ownerId
        ? and(eq(eSignatures.signerEmail, email), eq(eSignatures.ownerId, ownerId))
        : eq(eSignatures.signerEmail, email)
    )
    .orderBy(desc(eSignatures.createdAt));

  // Documents shared by CPA to this client
  const sharedDocs = await db
    .select()
    .from(documents)
    .where(
      ownerId
        ? and(
            eq(documents.clientEmail, email),
            eq(documents.ownerId, ownerId),
            eq(documents.sharedWithClient, true)
          )
        : and(
            eq(documents.clientEmail, email),
            eq(documents.sharedWithClient, true)
          )
    )
    .orderBy(desc(documents.sharedAt));

  // Resolve document names + sender info for esign requests so the portal
  // can render a full Signature Certificate.
  const esignDocIds = [...new Set(esignRequests.map((e) => e.documentId))];
  const esignDocs =
    esignDocIds.length > 0
      ? await db
          .select({ id: documents.id, fileName: documents.fileName })
          .from(documents)
          .where(inArray(documents.id, esignDocIds))
      : [];
  const esignDocMap = new Map(esignDocs.map((d) => [d.id, d.fileName]));

  const esignOwnerIds = [...new Set(esignRequests.map((e) => e.ownerId))];
  const esignOwners =
    esignOwnerIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            companyName: users.companyName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, esignOwnerIds))
      : [];
  const esignOwnerMap = new Map(esignOwners.map((o) => [o.id, o]));

  return NextResponse.json({
    documents: clientDocs.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      category: d.category,
      taxYear: d.taxYear,
      status: d.status,
      createdAt: d.createdAt,
    })),
    uploadLinks: uploadLinks.map((l) => ({
      id: l.id,
      token: l.token,
      message: l.message,
      requiredDocuments: l.requiredDocuments,
      maxUploads: l.maxUploads,
      uploadCount: l.uploadCount,
      status: l.status,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
    })),
    esignRequests: esignRequests.map((e) => {
      const owner = esignOwnerMap.get(e.ownerId);
      return {
        id: e.id,
        token: e.token,
        signerName: e.signerName,
        signerEmail: e.signerEmail,
        status: e.status,
        signedAt: e.signedAt,
        viewedAt: e.viewedAt,
        sentAt: e.sentAt,
        expiresAt: e.expiresAt,
        createdAt: e.createdAt,
        signatureData: e.signatureData,
        signatureIp: e.signatureIp,
        documentName: esignDocMap.get(e.documentId) || "Document",
        senderName: owner?.name || "",
        senderCompany: owner?.companyName || "",
        senderEmail: owner?.email || "",
      };
    }),
    sharedDocuments: sharedDocs.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      category: d.category,
      sharedAt: d.sharedAt,
    })),
  });
}
