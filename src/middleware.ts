import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Request header the dashboard layout reads (via next/headers) to learn the
 * current pathname, so it can gate agency-only routes per tier.
 */
const PATHNAME_HEADER = "x-pathname";

// ── Content-Security-Policy ───────────────────────────────
// Every third-party origin below is one the app actually talks to from the
// browser. 'unsafe-inline' / 'unsafe-eval' in script-src are required for
// Next.js dev (HMR, React refresh) and the inline theme bootstrap; tighten
// with nonces if the app ever moves to a strict CSP.
const IS_DEV = process.env.NODE_ENV !== "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com https://connect.stripe.com",
  // Loaded in the browser: Stripe.js (checkout/connect), Mux player, Vercel
  // analytics/speed-insights.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://connect.stripe.com https://*.mux.com https://va.vercel-scripts.com https://vercel.live",
  // Inline styles from styled JSX / CSS-in-style props; Google Fonts CSS in
  // case a page links it directly (next/font self-hosts otherwise).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Firm logos and documents live in Supabase storage; Mux thumbnails; GHL
  // contact avatars (leadconnector / msgsndr CDNs); Stripe assets.
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://image.mux.com https://*.mux.com https://*.stripe.com https://*.leadconnectorhq.com https://*.msgsndr.com https://storage.googleapis.com",
  "media-src 'self' blob: https://*.supabase.co https://stream.mux.com https://*.mux.com",
  // API calls the browser makes: Supabase, Stripe, Mux (incl. litix data
  // beacons), Vercel analytics, GHL (leadconnector) and Cal.com embeds.
  // Dev adds the local HMR websocket.
  `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://connect.stripe.com https://*.mux.com https://*.litix.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live https://services.leadconnectorhq.com https://api.cal.com${
    IS_DEV ? " ws://localhost:* wss://localhost:* ws://127.0.0.1:* http://localhost:*" : ""
  }`,
  // Embedded PDFs / documents (Supabase signed URLs), Stripe checkout/connect
  // frames, Mux player, Cal.com booking embed.
  "frame-src 'self' blob: https://*.supabase.co https://*.supabase.in https://js.stripe.com https://checkout.stripe.com https://connect.stripe.com https://hooks.stripe.com https://*.mux.com https://cal.com https://*.cal.com https://vercel.live",
  "worker-src 'self' blob:",
  // Allow the marketing site to embed the portal; nothing else may.
  "frame-ancestors 'self' https://www.nexli.net https://nexli.net",
  // Only meaningful over https; skipped in dev so http://localhost keeps working.
  ...(IS_DEV ? [] : ["upgrade-insecure-requests"]),
];

const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.join("; ");

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Camera / mic / geolocation are never used by the app. Screen-recording
  // tools (Loom etc.) capture via the browser's own display-capture API and
  // are unaffected by this policy, so it is safe to lock these down.
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // Framing is governed by CSP frame-ancestors (X-Frame-Options intentionally
  // omitted so www.nexli.net can embed the portal).
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  return response;
}

/** NextResponse.next() that also forwards the pathname to server components. */
function next(req: NextRequest): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PATHNAME_HEADER, req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
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
    pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/survey/") ||
    pathname.startsWith("/setup-password") ||
    pathname.startsWith("/api/upload/") ||
    pathname.startsWith("/api/esign/") ||
    pathname.startsWith("/api/engage/") ||
    pathname.startsWith("/api/invoice/") ||
    pathname.startsWith("/api/tax-organizer/") ||
    pathname.startsWith("/api/onboarding/") ||
    pathname.startsWith("/api/survey/") ||
    pathname.startsWith("/api/preview/") ||
    pathname.startsWith("/api/auth/setup-password") ||
    // Machine-to-machine routes authenticate with their own secrets /
    // signatures, never a browser session.
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return addSecurityHeaders(next(req));
  }

  // ── Portal auth routes (public — no session needed) ──
  if (pathname.startsWith("/api/portal/auth/")) {
    return addSecurityHeaders(next(req));
  }

  // Portal login page
  if (pathname === "/portal") {
    const portalToken = req.cookies.get("nexli-portal-session");
    if (portalToken) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/portal/dashboard", req.url))
      );
    }
    return addSecurityHeaders(next(req));
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
    return addSecurityHeaders(next(req));
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

  return addSecurityHeaders(next(req));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
    "/api/cron/:path*",
    "/api/webhooks/:path*",
    "/api/internal/:path*",
    "/api/auth/setup-password",
    "/setup-password/:path*",
    "/login",
    "/portal",
    "/portal/:path*",
    "/api/portal/:path*",
    "/upload/:path*",
    "/esign/:path*",
    "/engage/:path*",
    "/invoice/:path*",
    "/tax-organizer/:path*",
    "/onboarding/:path*",
    "/survey/:path*",
    "/api/upload/:path*",
    "/api/esign/:path*",
    "/api/engage/:path*",
    "/api/invoice/:path*",
    "/api/tax-organizer/:path*",
    "/api/onboarding/:path*",
    "/api/survey/:path*",
    "/api/preview/:path*",
  ],
};
