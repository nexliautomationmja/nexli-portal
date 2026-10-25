import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  MAX_MESSAGE_LENGTH,
  createTextMessage,
  loadThread,
  markThreadRead,
  notifyClientOfMessage,
  serializeMessages,
} from "@/lib/portal-messages";

function threadEmail(raw: string): string {
  return decodeURIComponent(raw).toLowerCase().trim();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  const email = threadEmail((await params).clientEmail);
  const rows = await loadThread(session.user.id, email);

  // Auto-mark client messages as read (single UPDATE)
  if (rows.some((m) => m.senderType === "client" && !m.read)) {
    await markThreadRead(session.user.id, email, "client");
  }

  return NextResponse.json({ messages: await serializeMessages(rows) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  const email = threadEmail((await params).clientEmail);

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (${MAX_MESSAGE_LENGTH} char max)` },
      { status: 400 }
    );
  }

  const message = await createTextMessage({
    ownerId: session.user.id,
    clientEmail: email,
    senderType: "cpa",
    senderUserId: session.user.id,
    message: text,
  });
  await notifyClientOfMessage({ ownerId: session.user.id, clientEmail: email, message });

  return NextResponse.json({ message });
}
