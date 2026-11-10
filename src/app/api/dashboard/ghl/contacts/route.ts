import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContacts, searchContacts, contactsCount } from "@/lib/ghl-client";

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

  // `connected` / `error` let pages tell "not connected" from "GHL failed"
  // from "no contacts"; { contacts, total } is unchanged for ClientPicker.
  if (!user?.ghlLocationId) {
    return NextResponse.json({ contacts: [], total: 0, connected: false });
  }

  const search = req.nextUrl.searchParams.get("search");
  const asked = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(asked) ? Math.min(100, Math.max(1, asked)) : 50;

  try {
    const data = search
      ? await searchContacts(user.ghlLocationId, search, limit)
      : await getContacts(user.ghlLocationId, limit);

    // Normalize: the list endpoint returns `count`, search returns `total`.
    return NextResponse.json({
      contacts: data.contacts ?? [],
      total: contactsCount(data),
      connected: true,
      locationId: user.ghlLocationId,
    });
  } catch (err) {
    console.error("GHL contacts fetch failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return NextResponse.json({ contacts: [], total: 0, connected: true, error: "GoHighLevel didn't answer." });
  }
}
