import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { conversationOwnership, getConversation, isGhlId } from "@/lib/ghl-client";

export type ConversationAccess =
  | { ok: true; locationId: string }
  | { ok: false; status: 404 | 502; error: string };

const NOT_FOUND = { ok: false, status: 404, error: "Conversation not found" } as const;

/**
 * May this owner read or reply on this GHL conversation? Only when GHL says
 * it belongs to the owner's own location (team members sign in as the owner,
 * so they're covered). Everything else is a 404, so ids from other accounts
 * can't be probed; GHL being down is a 502.
 */
export async function conversationAccess(ownerId: string, convoId: string): Promise<ConversationAccess> {
  if (!isGhlId(convoId)) return NOT_FOUND;
  const [user] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!user?.ghlLocationId) return NOT_FOUND;

  let conversation;
  try {
    conversation = await getConversation(convoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // GHL answers 400/403/404/422 for ids that aren't reachable: not found.
    if (/GHL API error: (400|403|404|422)\b/.test(message)) return NOT_FOUND;
    console.error("[ghl] conversation lookup failed:", message.slice(0, 300));
    return { ok: false, status: 502, error: "GoHighLevel didn't answer. Try again in a moment." };
  }

  const verdict = conversationOwnership(user.ghlLocationId, conversation);
  if (!verdict.ok) {
    console.warn(`[ghl] conversation ${convoId} refused for ${ownerId}: ${verdict.reason}`);
    return NOT_FOUND;
  }
  return { ok: true, locationId: user.ghlLocationId };
}
