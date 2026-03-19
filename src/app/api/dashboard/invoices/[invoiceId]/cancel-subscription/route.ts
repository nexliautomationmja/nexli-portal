import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cancelSubscription } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.ownerId, session.user.id))
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!invoice.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "This invoice does not have an active subscription" },
      { status: 400 }
    );
  }

  if (invoice.subscriptionStatus === "canceled") {
    return NextResponse.json(
      { error: "Subscription is already canceled" },
      { status: 400 }
    );
  }

  await cancelSubscription(invoice.stripeSubscriptionId);

  await db
    .update(invoices)
    .set({
      subscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  return NextResponse.json({ success: true });
}
