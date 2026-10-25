import { NextRequest, NextResponse } from "next/server";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  MAX_MESSAGE_LENGTH,
  createTextMessage,
  loadThread,
  markThreadRead,
  notifyOwnerOfReply,
  serializeMessages,
} from "@/lib/portal-messages";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session || !session.ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  const rows = await loadThread(session.ownerId, session.email);

  // Auto-mark CPA messages as read (single UPDATE)
  if (rows.some((m) => m.senderType === "cpa" && !m.read)) {
    await markThreadRead(session.ownerId, session.email, "cpa");
  }

  return NextResponse.json({ messages: await serializeMessages(rows) });
}

export async function POST(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session || !session.ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

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
    ownerId: session.ownerId,
    clientEmail: session.email,
    senderType: "client",
    message: text,
  });
  await notifyOwnerOfReply({
    ownerId: session.ownerId,
    clientEmail: session.email,
    clientName: session.clientName,
    message,
  });

  return NextResponse.json({ message });
}
