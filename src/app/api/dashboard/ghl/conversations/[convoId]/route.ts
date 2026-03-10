import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversationMessages } from "@/lib/ghl-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ convoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { convoId } = await params;

  try {
    const data = await getConversationMessages(convoId, 50);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
