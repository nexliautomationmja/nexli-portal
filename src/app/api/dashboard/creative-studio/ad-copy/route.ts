import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { COPY_EXT, COPY_MEDIA, listJobs } from "@/lib/creative-studio/ad-copy-jobs";

/**
 * The Ad copy tool, per studio (`?studio=`; Nexli's by default). GET → recent jobs.
 * POST { action: "sign", mime } → one-time upload target (browser → storage).
 * POST { action: "register", path, mime, filename, note, group?, groupIndex? } → { id } of the new job
 * (group ties together creatives dropped in at once, up to 20).
 */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  return NextResponse.json({ jobs: await listJobs(access.ownerId, studio) });
}

export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  const mine = (p: unknown): p is string => typeof p === "string" && p.startsWith(`adcopy/${access.ownerId}/`);

  if (body?.action === "sign") {
    // Creatives, plus the stills (JPEG) and soundtrack (WAV) of a big video prepared in the browser.
    if (!COPY_EXT[mime]) return NextResponse.json({ error: "Drop an MP4 or MOV video, or a PNG, JPG or WebP image" }, { status: 400 });
    return NextResponse.json(await createUploadTarget(`adcopy/${access.ownerId}/${randomUUID()}.${COPY_EXT[mime]}`));
  }
  if (!COPY_MEDIA[mime]) return NextResponse.json({ error: "Drop an MP4 or MOV video, or a PNG, JPG or WebP image" }, { status: 400 });
  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!mine(path)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const prepared = body.prepared === true && COPY_MEDIA[mime] === "video";
    const framePaths = prepared && Array.isArray(body.framePaths) ? body.framePaths.filter(mine).slice(0, 8) : [];
    if (prepared && framePaths.length === 0) return NextResponse.json({ error: "No stills came through from the video" }, { status: 400 });
    const [job] = await db
      .insert(creativeAssets)
      .values({
        ownerId: access.ownerId,
        studioId: studio.id,
        kind: "copy_job",
        storagePath: path,
        mime,
        source: "upload",
        metadata: {
          filename: typeof body.filename === "string" ? body.filename.slice(0, 200) : "upload",
          note: typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "",
          ...(typeof body.group === "string" && /^[0-9a-f-]{36}$/i.test(body.group)
            ? { group: body.group, groupIndex: typeof body.groupIndex === "number" ? Math.max(0, Math.min(19, Math.round(body.groupIndex))) : 0 }
            : {}),
          ...(prepared ? { prepared: true, framePaths, audioPath: mine(body.audioPath) ? body.audioPath : null } : {}),
          versions: [],
        },
      })
      .returning({ id: creativeAssets.id });
    return NextResponse.json({ id: job.id });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
