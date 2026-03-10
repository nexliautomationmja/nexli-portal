import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendMessage } from "@/lib/ghl-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ convoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { convoId } = await params;
  const { message, type } = await req.json();

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  try {
    const result = await sendMessage(convoId, message.trim(), type || "SMS");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GHL Reply] Failed:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
