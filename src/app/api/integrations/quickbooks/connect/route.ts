import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";
import { getQuickBooksAuthUrl } from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", "/dashboard/settings");
    return NextResponse.redirect(loginUrl);
  }

  if (!process.env.QB_CLIENT_ID || !process.env.QB_CLIENT_SECRET) {
    const settingsUrl = new URL("/dashboard/settings", req.nextUrl.origin);
    settingsUrl.searchParams.set("error", "quickbooks_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const url = getQuickBooksAuthUrl(state);
  return NextResponse.redirect(url);
}
