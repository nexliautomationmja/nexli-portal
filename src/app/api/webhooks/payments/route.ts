import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleAsyncPaymentSucceeded,
  handleAsyncPaymentFailed,
} from "@/lib/payments-webhook-handlers";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform-account Stripe webhook (Nexli's own invoices).
 * Connected-account events are delivered to /api/webhooks/connect.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      default:
        break;
    }
  } catch (err) {
    // Business errors are logged, never surfaced as 5xx (avoids Stripe retries
    // hammering a handler that will fail the same way each time).
    console.error(`Stripe webhook handler failed for ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
