import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentLinks, documents, documentAuditLog } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Validate token and return link metadata (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [link] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.token, token),
        eq(documentLinks.status, "active"),
        gt(documentLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json(
      { error: "This upload link is invalid or has expired." },
      { status: 404 }
    );
  }

  // Update last accessed
  await db
    .update(documentLinks)
    .set({ lastAccessedAt: new Date() })
    .where(eq(documentLinks.id, link.id));

  // Log access
  await db.insert(documentAuditLog).values({
    linkId: link.id,
    action: "link_accessed",
    actorName: link.clientName,
  });

  return NextResponse.json({
    clientName: link.clientName,
    message: link.message,
    requiredDocuments: link.requiredDocuments,
    maxUploads: link.maxUploads,
    uploadCount: link.uploadCount,
    expiresAt: link.expiresAt,
  });
}

// POST: Upload file(s) via multipart form data (public)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate token
  const [link] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.token, token),
        eq(documentLinks.status, "active"),
        gt(documentLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json(
      { error: "This upload link is invalid or has expired." },
      { status: 404 }
    );
  }

  // Check upload limit
  if (link.uploadCount! >= link.maxUploads!) {
    return NextResponse.json(
      { error: "Upload limit reached for this link." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const clientName = (formData.get("clientName") as string) || link.clientName;
  const clientEmail = (formData.get("clientEmail") as string) || link.clientEmail;
  const clientPhone = (formData.get("clientPhone") as string) || link.clientPhone;
  const category = formData.get("category") as string | null;

  if (!files.length) {
    return NextResponse.json(
      { error: "No files provided." },
      { status: 400 }
    );
  }

  // Validate file sizes (25MB max each)
  const MAX_SIZE = 25 * 1024 * 1024;
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 25MB limit.` },
        { status: 400 }
      );
    }
  }

  const supabase = getSupabase();
  const uploadedDocs = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = crypto.randomUUID();
    const storagePath = `documents/${link.ownerId}/${link.id}/${fileId}_${file.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Supabase error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload "${file.name}".` },
        { status: 500 }
      );
    }

    // Create document record
    const [doc] = await db
      .insert(documents)
      .values({
        ownerId: link.ownerId,
        clientName,
        clientEmail,
        clientPhone,
        linkId: link.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        category,
        status: "new",
      })
      .returning();

    // Log upload
    await db.insert(documentAuditLog).values({
      documentId: doc.id,
      linkId: link.id,
      action: "uploaded",
      actorName: clientName,
      actorIp: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      actorUserAgent: req.headers.get("user-agent"),
      metadata: { fileName: file.name, fileSize: file.size, mimeType: file.type },
    });

    uploadedDocs.push(doc);
  }

  // Increment upload count
  await db
    .update(documentLinks)
    .set({ uploadCount: (link.uploadCount || 0) + files.length })
    .where(eq(documentLinks.id, link.id));

  // Notify CPA
  try {
    await createNotification({
      userId: link.ownerId,
      type: "document_uploaded",
      title: "Document Uploaded",
      message: `${clientName || "A client"} uploaded ${uploadedDocs.length} document${uploadedDocs.length > 1 ? "s" : ""}`,
      metadata: { linkId: link.id, clientName, count: uploadedDocs.length },
    });
  } catch (err) {
    console.error("Upload notification failed:", err);
  }

  return NextResponse.json({
    ok: true,
    uploaded: uploadedDocs.length,
    documents: uploadedDocs.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileSize: d.fileSize,
    })),
  });
}
