import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, tone, duration, targetAudience, callToAction } =
    await req.json();

  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const durationSec = parseInt(duration || "30", 10);
  const wordCount = Math.round(durationSec * 2.5);
  const durationLabel =
    durationSec === 15
      ? "15 seconds"
      : durationSec === 60
        ? "60 seconds"
        : "30 seconds";

  const systemPrompt = `You are an expert UGC (User Generated Content) ad copywriter. Write a natural, conversational script for a talking-head video ad. The script should sound authentic and personal -- like a real person sharing their experience, not a polished corporate ad.

Rules:
- Write for spoken delivery (contractions, simple words, natural pauses)
- Target duration: ${durationLabel} (roughly ${wordCount} words)
- Open with a hook in the first 3 seconds
- Include one clear call-to-action
- Return ONLY the script text, no stage directions or formatting
- Do not use emojis or hashtags`;

  const userMessage = `Write a UGC talking-head video ad script about: ${topic}
${tone ? `Tone: ${tone}` : ""}
${targetAudience ? `Target audience: ${targetAudience}` : ""}
${callToAction ? `Call to action: ${callToAction}` : ""}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const script =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ script });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Script generation failed", detail: message },
      { status: 500 }
    );
  }
}
