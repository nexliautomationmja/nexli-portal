import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for session token (NextAuth JWT cookie)
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
  matcher: ["/dashboard/:path*", "/login"],
};
