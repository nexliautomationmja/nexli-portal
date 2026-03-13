import { NextRequest, NextResponse } from "next/server";
import { deletePortalSession, PORTAL_SESSION_COOKIE } from "@/lib/portal-auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;

  if (token) {
    await deletePortalSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
