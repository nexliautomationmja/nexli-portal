import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { createUploadTarget } from "@/lib/creative-studio/storage";

type Ctx = { params: Promise<{ projectId: string }> };

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };

/**
 * Upload your edited cut of the whole video (for the Remotion edit).
 * POST { action: "sign", mime } → one-time upload target (browser → storage).
 * POST { action: "register", path, mime, filename, note } → saved on the project.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!VIDEO_TYPES[mime]) return NextResponse.json({ error: "Upload an MP4 or MOV file" }, { status: 400 });

  if (body?.action === "sign") {
    return NextResponse.json(await createUploadTarget(`${project.id}/final/${randomUUID()}.${VIDEO_TYPES[mime]}`));
  }
  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`${project.id}/final/`)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    await db.insert(creativeAssets).values({
      projectId: project.id,
      kind: "final_cut",
      storagePath: path,
      mime,
      source: "upload",
      metadata: {
        filename: typeof body.filename === "string" ? body.filename.slice(0, 200) : "final cut",
        note: typeof body.note === "string" ? body.note.slice(0, 3000) : "",
      },
    });
    return NextResponse.json(await projectDetail(project));
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
