import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { COPY_EXT, COPY_MEDIA, listJobs } from "@/lib/creative-studio/ad-copy-jobs";

/**
 * The Ad copy tool. GET → recent jobs.
 * POST { action: "sign", mime } → one-time upload target (browser → storage).
 * POST { action: "register", path, mime, filename, note, group?, groupIndex? } → { id } of the new job
 * (group ties together creatives dropped in at once, up to 20).
 */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  return NextResponse.json({ jobs: await listJobs(access.ownerId) });
}

export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!COPY_MEDIA[mime]) return NextResponse.json({ error: "Drop an MP4 or MOV video, or a PNG, JPG or WebP image" }, { status: 400 });

  if (body?.action === "sign") {
    return NextResponse.json(await createUploadTarget(`adcopy/${access.ownerId}/${randomUUID()}.${COPY_EXT[mime]}`));
  }
  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`adcopy/${access.ownerId}/`)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const [job] = await db
      .insert(creativeAssets)
      .values({
        ownerId: access.ownerId,
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
          versions: [],
        },
      })
      .returning({ id: creativeAssets.id });
    return NextResponse.json({ id: job.id });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
