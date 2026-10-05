import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGuaranteeProgress } from "@/lib/guarantee-progress";

/**
 * The Nexli Guarantee progress for the signed-in client (their own
 * dashboard Overview card). Admins may read any client's via ?clientId=;
 * for everyone else the parameter is ignored so no tenant can read another.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.user.role === "admin";
  const requested = req.nextUrl.searchParams.get("clientId");
  const clientId = isAdmin && requested ? requested : session.user.id;

  try {
    const progress = await getGuaranteeProgress(clientId);
    if (!progress) {
      return NextResponse.json({ error: "no_engagement" }, { status: 404 });
    }
    return NextResponse.json(progress);
  } catch (err) {
    console.error("[guarantee] Error:", err);
    return NextResponse.json(
      { error: "Failed to compute guarantee progress" },
      { status: 502 }
    );
  }
}
