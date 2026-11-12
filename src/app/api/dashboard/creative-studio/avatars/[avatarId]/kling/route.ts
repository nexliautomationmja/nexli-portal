import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { ensureElement } from "@/lib/creative-studio/avatar-kling";
import { accessToken, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

export const maxDuration = 300;

type Ctx = { params: Promise<{ avatarId: string }> };

/** POST → (re)make the locked-in avatar's Kling Element: its photos and voice, the same in every clip. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (!row.lockedAt) return NextResponse.json({ error: `Lock ${row.name || "the avatar"} in first.` }, { status: 409 });
  let token: string;
  try {
    token = await accessToken(access.ownerId);
  } catch (err) {
    const message = err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling";
    return NextResponse.json({ error: message, needsKling: true }, { status: 400 });
  }
  // A retry starts clean (a stale error would otherwise stay on screen).
  await db.update(creativePresenters).set({ klingElementError: null }).where(eq(creativePresenters.id, row.id));
  await ensureElement(token, { ...row, klingElementError: null });
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
