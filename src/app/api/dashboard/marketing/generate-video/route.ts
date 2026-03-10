import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { marketingVideos } from "@/db/schema";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

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

  try {
    // Submit to fal.ai queue (returns immediately, does NOT wait for completion)
    const { request_id } = await fal.queue.submit("fal-ai/creatify/aurora", {
      input: {
        image_url: avatarUrl,
        audio_url: audioUrl,
        prompt,
      },
    });

    // Create DB record in "generating" state with the fal request ID
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
        falRequestId: request_id,
      })
      .returning();

    return NextResponse.json({
      video: {
        id: record.id,
        status: "generating",
        falRequestId: request_id,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to submit video generation", detail: message },
      { status: 500 }
    );
  }
}
