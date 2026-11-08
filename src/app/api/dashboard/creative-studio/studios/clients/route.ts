import { NextResponse } from "next/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { creativeStudios } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";

/** Client firms in the portal, for "+ New client studio" (and which already have one). */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const [clients, linked] = await Promise.all([
    db
      .select({
        id: users.id,
        companyName: users.companyName,
        name: users.name,
        email: users.email,
        websiteUrl: users.websiteUrl,
        logoUrl: users.logoUrl,
      })
      .from(users)
      .where(eq(users.role, "client"))
      .orderBy(asc(users.companyName), asc(users.name)),
    db
      .select({ id: creativeStudios.id, clientUserId: creativeStudios.clientUserId })
      .from(creativeStudios)
      .where(and(eq(creativeStudios.ownerId, access.ownerId), isNotNull(creativeStudios.clientUserId))),
  ]);
  const studioOf = new Map(linked.map((l) => [l.clientUserId, l.id]));
  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      label: c.companyName || c.name || c.email,
      companyName: c.companyName,
      email: c.email,
      website: c.websiteUrl,
      logoUrl: c.logoUrl,
      studioKey: studioOf.get(c.id) ?? null,
    })),
  });
}
