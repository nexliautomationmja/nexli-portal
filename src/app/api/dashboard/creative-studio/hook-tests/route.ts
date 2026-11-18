import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { HOOK_UPLOAD_MAX_BYTES, HOOK_UPLOAD_TYPES } from "@/lib/creative-studio/hook-shared";
import { HookError, createProjectTest, createUploadTest, hookUploadPrefix, listTests } from "@/lib/creative-studio/hook-tests";

/** The studio's hook tests (`?studio=`; Nexli's by default), newest first. */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  return NextResponse.json({ tests: await listTests(access.ownerId, studio) });
}

/**
 * Start a hook test.
 * POST { action: "project", projectId } → on a video made in this studio.
 * POST { action: "sign", mime, size } → a one-time upload target for a dropped-in video (browser → storage).
 * POST { action: "upload", path, mime, filename, size } → on that dropped-in video.
 * The page then drives the reading (hook-tests/[id] { action: "run" }).
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "project") {
      const test = await createProjectTest(access.ownerId, access.actorId, studio, typeof body.projectId === "string" ? body.projectId : "");
      return NextResponse.json({ id: test.id });
    }
    const mime = typeof body?.mime === "string" ? body.mime : "";
    const size = typeof body?.size === "number" && body.size > 0 ? body.size : null;
    if (body?.action === "sign") {
      const ext = HOOK_UPLOAD_TYPES[mime];
      if (!ext) throw new HookError("Drop an MP4 or MOV video.");
      if (size && size > HOOK_UPLOAD_MAX_BYTES) throw new HookError(`That file is ${Math.round(size / 1024 / 1024)} MB. Drop one under ${HOOK_UPLOAD_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).`);
      return NextResponse.json(await createUploadTarget(`${hookUploadPrefix(access.ownerId)}${randomUUID()}.${ext}`));
    }
    if (body?.action === "upload") {
      const test = await createUploadTest(access.ownerId, access.actorId, studio, {
        path: typeof body.path === "string" ? body.path : "",
        mime,
        filename: typeof body.filename === "string" ? body.filename : "video",
        size,
      });
      return NextResponse.json({ id: test.id });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof HookError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[creative-studio] hook test start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't start the hook test. Try again." }, { status: 500 });
  }
}
