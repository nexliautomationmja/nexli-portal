import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContacts, searchContacts } from "@/lib/ghl-client";

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ contacts: [], total: 0 });
  }

  const search = req.nextUrl.searchParams.get("search");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  try {
    const data = search
      ? await searchContacts(user.ghlLocationId, search, limit)
      : await getContacts(user.ghlLocationId, limit);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ contacts: [], total: 0 });
  }
}
