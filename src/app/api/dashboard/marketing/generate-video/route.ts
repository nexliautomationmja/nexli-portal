import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { marketingVideos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { fal } from "@fal-ai/client";

export const maxDuration = 300; // 5 minutes — video generation can take a while

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    title,
    script,
    avatarUrl,
    avatarStoragePath,
    audioUrl,
    audioStoragePath,
    visualPrompt,
    resolution,
  } = await req.json();

  if (!title || !script || !avatarUrl || !audioUrl) {
    return NextResponse.json(
      { error: "Missing required fields (title, script, avatarUrl, audioUrl)" },
      { status: 400 }
    );
  }

  const prompt =
    visualPrompt ||
    "4K studio interview, medium close-up, soft key-light, shallow depth of field";

  // Create DB record in "generating" state
  const [record] = await db
    .insert(marketingVideos)
    .values({
      createdBy: session.user.id,
      title,
      script,
      visualPrompt: prompt,
      avatarStoragePath: avatarStoragePath || null,
      avatarUrl,
      audioStoragePath: audioStoragePath || null,
      audioUrl,
      status: "generating",
      resolution: resolution || "480p",
    })
    .returning();

  try {
    // Call fal.ai Aurora (waits for completion)
    const result = await fal.subscribe("fal-ai/creatify/aurora", {
      input: {
        image_url: avatarUrl,
        audio_url: audioUrl,
        prompt,
      },
    });

    // Aurora response shape: { data: { video: { url, duration, ... } } }
    const output = result as { data?: { video?: { url?: string; duration?: number } }; video?: { url?: string } };
    const outputVideoUrl = output?.data?.video?.url || output?.video?.url;

    if (!outputVideoUrl) {
      await db
        .update(marketingVideos)
        .set({
          status: "failed",
          errorMessage: "No video URL in response",
          updatedAt: new Date(),
        })
        .where(eq(marketingVideos.id, record.id));

      return NextResponse.json(
        { error: "Video generation failed — no output URL", videoId: record.id },
        { status: 500 }
      );
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
        .where(eq(marketingVideos.id, record.id));

      return NextResponse.json(
        { error: "Failed to store video", videoId: record.id },
        { status: 500 }
      );
    }

    // Generate signed URL
    const { data: urlData } = await supabase.storage
      .from("marketing-assets")
      .createSignedUrl(videoStoragePath, 7 * 24 * 60 * 60);

    // Update DB record
    await db
      .update(marketingVideos)
      .set({
        status: "completed",
        videoStoragePath,
        videoUrl: urlData?.signedUrl || "",
        updatedAt: new Date(),
      })
      .where(eq(marketingVideos.id, record.id));

    return NextResponse.json({
      video: {
        id: record.id,
        videoUrl: urlData?.signedUrl || "",
        status: "completed",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await db
      .update(marketingVideos)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(marketingVideos.id, record.id));

    return NextResponse.json(
      { error: "Video generation failed", detail: message, videoId: record.id },
      { status: 500 }
    );
  }
}
