import { NextRequest, NextResponse } from "next/server";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import { resolveNexliThread } from "@/lib/nexli-thread";
import {
  createVoiceMessage,
  notifyOwnerOfReply,
  parseVoiceForm,
  voiceErrorStatus,
} from "@/lib/portal-messages";

export const maxDuration = 60; // upload + inline transcription

// POST multipart { file, durationMs } — client voice reply to Nexli
export async function POST(req: NextRequest) {
  const t = await resolveNexliThread();
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });
  await ensurePortalMessageColumns();

  try {
    const { file, durationMs } = await parseVoiceForm(req);
    const message = await createVoiceMessage({
      ownerId: t.ownerId,
      clientEmail: t.clientEmail,
      senderType: "client",
      senderUserId: t.userId,
      file,
      mime: file.type,
      durationMs,
    });
    await notifyOwnerOfReply({
      ownerId: t.ownerId,
      clientEmail: t.clientEmail,
      clientName: t.userName,
      message,
    });
    return NextResponse.json({ message });
  } catch (err) {
    const status = voiceErrorStatus(err);
    if (status === 500) console.error("[nexli-messages voice] failed:", err);
    return NextResponse.json(
      { error: status === 500 ? "Couldn't send the voice message." : (err as Error).message },
      { status }
    );
  }
}
