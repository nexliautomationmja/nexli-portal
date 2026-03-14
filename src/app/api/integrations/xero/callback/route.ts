import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import {
  exchangeXeroCode,
  getXeroTenants,
  getXeroOrganisation,
} from "@/lib/xero";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=xero_missing_params", req.url)
    );
  }

  // Verify state
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );
    if (decoded.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=xero_state_mismatch", req.url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=xero_invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeXeroCode(code);

    // Get the first tenant (organization)
    const tenants = await getXeroTenants(tokens.accessToken);
    if (tenants.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=xero_no_org", req.url)
      );
    }

    const tenant = tenants[0];
    const companyName = await getXeroOrganisation(
      tokens.accessToken,
      tenant.tenantId
    );

    await db
      .insert(accountingConnections)
      .values({
        userId: session.user.id,
        provider: "xero",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        tenantId: tenant.tenantId,
        companyName,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingConnections.userId, accountingConnections.provider],
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          tenantId: tenant.tenantId,
          companyName,
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      new URL("/dashboard/settings?connected=xero", req.url)
    );
  } catch (err) {
    console.error("Xero OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=xero_connect_failed", req.url)
    );
  }
}
