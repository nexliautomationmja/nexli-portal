import { NextRequest, NextResponse } from "next/server";
import { applyCredit, dismissCredit, mercuryStatus } from "@/lib/mercury";
import { requireNexliAdmin } from "@/lib/mercury-admin";

export const dynamic = "force-dynamic";

/**
 * A bank transfer the sync couldn't match with certainty:
 *   { transactionId, invoiceId }  → apply it to that invoice (paid, or partial if short)
 *   { transactionId, dismiss }    → not an invoice payment
 */
export async function POST(req: NextRequest) {
  const access = await requireNexliAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as { transactionId?: string; invoiceId?: string; dismiss?: boolean } | null;
  if (!body?.transactionId) return NextResponse.json({ error: "transactionId is required" }, { status: 400 });

  if (body.dismiss) {
    await dismissCredit(body.transactionId);
    return NextResponse.json(await mercuryStatus());
  }
  if (!body.invoiceId || !/^[0-9a-f-]{36}$/i.test(body.invoiceId)) {
    return NextResponse.json({ error: "Pick the invoice this payment is for" }, { status: 400 });
  }
  const settled = await applyCredit(body.invoiceId, body.transactionId, "admin");
  if (!settled) {
    return NextResponse.json({ error: "That invoice can't take this payment (already paid, void, or changed). Refresh and try again." }, { status: 409 });
  }
  return NextResponse.json({ ...(await mercuryStatus()), applied: { invoiceNumber: settled.invoice.invoiceNumber, fullyPaid: settled.fullyPaid } });
}
