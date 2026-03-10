import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { marketingVideos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;

  try {
    const [video] = await db
      .select()
      .from(marketingVideos)
      .where(eq(marketingVideos.id, videoId))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Clean up Supabase storage
    const supabase = getSupabase();
    const pathsToRemove = [
      video.avatarStoragePath,
      video.audioStoragePath,
      video.videoStoragePath,
    ].filter(Boolean) as string[];

    if (pathsToRemove.length > 0) {
      await supabase.storage.from("marketing-assets").remove(pathsToRemove);
    }

    await db.delete(marketingVideos).where(eq(marketingVideos.id, videoId));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete video", detail: message },
      { status: 500 }
    );
  }
}
