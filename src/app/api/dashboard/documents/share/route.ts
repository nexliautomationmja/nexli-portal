import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentAuditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const documentId =
    typeof body.documentId === "string" ? body.documentId.trim() : "";
  const clientEmail =
    typeof body.clientEmail === "string"
      ? body.clientEmail.toLowerCase().trim()
      : "";
  const clientName =
    typeof body.clientName === "string" ? body.clientName.trim() : "";

  if (!documentId || !clientEmail) {
    return NextResponse.json(
      { error: "Document ID and client email are required" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Verify document exists and belongs to this CPA
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc || doc.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Update document to shared
  await db
    .update(documents)
    .set({
      sharedWithClient: true,
      sharedAt: new Date(),
      clientEmail: clientEmail,
      clientName: clientName || doc.clientName,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  // Audit log
  await db.insert(documentAuditLog).values({
    documentId,
    actorId: session.user.id,
    action: "viewed",
    metadata: { shared: true, clientEmail, clientName: clientName || doc.clientName },
  });

  return NextResponse.json({ ok: true });
}
