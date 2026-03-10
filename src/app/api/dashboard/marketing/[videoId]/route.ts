import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { marketingVideos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { fal } from "@fal-ai/client";

export const maxDuration = 60;

// GET — poll video generation status, finalize if fal.ai is done
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;

  const [video] = await db
    .select()
    .from(marketingVideos)
    .where(eq(marketingVideos.id, videoId))
    .limit(1);

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If already completed or failed, just return the current state
  if (video.status !== "generating") {
    return NextResponse.json({
      status: video.status,
      videoUrl: video.videoUrl,
      errorMessage: video.errorMessage,
    });
  }

  // No fal request ID means something went wrong during submission
  if (!video.falRequestId) {
    return NextResponse.json({
      status: "failed",
      errorMessage: "No fal.ai request ID — resubmit the video.",
    });
  }

  try {
    // Check fal.ai queue status
    const queueStatus = await fal.queue.status("fal-ai/creatify/aurora", {
      requestId: video.falRequestId,
      logs: false,
    });

    const falStatus = queueStatus.status as string;

    if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
      return NextResponse.json({ status: "generating" });
    }

    if (falStatus !== "COMPLETED") {
      await db
        .update(marketingVideos)
        .set({
          status: "failed",
          errorMessage: `fal.ai status: ${falStatus}`,
          updatedAt: new Date(),
        })
        .where(eq(marketingVideos.id, video.id));

      return NextResponse.json({
        status: "failed",
        errorMessage: `fal.ai status: ${falStatus}`,
      });
    }

    // Completed — fetch the result
    const result = await fal.queue.result("fal-ai/creatify/aurora", {
      requestId: video.falRequestId,
    });

    const output = result as {
      data?: { video?: { url?: string } };
      video?: { url?: string };
    };
    const outputVideoUrl = output?.data?.video?.url || output?.video?.url;

    if (!outputVideoUrl) {
      await db
        .update(marketingVideos)
        .set({
          status: "failed",
          errorMessage: "No video URL in fal.ai response",
          updatedAt: new Date(),
        })
        .where(eq(marketingVideos.id, video.id));

      return NextResponse.json({
        status: "failed",
        errorMessage: "No video URL in response",
      });
    }

    // Download video from fal.ai and upload to Supabase
    const videoResponse = await fetch(outputVideoUrl);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const videoStoragePath = `marketing-videos/${session.user.id}/${randomUUID()}.mp4`;

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("marketing-assets")
      .upload(videoStoragePath, videoBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      await db
        .update(marketingVideos)
        .set({
          status: "failed",
          errorMessage: `Storage upload failed: ${uploadError.message}`,
          updatedAt: new Date(),
        })
        .where(eq(marketingVideos.id, video.id));

      return NextResponse.json({
        status: "failed",
        errorMessage: "Failed to store video",
      });
    }

    // Generate signed URL (7 days)
    const { data: urlData } = await supabase.storage
      .from("marketing-assets")
      .createSignedUrl(videoStoragePath, 7 * 24 * 60 * 60);

    // Update DB record to completed
    await db
      .update(marketingVideos)
      .set({
        status: "completed",
        videoStoragePath,
        videoUrl: urlData?.signedUrl || "",
        updatedAt: new Date(),
      })
      .where(eq(marketingVideos.id, video.id));

    return NextResponse.json({
      status: "completed",
      videoUrl: urlData?.signedUrl || "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      status: "generating",
      detail: message,
    });
  }
}

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
