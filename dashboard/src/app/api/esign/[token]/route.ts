import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  eSignatures,
  documents,
  documentAuditLog,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailWithLog, buildEsignCompletedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// GET — validate token, return document info, mark as viewed
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [result] = await db
    .select({
      esign: eSignatures,
      documentName: documents.fileName,
      storagePath: documents.storagePath,
      mimeType: documents.mimeType,
    })
    .from(eSignatures)
    .innerJoin(documents, eq(eSignatures.documentId, documents.id))
    .where(eq(eSignatures.token, token))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { esign } = result;

  // Check expiry
  if (new Date(esign.expiresAt) < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Check if already signed or declined
  if (esign.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }
  if (esign.status === "declined") {
    return NextResponse.json({ error: "Signature declined" }, { status: 410 });
  }
  if (esign.status === "expired") {
    return NextResponse.json({ error: "This request has been voided" }, { status: 410 });
  }

  // Generate a signed URL for document download
  let documentUrl: string | null = null;
  if (result.storagePath) {
    const { data } = await getSupabase().storage
      .from("documents")
      .createSignedUrl(result.storagePath, 3600); // 1 hour
    documentUrl = data?.signedUrl || null;
  }

  // Mark as viewed if first time
  if (!esign.viewedAt) {
    await db
      .update(eSignatures)
      .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
      .where(eq(eSignatures.id, esign.id));
  }

  return NextResponse.json({
    signerName: esign.signerName,
    documentName: result.documentName,
    documentUrl,
    mimeType: result.mimeType,
    expiresAt: esign.expiresAt,
    status: esign.viewedAt ? esign.status : "viewed",
  });
}

// POST — submit signature
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [result] = await db
    .select({
      esign: eSignatures,
      documentName: documents.fileName,
      ownerId: documents.ownerId,
    })
    .from(eSignatures)
    .innerJoin(documents, eq(eSignatures.documentId, documents.id))
    .where(eq(eSignatures.token, token))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { esign } = result;

  if (new Date(esign.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (esign.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
  const typedName = typeof body.typedName === "string" ? body.typedName.trim() : "";

  if (!signatureData || !typedName) {
    return NextResponse.json(
      { error: "Signature and name are required" },
      { status: 400 }
    );
  }

  // Validate input sizes
  if (typedName.length > 200) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (signatureData.length > 500_000) {
    return NextResponse.json({ error: "Signature data too large" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  await db
    .update(eSignatures)
    .set({
      status: "signed",
      signedAt: new Date(),
      signatureData,
      signatureIp: ip,
      signatureUserAgent: ua,
      updatedAt: new Date(),
    })
    .where(eq(eSignatures.id, esign.id));

  // Audit log
  await db.insert(documentAuditLog).values({
    documentId: esign.documentId,
    action: "esign_signed",
    actorName: esign.signerName,
    actorIp: ip,
    actorUserAgent: ua,
    metadata: { typedName, esignId: esign.id },
  });

  // Notify CPA via email
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, result.ownerId))
      .limit(1);

    if (owner?.email) {
      const { subject, html } = buildEsignCompletedEmail({
        senderName: owner.name || owner.email,
        cpaEmail: owner.email,
        signerName: esign.signerName,
        documentName: result.documentName,
        signedAt: new Date(),
      });
      await sendEmailWithLog({ to: owner.email, subject, html, recipientName: owner.name || undefined, emailType: "esign_completed", relatedId: esign.id });
    }
  } catch (err) {
    console.error("Failed to send esign completed email:", err);
  }

  // In-app notification
  try {
    await createNotification({
      userId: result.ownerId,
      type: "esign_completed",
      title: "Document Signed",
      message: `${esign.signerName} signed "${result.documentName}"`,
      metadata: { esignId: esign.id, documentName: result.documentName, signerName: esign.signerName },
    });
  } catch (err) {
    console.error("E-sign notification failed:", err);
  }

  return NextResponse.json({ ok: true, signedAt: new Date().toISOString() });
}

// PATCH — decline to sign
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [esign] = await db
    .select()
    .from(eSignatures)
    .where(eq(eSignatures.token, token))
    .limit(1);

  if (!esign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (esign.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  await db
    .update(eSignatures)
    .set({
      status: "declined",
      declinedAt: new Date(),
      declineReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(eSignatures.id, esign.id));

  await db.insert(documentAuditLog).values({
    documentId: esign.documentId,
    action: "esign_declined",
    actorName: esign.signerName,
    actorIp: ip,
    actorUserAgent: ua,
    metadata: { reason, esignId: esign.id },
  });

  return NextResponse.json({ ok: true });
}
