import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { calendarConnections } from "@/db/schema";
import { exchangeCalcomCode, getCalcomUserEmail } from "@/lib/calcom";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=calcom_missing_params", req.url)
    );
  }

  // Verify state
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );
    if (decoded.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=calcom_state_mismatch", req.url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=calcom_invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeCalcomCode(code);

    let email = "Cal.com User";
    try {
      email = await getCalcomUserEmail(tokens.accessToken);
    } catch {
      // Non-critical — proceed without email
    }

    await db
      .insert(calendarConnections)
      .values({
        userId: session.user.id,
        provider: "calcom",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        accountEmail: email,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calendarConnections.userId, calendarConnections.provider],
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          accountEmail: email,
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      new URL("/dashboard/settings?connected=calcom", req.url)
    );
  } catch (err) {
    console.error("Cal.com OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=calcom_connect_failed", req.url)
    );
  }
}
