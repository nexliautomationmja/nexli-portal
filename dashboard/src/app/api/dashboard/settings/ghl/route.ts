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

  // Save the Location ID
  await db
    .update(users)
    .set({ ghlLocationId: trimmed, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  // Non-blocking test — warn but don't block the save
  let verified = false;
  try {
    await getContacts(trimmed, 1);
    verified = true;
  } catch (err) {
    console.warn("[GHL] Connection test failed for location", trimmed, err);
  }

  return NextResponse.json({ ok: true, verified });
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
