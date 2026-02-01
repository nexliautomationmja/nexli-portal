import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { brandFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
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

  // Delete from Supabase Storage
  const supabase = getSupabase();
  await supabase.storage.from("brand-files").remove([file.storagePath]);

  // Delete from database
  await db.delete(brandFiles).where(eq(brandFiles.id, fileId));

  return NextResponse.json({ success: true });
}
