import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContacts } from "@/lib/ghl-client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const { locationId } = await req.json();

  if (!locationId || typeof locationId !== "string" || !locationId.trim()) {
    return NextResponse.json(
      { error: "Location ID is required" },
      { status: 400 }
    );
  }

  const trimmed = locationId.trim();

  // Test the connection
  try {
    await getContacts(trimmed, 1);
  } catch {
    return NextResponse.json(
      { error: "Could not connect to GoHighLevel with this Location ID." },
      { status: 422 }
    );
  }

  await db
    .update(users)
    .set({ ghlLocationId: trimmed, updatedAt: new Date() })
    .where(eq(users.id, clientId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  await db
    .update(users)
    .set({ ghlLocationId: null, updatedAt: new Date() })
    .where(eq(users.id, clientId));

  return NextResponse.json({ ok: true });
}
