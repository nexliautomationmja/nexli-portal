import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;
  const body = await req.json();
  const { amountDollars } = body;

  if (!amountDollars || amountDollars <= 0) {
    return NextResponse.json(
      { error: "amountDollars must be a positive number" },
      { status: 400 }
    );
  }

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

  if (!["sent", "viewed", "overdue", "partial"].includes(invoice.status)) {
    return NextResponse.json(
      { error: "Invoice is not eligible for partial payment" },
      { status: 400 }
    );
  }

  const amountCents = Math.round(amountDollars * 100);
  if (amountCents > invoice.balanceDue) {
    return NextResponse.json(
      { error: "Amount exceeds balance due" },
      { status: 400 }
    );
  }

  if (!invoice.paymentUrl) {
    return NextResponse.json(
      { error: "Payment link not yet available" },
      { status: 400 }
    );
  }

  // Helcim hosted page handles partial payments natively
  return NextResponse.json({ paymentUrl: invoice.paymentUrl });
}
