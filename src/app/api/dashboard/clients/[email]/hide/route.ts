import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { hiddenClients } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// POST — Hide a client from the list
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params;
  const clientEmail = decodeURIComponent(email).toLowerCase().trim();

  // Upsert — ignore if already hidden
  await db
    .insert(hiddenClients)
    .values({ ownerId: session.user.id, clientEmail })
    .onConflictDoNothing();

  return NextResponse.json({ success: true });
}

// DELETE — Unhide a client (restore to list)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params;
  const clientEmail = decodeURIComponent(email).toLowerCase().trim();

  await db
    .delete(hiddenClients)
    .where(
      and(
        eq(hiddenClients.ownerId, session.user.id),
        eq(hiddenClients.clientEmail, clientEmail)
      )
    );

  return NextResponse.json({ success: true });
}
