import { NextResponse } from "next/server";
import { resolveNexliThread } from "@/lib/nexli-thread";
import { countUnread } from "@/lib/portal-messages";

// GET — unread messages from Nexli (sidebar badge polling)
export async function GET() {
  const t = await resolveNexliThread();
  if (!t.ok) {
    // A non-client (admin) simply has nothing unread.
    if (t.status === 404) return NextResponse.json({ unread: 0 });
    return NextResponse.json({ error: t.error }, { status: t.status });
  }
  try {
    return NextResponse.json({ unread: await countUnread(t.ownerId, t.clientEmail, "cpa") });
  } catch (err) {
    console.error("[nexli-messages unread] failed:", err);
    return NextResponse.json({ unread: 0 });
  }
}
