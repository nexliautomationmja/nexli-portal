import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portalMessages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session || !session.ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await db
    .select()
    .from(portalMessages)
    .where(
      and(
        eq(portalMessages.ownerId, session.ownerId),
        eq(portalMessages.clientEmail, session.email)
      )
    )
    .orderBy(asc(portalMessages.createdAt));

  // Auto-mark CPA messages as read
  const unreadCpaMessages = messages.filter(
    (m) => m.senderType === "cpa" && !m.read
  );
  if (unreadCpaMessages.length > 0) {
    for (const m of unreadCpaMessages) {
      await db
        .update(portalMessages)
        .set({ read: true })
        .where(eq(portalMessages.id, m.id));
    }
  }

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      message: m.message,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session || !session.ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length === 0) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (2000 char max)" },
      { status: 400 }
    );
  }

  await db.insert(portalMessages).values({
    ownerId: session.ownerId,
    clientEmail: session.email,
    senderType: "client",
    message,
  });

  // Notify CPA
  try {
    await createNotification({
      userId: session.ownerId,
      type: "portal_message",
      title: "New Portal Message",
      message: `${session.clientName || session.email} sent a message`,
      metadata: {
        clientEmail: session.email,
        clientName: session.clientName,
      },
    });
  } catch {
    // Non-critical
  }

  return NextResponse.json({ ok: true });
}
