import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNexliAdminId } from "@/lib/foundation-project";

/** Mercury settings and the review list are Nexli's own (the admin workspace only). */
export async function requireNexliAdmin(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "admin" || session.user.id !== (await getNexliAdminId())) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}
