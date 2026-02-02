import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContacts } from "@/lib/ghl-client";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId } = await req.json();

  if (!locationId || typeof locationId !== "string" || !locationId.trim()) {
    return NextResponse.json(
      { error: "Location ID is required" },
      { status: 400 }
    );
  }

  const trimmed = locationId.trim();

  // Test the connection by fetching 1 contact
  try {
    await getContacts(trimmed, 1);
  } catch {
    return NextResponse.json(
      { error: "Could not connect to GoHighLevel with this Location ID. Please check it and try again." },
      { status: 422 }
    );
  }

  await db
    .update(users)
    .set({ ghlLocationId: trimmed, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ ghlLocationId: null, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
