import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureAdsTables } from "@/lib/ads/tables";
import { metaAdAccountId } from "@/lib/meta-ads";

/**
 * Admins (Marcel and team members — members share the owner's id) only.
 * ownerId = the workspace, actorId = the person (for "done by").
 */
export async function requireAdsAdmin(): Promise<
  { ok: true; ownerId: string; actorId: string; accountId: string | null } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "admin") return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  await ensureAdsTables();
  return { ok: true, ownerId: session.user.id, actorId: session.user.memberId ?? session.user.id, accountId: metaAdAccountId() };
}
