import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentLinks, eSignatures } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;

  // Documents uploaded by/for the client
  const clientDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.clientEmail, email))
    .orderBy(desc(documents.createdAt));

  // Active upload links
  const uploadLinks = await db
    .select()
    .from(documentLinks)
    .where(eq(documentLinks.clientEmail, email))
    .orderBy(desc(documentLinks.createdAt));

  // E-signature requests
  const esignRequests = await db
    .select()
    .from(eSignatures)
    .where(eq(eSignatures.signerEmail, email))
    .orderBy(desc(eSignatures.createdAt));

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
    esignRequests: esignRequests.map((e) => ({
      id: e.id,
      token: e.token,
      signerName: e.signerName,
      status: e.status,
      signedAt: e.signedAt,
      expiresAt: e.expiresAt,
      createdAt: e.createdAt,
    })),
  });
}
