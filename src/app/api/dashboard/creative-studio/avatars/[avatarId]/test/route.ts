import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { pollTestClip, startTestClip } from "@/lib/creative-studio/avatar-kling";
import { accessToken, KlingNotConnectedError, KlingToolError } from "@/lib/creative-studio/kling-mcp";

export const maxDuration = 300;

type Ctx = { params: Promise<{ avatarId: string }> };

async function kling(ownerId: string): Promise<string | NextResponse> {
  try {
    return await accessToken(ownerId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling", needsKling: true }, { status: 400 });
  }
}

/** POST → a 5-second Kling clip of the locked-in avatar saying the start of its sample (its Element: face + voice). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (!row.lockedAt) return NextResponse.json({ error: `Lock ${row.name || "the avatar"} in first.` }, { status: 409 });
  if (row.testClip?.status === "rendering") return NextResponse.json({ avatar: await avatarView(access.ownerId, row) });
  const token = await kling(access.ownerId);
  if (typeof token !== "string") return token;
  try {
    await startTestClip(token, row);
  } catch (err) {
    console.error("[creative-studio] avatar test clip failed:", err);
    const message = err instanceof KlingToolError || err instanceof Error ? err.message : "Kling couldn't start the test clip.";
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}

/** GET → check a rendering test clip (stored when it's done). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.testClip?.status === "rendering") {
    const token = await kling(access.ownerId);
    if (typeof token !== "string") return token;
    await pollTestClip(token, row).catch((err) => console.error("[creative-studio] avatar test poll failed:", err));
  }
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
