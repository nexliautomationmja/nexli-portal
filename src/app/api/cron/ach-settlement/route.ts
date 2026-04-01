import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ACH settlement is now handled by Stripe webhooks
  // (checkout.session.async_payment_succeeded / async_payment_failed)
  return NextResponse.json({
    message: "ACH settlement is handled by Stripe webhooks. No polling needed.",
  });
}
