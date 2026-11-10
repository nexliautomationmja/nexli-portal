import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversationMessages } from "@/lib/ghl-client";
import { conversationAccess } from "@/lib/ghl-conversation-access";

/** One conversation's messages — only for a conversation in the owner's own GHL location. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ convoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { convoId } = await params;
  const access = await conversationAccess(session.user.id, convoId);
  if (!access.ok) {
    // `messages` stays in the body so older clients still read an empty thread.
    return NextResponse.json({ error: access.error, messages: [] }, { status: access.status });
  }

  try {
    const data = await getConversationMessages(convoId, 50);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GHL Messages] Failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return NextResponse.json(
      { error: "GoHighLevel didn't answer. Try again in a moment.", messages: [] },
      { status: 502 }
    );
  }
}
