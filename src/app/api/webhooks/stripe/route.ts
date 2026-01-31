import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const rawEmail = session.customer_details?.email;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!rawEmail) return;

  const customerEmail = rawEmail.toLowerCase().trim();

  // Check for existing user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, customerEmail))
    .limit(1);

  let userId: string;

  if (existing[0]) {
    // Link Stripe customer to existing user
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, existing[0].id));
    userId = existing[0].id;
  } else {
    // Create new client account with a random temporary password
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const newUser = await db
      .insert(users)
      .values({
        email: customerEmail,
        name: session.customer_details?.name || null,
        hashedPassword,
        role: "client",
        stripeCustomerId: customerId,
      })
      .returning({ id: users.id });

    userId = newUser[0].id;

    // TODO: Send welcome email via GoHighLevel with password reset link
  }

  // Create subscription record
  if (subscriptionId) {
    const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
    const firstItem = stripeSub.items.data[0];
    await db
      .insert(subscriptions)
      .values({
        userId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: firstItem?.price.id || "",
        status: "active",
        currentPeriodStart: firstItem
          ? new Date(firstItem.current_period_start * 1000)
          : null,
        currentPeriodEnd: firstItem
          ? new Date(firstItem.current_period_end * 1000)
          : null,
      })
      .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const statusMap: Record<string, typeof subscriptions.$inferInsert.status> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    unpaid: "unpaid",
  };

  const firstItem = subscription.items.data[0];
  await db
    .update(subscriptions)
    .set({
      status: statusMap[subscription.status] || "active",
      currentPeriodStart: firstItem
        ? new Date(firstItem.current_period_start * 1000)
        : null,
      currentPeriodEnd: firstItem
        ? new Date(firstItem.current_period_end * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}
