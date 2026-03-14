import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchConversations } from "@/lib/ghl-client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.ghlLocationId) {
    return NextResponse.json({ conversations: [], total: 0 });
  }

  try {
    const data = await searchConversations(user.ghlLocationId, 50);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ conversations: [], total: 0 });
  }
}
