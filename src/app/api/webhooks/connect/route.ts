import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { constructConnectWebhookEvent } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleAsyncPaymentSucceeded,
  handleAsyncPaymentFailed,
} from "@/lib/payments-webhook-handlers";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Connect webhook: events that originate on connected accounts
 * (CPA firms' Express accounts). Registered in the Stripe Dashboard as a
 * "Connected accounts" endpoint and verified with STRIPE_CONNECT_WEBHOOK_SECRET.
 *
 * Every event carries `event.account` — the connected account id — which is
 * threaded into the shared handlers so any follow-up Stripe call is scoped
 * to that account.
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
    event = constructConnectWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe Connect webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripeAccount = event.account ?? null;

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          { stripeAccount }
        );
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(
          event.data.object as Stripe.Checkout.Session,
          { stripeAccount }
        );
        break;
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(
          event.data.object as Stripe.Checkout.Session,
          { stripeAccount }
        );
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
  } catch (err) {
    // Log business errors; never 5xx after signature verification so Stripe
    // doesn't retry an event that will fail identically each time.
    console.error(
      `Stripe Connect webhook handler failed for ${event.type} (${stripeAccount}):`,
      err
    );
  }

  return NextResponse.json({ received: true });
}

// ── account.updated ──
// Keep users.stripeConnectChargesEnabled / stripeConnectOnboardedAt in sync
// with the connected account's state as the firm completes onboarding.
async function handleAccountUpdated(account: Stripe.Account) {
  if (!account.id) return;

  const [user] = await db
    .select({
      id: users.id,
      stripeConnectOnboardedAt: users.stripeConnectOnboardedAt,
    })
    .from(users)
    .where(eq(users.stripeConnectAccountId, account.id))
    .limit(1);

  if (!user) {
    console.warn(
      `Stripe Connect webhook: account.updated for unknown account ${account.id}`
    );
    return;
  }

  const chargesEnabled = account.charges_enabled === true;
  const onboardedAt =
    account.details_submitted && !user.stripeConnectOnboardedAt
      ? new Date()
      : user.stripeConnectOnboardedAt;

  await db
    .update(users)
    .set({
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectOnboardedAt: onboardedAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}
