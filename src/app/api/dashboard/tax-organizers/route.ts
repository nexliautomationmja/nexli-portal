import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxOrganizers, taxOrganizerSections, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSectionKeys } from "@/lib/tax-organizer-questions";
import { sendEmailWithLog } from "@/lib/email";
import { buildOrganizerRequestEmail } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(taxOrganizers)
    .where(eq(taxOrganizers.ownerId, session.user.id))
    .orderBy(desc(taxOrganizers.createdAt));

  // Count completed sections for each organizer
  const organizers = await Promise.all(
    rows.map(async (org) => {
      const sections = await db
        .select()
        .from(taxOrganizerSections)
        .where(eq(taxOrganizerSections.organizerId, org.id));
      const totalSections = getSectionKeys(
        org.returnType as "1040" | "1120" | "1120S" | "1065" | "1041"
      ).length;
      const completedSections = sections.filter((s) => s.isComplete).length;
      return { ...org, totalSections, completedSections };
    })
  );

  return NextResponse.json({ organizers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { clientName, clientEmail, clientPhone, taxYear, returnType, message, expiresInDays } = body;

  if (!clientName || !clientEmail || !taxYear) {
    return NextResponse.json(
      { error: "clientName, clientEmail, and taxYear are required" },
      { status: 400 }
    );
  }

  const validTypes = ["1040", "1120", "1120S", "1065", "1041"] as const;
  type OrgReturnType = (typeof validTypes)[number];
  const rt: OrgReturnType = validTypes.includes(returnType as OrgReturnType)
    ? (returnType as OrgReturnType)
    : "1040";

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 90));

  const [organizer] = await db
    .insert(taxOrganizers)
    .values({
      ownerId: session.user.id,
      token,
      clientName,
      clientEmail,
      clientPhone: clientPhone || null,
      taxYear,
      returnType: rt,
      status: "sent",
      message: message || null,
      sentAt: new Date(),
      expiresAt,
    })
    .returning();

  // Pre-create all section rows
  const sectionKeys = getSectionKeys(rt);
  for (const key of sectionKeys) {
    await db.insert(taxOrganizerSections).values({
      organizerId: organizer.id,
      sectionKey: key,
      data: {},
      isComplete: false,
    });
  }

  // Send email notification
  try {
    const [owner] = await db
      .select({ name: users.name, companyName: users.companyName })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://portal.nexli.net";
    const organizerUrl = `${portalUrl}/portal/dashboard/tax-organizer/${organizer.id}`;

    const email = buildOrganizerRequestEmail({
      clientName,
      senderName: owner?.name || "Your CPA",
      companyName: owner?.companyName || "",
      organizerUrl,
      taxYear,
      returnType: rt,
      message: message || undefined,
      expiresAt,
    });

    await sendEmailWithLog({
      to: clientEmail,
      subject: email.subject,
      html: email.html,
      recipientName: clientName,
      emailType: "tax_organizer_request",
      relatedId: organizer.id,
      sentBy: session.user.id,
    });
  } catch (err) {
    console.error("Tax organizer email failed:", err);
  }

  return NextResponse.json({ organizer }, { status: 201 });
}
