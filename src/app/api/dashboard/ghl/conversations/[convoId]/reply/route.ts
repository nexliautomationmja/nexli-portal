import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendMessage } from "@/lib/ghl-client";
import { conversationAccess } from "@/lib/ghl-conversation-access";

/** Most characters one reply may carry (a sanity cap, well above a long SMS). */
const MAX_MESSAGE = 5000;

/** Text a reply (SMS only) — only into a conversation in the owner's own GHL location. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ convoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { convoId } = await params;
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `Keep it under ${MAX_MESSAGE.toLocaleString("en-US")} characters.` }, { status: 400 });
  }

  const access = await conversationAccess(session.user.id, convoId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    // SMS is the only channel this page sends; a caller can't pick another.
    const result = await sendMessage(convoId, message, "SMS");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GHL Reply] Failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
