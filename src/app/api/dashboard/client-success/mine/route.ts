import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientSuccessForUser, markUpdateViewed } from "@/lib/client-success";

/**
 * The signed-in client's own customer-success state: the latest update their
 * Nexli team sent them, and this week's survey link if it's still open. Only
 * ever returns the caller's own token.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { latestUpdate, pendingSurvey } = await getClientSuccessForUser(session.user.id);
  return NextResponse.json({
    latestUpdate: latestUpdate
      ? {
          id: latestUpdate.id,
          headline: latestUpdate.headline,
          body: latestUpdate.body,
          adSpendCents: latestUpdate.adSpendCents,
          sentAt: latestUpdate.sentAt,
        }
      : null,
    pendingSurvey,
  });
}

// POST { updateId } — the client opened this update on their Overview
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const updateId = typeof body.updateId === "string" ? body.updateId : "";
  if (!updateId) {
    return NextResponse.json({ error: "updateId is required." }, { status: 400 });
  }
  const stamped = await markUpdateViewed(session.user.id, updateId);
  return NextResponse.json({ ok: true, stamped });
}
