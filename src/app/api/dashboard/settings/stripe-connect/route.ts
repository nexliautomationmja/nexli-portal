import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createConnectAccount,
  createConnectLoginLink,
  createConnectOnboardingLink,
  retrieveConnectAccount,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function portalUrl() {
  return process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
}

/**
 * POST — create (or reuse) the firm's Express account and return a hosted
 * onboarding link. Safe to call repeatedly: an incomplete onboarding just
 * gets a fresh link for the same account.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      companyName: users.companyName,
      stripeConnectAccountId: users.stripeConnectAccountId,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await createConnectAccount({
        id: user.id,
        email: user.email,
        companyName: user.companyName,
      });
      accountId = account.id;

      await db
        .update(users)
        .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const base = `${portalUrl()}/dashboard/settings`;
    const url = await createConnectOnboardingLink(accountId, {
      returnUrl: `${base}?connect=return`,
      refreshUrl: `${base}?connect=refresh`,
    });

    return NextResponse.json({ url, accountId });
  } catch (err) {
    console.error("[Stripe Connect] onboarding link failed:", err);
    return NextResponse.json(
      { error: "Could not start Stripe onboarding. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET — current Connect status. Syncs charges_enabled / details_submitted
 * from Stripe into the users row (belt-and-braces alongside the
 * account.updated webhook).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      stripeConnectAccountId: users.stripeConnectAccountId,
      stripeConnectChargesEnabled: users.stripeConnectChargesEnabled,
      stripeConnectOnboardedAt: users.stripeConnectOnboardedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.stripeConnectAccountId) {
    return NextResponse.json({
      connected: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      accountId: null,
    });
  }

  try {
    const account = await retrieveConnectAccount(user.stripeConnectAccountId);

    const chargesEnabled = account.charges_enabled === true;
    const detailsSubmitted = account.details_submitted === true;
    const payoutsEnabled = account.payouts_enabled === true;

    const onboardedAt =
      detailsSubmitted && !user.stripeConnectOnboardedAt
        ? new Date()
        : user.stripeConnectOnboardedAt;

    if (
      chargesEnabled !== user.stripeConnectChargesEnabled ||
      onboardedAt !== user.stripeConnectOnboardedAt
    ) {
      await db
        .update(users)
        .set({
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectOnboardedAt: onboardedAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    let loginUrl: string | undefined;
    if (chargesEnabled) {
      try {
        loginUrl = await createConnectLoginLink(account.id);
      } catch (err) {
        console.warn("[Stripe Connect] login link failed:", err);
      }
    }

    return NextResponse.json({
      connected: true,
      chargesEnabled,
      detailsSubmitted,
      payoutsEnabled,
      accountId: account.id,
      loginUrl,
    });
  } catch (err) {
    console.error("[Stripe Connect] status retrieve failed:", err);
    // Fall back to what we have on file so the UI still renders.
    return NextResponse.json({
      connected: true,
      chargesEnabled: user.stripeConnectChargesEnabled,
      detailsSubmitted: !!user.stripeConnectOnboardedAt,
      payoutsEnabled: false,
      accountId: user.stripeConnectAccountId,
      error: "Could not refresh status from Stripe",
    });
  }
}
