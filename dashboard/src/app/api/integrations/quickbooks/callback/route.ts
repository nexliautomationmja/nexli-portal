import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import {
  exchangeQuickBooksCode,
  getQuickBooksCompanyInfo,
} from "@/lib/quickbooks";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const realmId = req.nextUrl.searchParams.get("realmId");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !realmId || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=qb_missing_params", req.url)
    );
  }

  // Verify state contains the current user
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );
    if (decoded.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=qb_state_mismatch", req.url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=qb_invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeQuickBooksCode(code);
    const companyName = await getQuickBooksCompanyInfo(
      tokens.accessToken,
      realmId
    );

    await db
      .insert(accountingConnections)
      .values({
        userId: session.user.id,
        provider: "quickbooks",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        realmId,
        companyName,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingConnections.userId, accountingConnections.provider],
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          realmId,
          companyName,
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      new URL("/dashboard/settings?connected=quickbooks", req.url)
    );
  } catch (err) {
    console.error("QuickBooks OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=qb_connect_failed", req.url)
    );
  }
}
