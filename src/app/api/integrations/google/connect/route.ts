import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", "/dashboard/settings");
    return NextResponse.redirect(loginUrl);
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const settingsUrl = new URL("/dashboard/settings", req.nextUrl.origin);
    settingsUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
