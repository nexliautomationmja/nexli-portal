import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documentLinks, documentAuditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await db
    .select()
    .from(documentLinks)
    .where(eq(documentLinks.ownerId, session.user.id))
    .orderBy(desc(documentLinks.createdAt));

  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    clientName,
    clientEmail,
    clientPhone,
    message,
    requiredDocuments,
    maxUploads = 10,
    expiresInDays = 14,
    deliveryMethod = "manual",
  } = body;

  // Generate cryptographically random token
  const token = crypto.randomBytes(32).toString("base64url");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [link] = await db
    .insert(documentLinks)
    .values({
      ownerId: session.user.id,
      token,
      clientName,
      clientEmail,
      clientPhone,
      message,
      requiredDocuments: requiredDocuments || [],
      maxUploads,
      expiresAt,
      deliveryMethod,
    })
    .returning();

  // Log the action
  await db.insert(documentAuditLog).values({
    linkId: link.id,
    action: "link_created",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: { clientName, clientEmail, expiresAt: expiresAt.toISOString() },
  });

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const uploadUrl = `${portalUrl}/upload/${token}`;

  return NextResponse.json({ link, uploadUrl }, { status: 201 });
}
