import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { autopayMetaOf, createBillingPortalSession } from "@/lib/autopay";

/**
 * POST /api/invoice/[token]/billing-portal
 *
 * Opens the Stripe Customer Portal for the client's Digital Rainmaker autopay
 * (update card / bank details of the same type, see invoice history). The
 * Stripe customer is found on the invoice itself, its recurring parent, or
 * the engagement. Public token route (middleware allows /api/invoice/).
 *
 * → { url } | 404 { error: "no_autopay" }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.token, token))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let customerId = autopayMetaOf(invoice)?.customerId ?? null;

  if (!customerId && invoice.recurringParentId) {
    const [parent] = await db
      .select({ metadata: invoices.metadata })
      .from(invoices)
      .where(eq(invoices.id, invoice.recurringParentId))
      .limit(1);
    if (parent) customerId = autopayMetaOf(parent)?.customerId ?? null;
  }

  if (!customerId) {
    const engagementId = (invoice.metadata as { engagementId?: unknown } | null)
      ?.engagementId;
    if (typeof engagementId === "string" && engagementId) {
      const [engagement] = await db
        .select({ metadata: engagements.metadata })
        .from(engagements)
        .where(eq(engagements.id, engagementId))
        .limit(1);
      if (engagement) customerId = autopayMetaOf(engagement)?.customerId ?? null;
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "no_autopay" }, { status: 404 });
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

  try {
    const url = await createBillingPortalSession(
      customerId,
      `${portalUrl}/invoice/${token}`
    );
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Failed to create Stripe billing portal session:", err);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}
