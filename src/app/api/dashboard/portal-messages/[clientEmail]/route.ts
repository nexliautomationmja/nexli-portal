import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { portalMessages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientEmail } = await params;
  const email = decodeURIComponent(clientEmail).toLowerCase().trim();

  const messages = await db
    .select()
    .from(portalMessages)
    .where(
      and(
        eq(portalMessages.ownerId, session.user.id),
        eq(portalMessages.clientEmail, email)
      )
    )
    .orderBy(asc(portalMessages.createdAt));

  // Auto-mark client messages as read
  const unreadClientMessages = messages.filter(
    (m) => m.senderType === "client" && !m.read
  );
  if (unreadClientMessages.length > 0) {
    for (const m of unreadClientMessages) {
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientEmail } = await params;
  const email = decodeURIComponent(clientEmail).toLowerCase().trim();

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
    ownerId: session.user.id,
    clientEmail: email,
    senderType: "cpa",
    message,
  });

  return NextResponse.json({ ok: true });
}
