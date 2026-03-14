import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, createPortalSession, PORTAL_SESSION_COOKIE } from "@/lib/portal-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit by IP (20 verify attempts per 15 min)
  const ip = getClientIp(req);
  const limit = checkRateLimit(`verify:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.redirect(new URL("/portal?error=rate_limited", req.url));
  }

  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const result = await verifyMagicLink(token);

  if (!result) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const sessionToken = await createPortalSession(result.email);

  const response = NextResponse.redirect(
    new URL("/portal/dashboard", req.url)
  );

  response.cookies.set(PORTAL_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return response;
}
