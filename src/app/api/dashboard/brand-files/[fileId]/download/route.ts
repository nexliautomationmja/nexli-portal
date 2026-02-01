import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { brandFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;

  const [file] = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.id, fileId))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clients can only download their own files
  if (session.user.role !== "admin" && file.clientId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data } = await supabase.storage
    .from("brand-files")
    .createSignedUrl(file.storagePath, 60 * 60); // 1 hour

  return NextResponse.json({ url: data?.signedUrl || "" });
}
