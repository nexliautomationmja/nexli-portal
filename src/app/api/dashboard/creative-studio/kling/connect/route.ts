import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { authorizeUrl, ensureClient, pkcePair } from "@/lib/creative-studio/kling-mcp";

/** Start "Connect Kling": register the portal as an OAuth client and send you to Kling to approve. */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const origin = req.nextUrl.origin;
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard/creative-studio";
  const safeReturn = returnTo.startsWith("/dashboard/creative-studio") ? returnTo : "/dashboard/creative-studio";
  const redirectUri = `${origin}/api/dashboard/creative-studio/kling/callback`;

  try {
    const clientId = await ensureClient(access.ownerId, redirectUri);
    const { verifier, challenge } = pkcePair();
    const state = crypto.randomBytes(24).toString("base64url");
    const res = NextResponse.redirect(authorizeUrl({ clientId, redirectUri, state, challenge }));
    const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/api/dashboard/creative-studio/kling", maxAge: 600 };
    res.cookies.set("cs_kling_verifier", verifier, cookie);
    res.cookies.set("cs_kling_state", state, cookie);
    res.cookies.set("cs_kling_return", safeReturn, cookie);
    return res;
  } catch (err) {
    console.error("[creative-studio] Kling connect failed:", err instanceof Error ? err.message : err);
    const url = new URL(safeReturn, origin);
    url.searchParams.set("kling", "error");
    return NextResponse.redirect(url);
  }
}
