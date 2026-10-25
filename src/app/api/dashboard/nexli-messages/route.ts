import { NextRequest, NextResponse } from "next/server";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import { resolveNexliThread } from "@/lib/nexli-thread";
import {
  MAX_MESSAGE_LENGTH,
  createTextMessage,
  loadThread,
  markThreadRead,
  notifyOwnerOfReply,
  serializeMessages,
} from "@/lib/portal-messages";

// GET — the client's thread with Nexli; marks Nexli's messages read
export async function GET() {
  const t = await resolveNexliThread();
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });
  await ensurePortalMessageColumns();

  const rows = await loadThread(t.ownerId, t.clientEmail);
  const unread = rows.filter((m) => m.senderType === "cpa" && !m.read).length;
  if (unread > 0) await markThreadRead(t.ownerId, t.clientEmail, "cpa");

  // `unread` = how many were unread before this fetch marked them read
  return NextResponse.json({ messages: await serializeMessages(rows), unread });
}

// POST { message } — client text reply to Nexli
export async function POST(req: NextRequest) {
  const t = await resolveNexliThread();
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });
  await ensurePortalMessageColumns();

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (${MAX_MESSAGE_LENGTH} char max)` },
      { status: 400 }
    );
  }

  const message = await createTextMessage({
    ownerId: t.ownerId,
    clientEmail: t.clientEmail,
    senderType: "client",
    senderUserId: t.userId,
    message: text,
  });
  await notifyOwnerOfReply({
    ownerId: t.ownerId,
    clientEmail: t.clientEmail,
    clientName: t.userName,
    message,
  });
  return NextResponse.json({ message });
}
