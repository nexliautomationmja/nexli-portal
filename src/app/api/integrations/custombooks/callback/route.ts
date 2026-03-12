import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import {
  exchangeCustomBooksCode,
  getCustomBooksCompanyInfo,
} from "@/lib/custombooks";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=cb_missing_params", req.url)
    );
  }

  // Verify state contains the current user
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );
    if (decoded.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=cb_state_mismatch", req.url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=cb_invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeCustomBooksCode(code);
    const companyName = await getCustomBooksCompanyInfo(tokens.accessToken);

    // CustomBooks may return a company/org ID in the token response;
    // for now we store a placeholder that should be replaced with the
    // actual identifier once the API docs confirm the field name.
    const companyId = "cb_default"; // TODO: Extract from token response or company info

    await db
      .insert(accountingConnections)
      .values({
        userId: session.user.id,
        provider: "custombooks",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        realmId: companyId,
        companyName,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingConnections.userId, accountingConnections.provider],
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          realmId: companyId,
          companyName,
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      new URL("/dashboard/settings?connected=custombooks", req.url)
    );
  } catch (err) {
    console.error("CustomBooks OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=cb_connect_failed", req.url)
    );
  }
}
