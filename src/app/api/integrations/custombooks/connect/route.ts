import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";
import { getCustomBooksAuthUrl } from "@/lib/custombooks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", "/dashboard/settings");
    return NextResponse.redirect(loginUrl);
  }

  if (!process.env.CB_CLIENT_ID || !process.env.CB_CLIENT_SECRET) {
    const settingsUrl = new URL("/dashboard/settings", req.nextUrl.origin);
    settingsUrl.searchParams.set("error", "custombooks_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const url = getCustomBooksAuthUrl(state);
  return NextResponse.redirect(url);
}
