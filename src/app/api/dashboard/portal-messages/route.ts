import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { portalMessages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePortalMessageColumns();

  // Distinct conversations with latest message, its kind, and unread count
  const conversations = await db
    .select({
      clientEmail: portalMessages.clientEmail,
      lastMessage: sql<string>`(
        SELECT message FROM portal_messages pm2
        WHERE pm2.owner_id = ${portalMessages.ownerId}
          AND pm2.client_email = ${portalMessages.clientEmail}
        ORDER BY pm2.created_at DESC LIMIT 1
      )`,
      lastKind: sql<string>`(
        SELECT kind FROM portal_messages pm3
        WHERE pm3.owner_id = ${portalMessages.ownerId}
          AND pm3.client_email = ${portalMessages.clientEmail}
        ORDER BY pm3.created_at DESC LIMIT 1
      )`,
      lastMessageAt: sql<string>`MAX(${portalMessages.createdAt})`,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${portalMessages.senderType} = 'client' AND ${portalMessages.read} = false)`,
    })
    .from(portalMessages)
    .where(eq(portalMessages.ownerId, session.user.id))
    .groupBy(portalMessages.clientEmail, portalMessages.ownerId)
    .orderBy(desc(sql`MAX(${portalMessages.createdAt})`));

  return NextResponse.json({
    conversations: conversations.map((conv) => ({
      clientEmail: conv.clientEmail,
      lastMessage:
        conv.lastMessage?.length > 100
          ? conv.lastMessage.slice(0, 100) + "..."
          : conv.lastMessage,
      lastKind: conv.lastKind || "text",
      lastMessageAt: conv.lastMessageAt,
      unreadCount: Number(conv.unreadCount),
    })),
  });
}
