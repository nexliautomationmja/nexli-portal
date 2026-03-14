import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { portalMessages } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get distinct conversations with latest message and unread count
  const conversations = await db
    .select({
      clientEmail: portalMessages.clientEmail,
      lastMessage: sql<string>`(
        SELECT message FROM portal_messages pm2
        WHERE pm2.owner_id = ${portalMessages.ownerId}
          AND pm2.client_email = ${portalMessages.clientEmail}
        ORDER BY pm2.created_at DESC LIMIT 1
      )`,
      lastMessageAt: sql<string>`MAX(${portalMessages.createdAt})`,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${portalMessages.senderType} = 'client' AND ${portalMessages.read} = false)`,
    })
    .from(portalMessages)
    .where(eq(portalMessages.ownerId, session.user.id))
    .groupBy(portalMessages.clientEmail, portalMessages.ownerId)
    .orderBy(desc(sql`MAX(${portalMessages.createdAt})`));

  // Look up client names from the messages themselves (latest CPA-addressed message)
  const conversationsWithNames = await Promise.all(
    conversations.map(async (conv) => {
      // Try to get clientName from the most recent message metadata or documents
      const [latestMsg] = await db
        .select({ clientEmail: portalMessages.clientEmail })
        .from(portalMessages)
        .where(
          and(
            eq(portalMessages.ownerId, session.user.id),
            eq(portalMessages.clientEmail, conv.clientEmail)
          )
        )
        .orderBy(desc(portalMessages.createdAt))
        .limit(1);

      return {
        clientEmail: conv.clientEmail,
        lastMessage:
          conv.lastMessage?.length > 100
            ? conv.lastMessage.slice(0, 100) + "..."
            : conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: Number(conv.unreadCount),
      };
    })
  );

  return NextResponse.json({ conversations: conversationsWithNames });
}
