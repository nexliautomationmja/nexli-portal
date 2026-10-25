import { auth } from "@/auth";
import { getNexliAdminId } from "@/lib/foundation-project";

/**
 * Resolve the signed-in dashboard client's thread with Nexli:
 * ownerId = the Nexli admin, clientEmail = the user's email (lowercased).
 * Admins don't have a Nexli thread of their own.
 */
export async function resolveNexliThread(): Promise<
  | { ok: true; ownerId: string; clientEmail: string; userId: string; userName: string | null }
  | { ok: false; status: 401 | 404; error: string }
> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!session?.user?.id || !email) return { ok: false, status: 401, error: "Unauthorized" };
  if (session.user.role === "admin") return { ok: false, status: 404, error: "not_found" };
  const ownerId = await getNexliAdminId();
  if (!ownerId) return { ok: false, status: 404, error: "not_found" };
  return {
    ok: true,
    ownerId,
    clientEmail: email,
    userId: session.user.id,
    userName: session.user.name ?? null,
  };
}
