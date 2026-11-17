import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdsAdmin } from "@/lib/ads/access";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { GRADE_DAILY_CAP, createGrade, gradesToday, graderState, renderFor } from "@/lib/ads/grader";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * The Ad Grader. GET → state (learning, the blind check, recent grades).
 * POST { action: "sign", mime } → a one-time upload target (browser → storage).
 * POST { action: "register", path, mime, title } → { id } of a new grade.
 * POST { action: "render", projectId } → { id } for a finished Creative Studio video.
 */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, state: await graderState(access.ownerId, access.accountId) });
  } catch (err) {
    console.error("[ads grader] state failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the grader right now." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";

  if (body?.action === "sign") {
    if (!EXT[mime]) return NextResponse.json({ error: "Drop an MP4 or MOV video (or a PNG, JPG or WebP image)." }, { status: 400 });
    return NextResponse.json(await createUploadTarget(`adgrade/${access.ownerId}/uploads/${randomUUID()}.${EXT[mime]}`));
  }
  if (body?.action === "register" || body?.action === "render") {
    if ((await gradesToday(access.ownerId, access.accountId)) >= GRADE_DAILY_CAP) {
      return NextResponse.json({ error: `That's ${GRADE_DAILY_CAP} grades in the last 24 hours — the daily limit keeps the cost down. Try again tomorrow.` }, { status: 429 });
    }
  }
  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`adgrade/${access.ownerId}/uploads/`) || !EXT[mime]) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    const title = (typeof body.title === "string" ? body.title : "").replace(/\.[a-z0-9]+$/i, "").trim() || "Uploaded creative";
    const row = await createGrade({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, kind: "upload", title, source: { path, mime } });
    return NextResponse.json({ id: row.id });
  }
  if (body?.action === "render") {
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const r = await renderFor(access.ownerId, projectId);
    if (!r) return NextResponse.json({ error: "That video isn't finished yet (or isn't yours)." }, { status: 404 });
    const row = await createGrade({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, kind: "render", title: r.title, source: { projectId } });
    return NextResponse.json({ id: row.id });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
