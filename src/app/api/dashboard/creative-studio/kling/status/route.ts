import { NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { accessToken, connectionStatus, credits, disconnect, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

export const maxDuration = 30;

/** Connection status plus remaining kling.ai credits. */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const status = await connectionStatus(access.ownerId);
  if (!status.connected) return NextResponse.json({ connected: false, credits: null });
  try {
    const token = await accessToken(access.ownerId);
    const c = await credits(token);
    return NextResponse.json({ connected: true, connectedAt: status.connectedAt, credits: c.remaining });
  } catch (err) {
    if (err instanceof KlingNotConnectedError) {
      return NextResponse.json({ connected: false, credits: null, error: err.message });
    }
    console.error("[creative-studio] Kling credits check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ connected: true, connectedAt: status.connectedAt, credits: null, error: "Couldn't read your Kling credits right now." });
  }
}

/** Disconnect Kling (forgets the stored tokens). */
export async function DELETE() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  await disconnect(access.ownerId);
  return NextResponse.json({ connected: false });
}
