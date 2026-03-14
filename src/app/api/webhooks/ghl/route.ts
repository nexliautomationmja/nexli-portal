import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadNotifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  // C3: Verify shared secret if configured
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;

    if (providedSecret !== webhookSecret) {
      console.error("[GHL Webhook] Invalid or missing webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.error("[GHL Webhook] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[GHL Webhook] Received payload:", JSON.stringify(body).slice(0, 500));

  // Try multiple possible locationId field names from GHL
  const locationId =
    (body.locationId as string) ||
    (body.location_id as string) ||
    (body.locationID as string) ||
    ((body.contact as Record<string, unknown>)?.locationId as string) ||
    null;

  // C4: Only match users by locationId — no insecure fallback
  if (!locationId) {
    console.error("[GHL Webhook] No locationId found in payload");
    return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.ghlLocationId, locationId))
    .limit(1);

  if (!user) {
    console.error("[GHL Webhook] No user found for locationId:", locationId);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Extract contact info — GHL sends data in various formats
  const contact = (body.contact || body) as Record<string, unknown>;
  const firstName = (contact.firstName || contact.first_name || contact.firstNameRaw || "") as string;
  const lastName = (contact.lastName || contact.last_name || contact.lastNameRaw || "") as string;
  const fullName = (contact.name || contact.full_name || contact.contactName || "") as string;
  const leadName = [firstName, lastName].filter(Boolean).join(" ") || (fullName as string) || "Unknown";
  const leadEmail = (contact.email || "") as string;
  const leadPhone = (contact.phone || contact.phoneNumber || "") as string;
  const source = (contact.source || body.source || body.workflow_name || "GHL") as string;

  console.log("[GHL Webhook] Processing lead:", { leadName, leadEmail, leadPhone, source, userId: user.id });

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

  console.log("[GHL Webhook] Notification created successfully");

  return NextResponse.json({ ok: true });
}
