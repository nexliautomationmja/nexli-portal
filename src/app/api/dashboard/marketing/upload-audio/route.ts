import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Audio file type not allowed. Use MP3, WAV, OGG, WebM, or AAC." },
      { status: 400 }
    );
  }

  if (file.size > MAX_AUDIO_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 25MB)" },
      { status: 400 }
    );
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `marketing-audio/${session.user.id}/${randomUUID()}-${sanitized}`;

  const supabase = getSupabase();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("marketing-assets")
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

  const { data: urlData } = await supabase.storage
    .from("marketing-assets")
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

  return NextResponse.json({
    storagePath,
    url: urlData?.signedUrl || "",
  });
}
