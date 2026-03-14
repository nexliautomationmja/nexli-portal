import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadNotifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locationId =
    (body.locationId as string) || (body.location_id as string);

  if (!locationId) {
    return NextResponse.json(
      { error: "Missing locationId" },
      { status: 400 }
    );
  }

  // Find the user who owns this GHL location
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.ghlLocationId, locationId))
    .limit(1);

  if (!user) {
    // No matching user — acknowledge so GHL doesn't retry
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Extract contact info from GHL payload
  const contact = (body.contact || body) as Record<string, unknown>;
  const firstName = (contact.firstName || contact.first_name || "") as string;
  const lastName = (contact.lastName || contact.last_name || "") as string;
  const leadName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
  const leadEmail = (contact.email || "") as string;
  const leadPhone = (contact.phone || "") as string;
  const source = (contact.source || body.source || "GHL") as string;

  // Store in leadNotifications table
  await db.insert(leadNotifications).values({
    userId: user.id,
    leadName,
    leadEmail: leadEmail || null,
    leadPhone: leadPhone || null,
    source,
    notifiedAt: new Date(),
  });

  // Create dashboard notification + email
  const contactInfo = leadEmail || leadPhone || "No contact info";
  await createNotification({
    userId: user.id,
    type: "new_lead",
    title: `New Lead: ${leadName}`,
    message: `${contactInfo} — Source: ${source}`,
    metadata: { leadName, leadEmail, leadPhone, source, locationId },
  });

  return NextResponse.json({ ok: true });
}
