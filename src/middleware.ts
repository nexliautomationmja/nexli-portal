import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://*.resend.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  return response;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  if (
    pathname.startsWith("/upload/") ||
    pathname.startsWith("/esign/") ||
    pathname.startsWith("/engage/") ||
    pathname.startsWith("/invoice/") ||
    pathname.startsWith("/tax-organizer/") ||
    pathname.startsWith("/api/upload/") ||
    pathname.startsWith("/api/esign/") ||
    pathname.startsWith("/api/engage/") ||
    pathname.startsWith("/api/invoice/") ||
    pathname.startsWith("/api/tax-organizer/") ||
    pathname.startsWith("/api/preview/")
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ── Portal auth routes (public — no session needed) ──
  if (pathname.startsWith("/api/portal/auth/")) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Portal login page
  if (pathname === "/portal") {
    const portalToken = req.cookies.get("nexli-portal-session");
    if (portalToken) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/portal/dashboard", req.url))
      );
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // Protected portal routes
  if (
    pathname.startsWith("/portal/dashboard") ||
    pathname.startsWith("/api/portal/")
  ) {
    const portalToken = req.cookies.get("nexli-portal-session");
    if (!portalToken) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/portal", req.url))
      );
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ── Dashboard auth (existing) ──
  const token =
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("authjs.session-token");

  const isLoggedIn = !!token;
  const isOnDashboard =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/dashboard/");
  const isOnLogin = pathname === "/login";

  // Redirect unauthenticated users to login (API routes get 401 instead of redirect)
  if (isOnDashboard && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", req.url))
    );
  }

  // Redirect authenticated users away from login
  if (isOnLogin && isLoggedIn) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", req.url))
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
    "/api/cron/:path*",
    "/api/webhooks/:path*",
    "/login",
    "/portal",
    "/portal/:path*",
    "/api/portal/:path*",
    "/upload/:path*",
    "/esign/:path*",
    "/engage/:path*",
    "/invoice/:path*",
    "/tax-organizer/:path*",
    "/api/upload/:path*",
    "/api/esign/:path*",
    "/api/engage/:path*",
    "/api/invoice/:path*",
    "/api/tax-organizer/:path*",
    "/api/preview/:path*",
  ],
};
