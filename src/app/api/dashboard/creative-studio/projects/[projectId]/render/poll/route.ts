import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { pollClips } from "@/lib/creative-studio/render";
import { accessToken, KlingNotConnectedError, KlingToolError } from "@/lib/creative-studio/kling-mcp";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };

/** Check rendering clips on Kling and store the finished ones (the page calls this every ~20 s). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  let poll = { rendering: 0, finished: 0 };
  try {
    const token = await accessToken(access.ownerId);
    poll = await pollClips(token, project);
  } catch (err) {
    if (err instanceof KlingNotConnectedError || (err instanceof KlingToolError && err.kind === "auth")) {
      return NextResponse.json({ error: err.message, needsKling: true }, { status: 400 });
    }
    console.error("[creative-studio] poll failed:", err instanceof Error ? err.message : err);
  }
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json({ ...(await projectDetail(fresh!)), poll });
}
