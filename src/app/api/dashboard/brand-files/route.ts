import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { brandFiles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
  "application/postscript",
  "image/vnd.adobe.photoshop",
  "application/zip",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// GET: List brand files for a client
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const clientIdParam = params.get("clientId");
  const category = params.get("category");

  // Admin can view any client; clients view their own
  let targetClientId = session.user.id;
  if (clientIdParam && session.user.role === "admin") {
    targetClientId = clientIdParam;
  }

  const conditions = [eq(brandFiles.clientId, targetClientId)];
  if (category) {
    conditions.push(
      eq(
        brandFiles.category,
        category as "logo" | "brand_guideline" | "photo" | "design_file"
      )
    );
  }

  const files = await db
    .select()
    .from(brandFiles)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(brandFiles.createdAt));

  return NextResponse.json({ files });
}

// POST: Upload a brand file (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;
  const category = formData.get("category") as string | null;

  if (!file || !clientId || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${clientId}/${randomUUID()}-${sanitized}`;

  const supabase = getSupabase();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("brand-files")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed", detail: uploadError.message },
      { status: 500 }
    );
  }

  // Generate a signed URL (7 days)
  const { data: urlData } = await supabase.storage
    .from("brand-files")
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

  let inserted;
  try {
    [inserted] = await db
      .insert(brandFiles)
      .values({
        clientId,
        uploadedBy: session.user.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category: category as "logo" | "brand_guideline" | "photo" | "design_file",
        storagePath,
        storageUrl: urlData?.signedUrl || "",
      })
      .returning();
  } catch (dbError) {
    // Clean up uploaded file if DB insert fails
    await supabase.storage.from("brand-files").remove([storagePath]);
    return NextResponse.json({ error: "Failed to save file record" }, { status: 500 });
  }

  return NextResponse.json({ file: inserted }, { status: 201 });
}
