import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export const maxDuration = 60; // TTS can take a moment for longer scripts

const DEFAULT_VOICE_ID = "jqcCZkN6Knx8BJ5TBdYR"; // Zara (Justine)

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { script, voiceId: rawVoiceId } = await req.json();

  if (!script || typeof script !== "string" || script.trim().length === 0) {
    return NextResponse.json(
      { error: "Script text is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 }
    );
  }

  // Accept any ElevenLabs voice ID directly
  const voiceId = rawVoiceId || DEFAULT_VOICE_ID;

  try {
    // Call ElevenLabs TTS API
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      return NextResponse.json(
        {
          error: "ElevenLabs TTS failed",
          detail: errorText,
          status: ttsResponse.status,
        },
        { status: 502 }
      );
    }

    // Get audio buffer
    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const storagePath = `marketing-tts/${session.user.id}/${randomUUID()}.mp3`;

    // Upload to Supabase
    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("marketing-assets")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to store audio", detail: uploadError.message },
        { status: 500 }
      );
    }

    // Generate signed URL (7 days)
    const { data: urlData } = await supabase.storage
      .from("marketing-assets")
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

    return NextResponse.json({
      audioUrl: urlData?.signedUrl || "",
      storagePath,
      voiceId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "TTS generation failed", detail: message },
      { status: 500 }
    );
  }
}
