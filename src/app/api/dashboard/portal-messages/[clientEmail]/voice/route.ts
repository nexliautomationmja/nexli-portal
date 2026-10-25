import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  createVoiceMessage,
  notifyClientOfMessage,
  parseVoiceForm,
  voiceErrorStatus,
} from "@/lib/portal-messages";

export const maxDuration = 60; // upload + inline transcription

// POST multipart { file, durationMs } — firm/Nexli voice note to a client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();
  const email = decodeURIComponent((await params).clientEmail).toLowerCase().trim();

  try {
    const { file, durationMs } = await parseVoiceForm(req);
    const message = await createVoiceMessage({
      ownerId: session.user.id,
      clientEmail: email,
      senderType: "cpa",
      senderUserId: session.user.id,
      file,
      mime: file.type,
      durationMs,
    });
    await notifyClientOfMessage({ ownerId: session.user.id, clientEmail: email, message });
    return NextResponse.json({ message });
  } catch (err) {
    const status = voiceErrorStatus(err);
    if (status === 500) console.error("[portal-messages voice] failed:", err);
    return NextResponse.json(
      { error: status === 500 ? "Couldn't send the voice message." : (err as Error).message },
      { status }
    );
  }
}
