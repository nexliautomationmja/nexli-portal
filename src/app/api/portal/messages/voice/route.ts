import { NextRequest, NextResponse } from "next/server";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  createVoiceMessage,
  notifyOwnerOfReply,
  parseVoiceForm,
  voiceErrorStatus,
} from "@/lib/portal-messages";

export const maxDuration = 60; // upload + inline transcription

// POST multipart { file, durationMs } — portal client voice reply
export async function POST(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session || !session.ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  try {
    const { file, durationMs } = await parseVoiceForm(req);
    const message = await createVoiceMessage({
      ownerId: session.ownerId,
      clientEmail: session.email,
      senderType: "client",
      file,
      mime: file.type,
      durationMs,
    });
    await notifyOwnerOfReply({
      ownerId: session.ownerId,
      clientEmail: session.email,
      clientName: session.clientName,
      message,
    });
    return NextResponse.json({ message });
  } catch (err) {
    const status = voiceErrorStatus(err);
    if (status === 500) console.error("[portal messages voice] failed:", err);
    return NextResponse.json(
      { error: status === 500 ? "Couldn't send the voice message." : (err as Error).message },
      { status }
    );
  }
}
