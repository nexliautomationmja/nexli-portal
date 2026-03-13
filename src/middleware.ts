import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  if (
    pathname.startsWith("/upload/") ||
    pathname.startsWith("/esign/") ||
    pathname.startsWith("/engage/") ||
    pathname.startsWith("/invoice/") ||
    pathname.startsWith("/api/upload/") ||
    pathname.startsWith("/api/esign/") ||
    pathname.startsWith("/api/engage/") ||
    pathname.startsWith("/api/invoice/") ||
    pathname.startsWith("/api/preview/")
  ) {
    return NextResponse.next();
  }

  // ── Portal auth routes (public — no session needed) ──
  if (pathname.startsWith("/api/portal/auth/")) {
    return NextResponse.next();
  }

  // Portal login page
  if (pathname === "/portal") {
    const portalToken = req.cookies.get("nexli-portal-session");
    if (portalToken) {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected portal routes
  if (
    pathname.startsWith("/portal/dashboard") ||
    pathname.startsWith("/api/portal/")
  ) {
    const portalToken = req.cookies.get("nexli-portal-session");
    if (!portalToken) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return NextResponse.next();
  }

  // ── Dashboard auth (existing) ──
  const token =
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("authjs.session-token");

  const isLoggedIn = !!token;
  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnLogin = pathname === "/login";

  // Redirect unauthenticated users to login
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect authenticated users away from login
  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/portal",
    "/portal/:path*",
    "/api/portal/:path*",
    "/upload/:path*",
    "/esign/:path*",
    "/engage/:path*",
    "/invoice/:path*",
    "/api/upload/:path*",
    "/api/esign/:path*",
    "/api/engage/:path*",
    "/api/invoice/:path*",
    "/api/preview/:path*",
  ],
};
