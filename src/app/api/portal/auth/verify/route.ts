import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, createPortalSession, PORTAL_SESSION_COOKIE } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const result = await verifyMagicLink(token);

  if (!result) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const sessionToken = await createPortalSession(result.email);

  const isSecure = req.nextUrl.protocol === "https:";
  const response = NextResponse.redirect(
    new URL("/portal/dashboard", req.url)
  );

  response.cookies.set(PORTAL_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return response;
}
