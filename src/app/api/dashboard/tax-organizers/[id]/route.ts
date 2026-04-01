import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxOrganizerLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [link] = await db
    .select()
    .from(taxOrganizerLinks)
    .where(
      and(
        eq(taxOrganizerLinks.id, id),
        eq(taxOrganizerLinks.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .delete(taxOrganizerLinks)
    .where(eq(taxOrganizerLinks.id, id));

  return NextResponse.json({ ok: true });
}
