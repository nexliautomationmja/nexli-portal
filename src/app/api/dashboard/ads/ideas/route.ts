import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { deckState, writeIdeas } from "@/lib/ads/ideas";
import { claudeError } from "@/lib/creative-studio/script";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** GET → the videos on deck (and gone live), plus the latest set of ideas. */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, ...(await deckState(access.ownerId, access.accountId)) });
  } catch (err) {
    console.error("[ads] deck failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the creatives on deck." }, { status: 502 });
  }
}

/** POST { count: 1–5, note? } → fresh video ideas, backed by Marcel's results and the Ad Library research. */
export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { count?: unknown; note?: unknown };
  const count = typeof body.count === "number" && Number.isFinite(body.count) ? body.count : 1;
  const note = typeof body.note === "string" ? body.note : "";
  try {
    const set = await writeIdeas({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, count, note });
    return NextResponse.json({ set });
  } catch (err) {
    console.error("[ads] ideas failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Couldn't come up with ideas right now. Try again.") }, { status: 502 });
  }
}
