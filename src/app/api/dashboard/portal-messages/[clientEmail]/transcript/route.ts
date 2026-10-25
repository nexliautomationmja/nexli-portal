import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import { retryTranscript, voiceErrorStatus } from "@/lib/portal-messages";

export const maxDuration = 60;

// POST { messageId } — re-run transcription for a voice message in this thread
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  let body: { messageId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  try {
    const message = await retryTranscript(messageId, session.user.id);
    if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ message });
  } catch (err) {
    const status = voiceErrorStatus(err);
    if (status === 500) console.error("[portal-messages transcript] failed:", err);
    return NextResponse.json(
      { error: status === 500 ? "Couldn't transcribe the message." : (err as Error).message },
      { status }
    );
  }
}
