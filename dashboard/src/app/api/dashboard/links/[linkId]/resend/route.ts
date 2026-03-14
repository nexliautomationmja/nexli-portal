import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documentLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmailWithLog, buildUploadRequestEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { linkId } = await params;

  const [link] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.id, linkId),
        eq(documentLinks.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!link.clientEmail) {
    return NextResponse.json(
      { error: "No client email on this link" },
      { status: 400 }
    );
  }

  if (link.status === "revoked" || new Date(link.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Link is no longer active" },
      { status: 400 }
    );
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const uploadUrl = `${portalUrl}/upload/${link.token}`;
  const senderName = session.user.name || session.user.email || "Your Service Provider";

  const { subject, html } = buildUploadRequestEmail({
    clientName: link.clientName || "",
    senderName,
    uploadUrl,
    requiredDocs: (link.requiredDocuments as string[]) || [],
    expiresAt: new Date(link.expiresAt),
  });

  await sendEmailWithLog({ to: link.clientEmail, subject, html, recipientName: link.clientName || undefined, emailType: "upload_request", relatedId: link.id, sentBy: session.user.id });

  return NextResponse.json({ ok: true });
}
