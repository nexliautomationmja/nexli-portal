import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentAuditLog } from "@/db/schema";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const clientEmail = (formData.get("clientEmail") as string)
    ?.toLowerCase()
    .trim();
  const clientName = (formData.get("clientName") as string)?.trim() || "";
  const category = (formData.get("category") as string)?.trim() || null;

  if (!file || !clientEmail) {
    return NextResponse.json(
      { error: "File and client email are required" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (25MB max)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed" },
      { status: 400 }
    );
  }

  const fileId = randomUUID();
  const storagePath = `documents/${session.user.id}/shared/${fileId}_${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }

  const [doc] = await db
    .insert(documents)
    .values({
      ownerId: session.user.id,
      clientEmail,
      clientName: clientName || null,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      status: "reviewed",
      category,
      sharedWithClient: true,
      sharedAt: new Date(),
    })
    .returning({ id: documents.id });

  // Audit log
  await db.insert(documentAuditLog).values({
    documentId: doc.id,
    actorId: session.user.id,
    action: "uploaded",
    metadata: { shared: true, clientEmail, clientName },
  });

  return NextResponse.json({
    ok: true,
    document: { id: doc.id, fileName: file.name },
  });
}
