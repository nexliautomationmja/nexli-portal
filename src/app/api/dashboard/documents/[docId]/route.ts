import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentAuditLog } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.ownerId, session.user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch audit log for this document
  const auditLog = await db
    .select()
    .from(documentAuditLog)
    .where(eq(documentAuditLog.documentId, docId))
    .orderBy(desc(documentAuditLog.createdAt))
    .limit(50);

  // Log the view action
  await db.insert(documentAuditLog).values({
    documentId: docId,
    action: "viewed",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
  });

  return NextResponse.json({ document: doc, auditLog });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;
  const body = await req.json();

  // Verify ownership
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.ownerId, session.user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.status && ["new", "reviewed", "archived"].includes(body.status)) {
    updates.status = body.status;
    if (body.status === "reviewed") {
      updates.reviewedAt = new Date();
      updates.reviewedBy = session.user.id;
    }
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }

  if (body.category !== undefined) {
    updates.category = body.category;
  }

  await db.update(documents).set(updates).where(eq(documents.id, docId));

  // Log the action
  const action = body.status === "reviewed" ? "reviewed" : body.status === "archived" ? "archived" : "viewed";
  await db.insert(documentAuditLog).values({
    documentId: docId,
    action,
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: { updates: body },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;

  // Verify ownership
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.ownerId, session.user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Log before deletion
  await db.insert(documentAuditLog).values({
    documentId: docId,
    action: "deleted",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: { fileName: doc.fileName },
  });

  // Delete from Supabase storage
  const supabase = getSupabase();
  await supabase.storage.from("documents").remove([doc.storagePath]);

  await db.delete(documents).where(eq(documents.id, docId));

  return NextResponse.json({ ok: true });
}
