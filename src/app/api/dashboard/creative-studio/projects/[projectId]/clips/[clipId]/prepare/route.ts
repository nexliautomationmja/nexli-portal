import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claimUploadedClip, prepareUploadedClip } from "@/lib/creative-studio/upload-clip";

// Download, clean copy and words: a 3-minute phone video takes a couple of minutes.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string; clipId: string }> };

/**
 * Make the take of a video you added as a clip (upload-clip.ts). The page
 * calls it right after adding the video, and again on "Try again".
 * 200 = done (or failed: the clip says why); 202 { pending } while another
 * request is making it (the page checks back).
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const started = Date.now();
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const { projectId, clipId } = await params;
  const project = await loadProject(access.ownerId, projectId);
  if (!project) return notFound();
  if (!/^[0-9a-f-]{36}$/i.test(clipId)) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  const [clip] = await db
    .select()
    .from(creativeClips)
    .where(and(eq(creativeClips.id, clipId), eq(creativeClips.projectId, project.id)))
    .limit(1);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  if (!clip.upload) return NextResponse.json({ error: "That clip is made on Kling." }, { status: 400 });
  if (clip.status === "done") return NextResponse.json(await projectDetail(project));

  const claimed = await claimUploadedClip(project.id, clip.id);
  if (!claimed) return NextResponse.json({ ...(await projectDetail(project)), pending: true }, { status: 202 });
  await prepareUploadedClip(project, claimed, started + maxDuration * 1000);
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
