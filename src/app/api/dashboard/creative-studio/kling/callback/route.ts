import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { completeAuthorization } from "@/lib/creative-studio/kling-mcp";

/** Kling sends you back here after you approve; exchange the code for tokens (stored encrypted). */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const origin = req.nextUrl.origin;
  const returnTo = req.cookies.get("cs_kling_return")?.value || "/dashboard/creative-studio";
  const back = (status: string) => {
    const url = new URL(returnTo.startsWith("/dashboard/creative-studio") ? returnTo : "/dashboard/creative-studio", origin);
    url.searchParams.set("kling", status);
    const res = NextResponse.redirect(url);
    for (const name of ["cs_kling_verifier", "cs_kling_state", "cs_kling_return"]) {
      res.cookies.set(name, "", { path: "/api/dashboard/creative-studio/kling", maxAge: 0 });
    }
    return res;
  };

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  const code = params.get("code");
  const state = params.get("state");
  const verifier = req.cookies.get("cs_kling_verifier")?.value;
  if (!code || !state || !verifier || state !== req.cookies.get("cs_kling_state")?.value) return back("error");

  try {
    await completeAuthorization({ ownerId: access.ownerId, code, verifier });
    return back("connected");
  } catch (err) {
    console.error("[creative-studio] Kling token exchange failed:", err instanceof Error ? err.message : err);
    return back("error");
  }
}
