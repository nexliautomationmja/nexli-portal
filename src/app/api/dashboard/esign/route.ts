import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  eSignatures,
  documents,
  documentAuditLog,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { sendEmailWithLog, buildEsignRequestEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = db
    .select({
      esign: eSignatures,
      documentName: documents.fileName,
    })
    .from(eSignatures)
    .innerJoin(documents, eq(eSignatures.documentId, documents.id))
    .where(eq(eSignatures.ownerId, session.user.id))
    .orderBy(desc(eSignatures.createdAt))
    .$dynamic();

  const results = await query;

  // Filter by status in JS (simpler than dynamic where clause)
  const filtered = status
    ? results.filter((r) => r.esign.status === status)
    : results;

  return NextResponse.json({
    esignatures: filtered.map((r) => ({
      ...r.esign,
      documentName: r.documentName,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { documentId, signerName, signerEmail, expiresInDays = 30 } = body;

  if (!documentId || !signerName || !signerEmail) {
    return NextResponse.json(
      { error: "documentId, signerName, and signerEmail are required" },
      { status: 400 }
    );
  }

  // Verify document ownership
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc || doc.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [esign] = await db
    .insert(eSignatures)
    .values({
      documentId,
      ownerId: session.user.id,
      signerName,
      signerEmail,
      token,
      expiresAt,
      sentAt: new Date(),
      status: "sent",
    })
    .returning();

  // Send email to signer
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const signUrl = `${portalUrl}/esign/${token}`;
  const senderName = session.user.name || session.user.email || "Your Service Provider";

  try {
    const { subject, html } = buildEsignRequestEmail({
      signerName,
      senderName,
      documentName: doc.fileName,
      signUrl,
      expiresAt,
    });
    await sendEmailWithLog({ to: signerEmail, subject, html, recipientName: signerName, emailType: "esign_request", relatedId: esign.id, sentBy: session.user.id });
  } catch (err) {
    console.error("Failed to send e-sign email:", err);
  }

  // Audit log
  await db.insert(documentAuditLog).values({
    documentId,
    action: "esign_sent",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: { signerName, signerEmail, esignId: esign.id },
  });

  return NextResponse.json({ esign, signUrl }, { status: 201 });
}
