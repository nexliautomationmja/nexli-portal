import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { renderTrial, writeTrial } from "@/lib/creative-studio/avatar-trial";
import { claudeError } from "@/lib/creative-studio/script";
import { accessToken, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

// Writing the script (Claude) or sending the clips (Kling, 60 s backoff on a rate limit).
export const maxDuration = 300;

type Ctx = { params: Promise<{ avatarId: string }> };

/**
 * The avatar's trial video, in two steps the page runs one after the other:
 * POST { step: "write", fresh? } → the video, its frame and Claude's script;
 * POST { step: "render" } → approved and sent to Kling. Then it's a normal
 * video: auto-cut, captions and download on its page.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (!row.lockedAt) return NextResponse.json({ error: `Lock ${row.name || "the avatar"} in first.` }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { step?: unknown; fresh?: unknown } | null;

  if (body?.step === "write") {
    try {
      const project = await writeTrial(access.ownerId, access.actorId, row, body.fresh === true);
      return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!), projectId: project.id });
    } catch (err) {
      console.error("[creative-studio] avatar trial script failed:", err);
      return NextResponse.json({ error: claudeError(err, "Claude couldn't write the trial video. Try again.") }, { status: 502 });
    }
  }

  if (body?.step === "render") {
    if (!row.trialProjectId) return NextResponse.json({ error: "Write the trial video first." }, { status: 409 });
    const [project] = await db
      .select()
      .from(creativeProjects)
      .where(and(eq(creativeProjects.id, row.trialProjectId), eq(creativeProjects.ownerId, access.ownerId)))
      .limit(1);
    if (!project) return NextResponse.json({ error: "The trial video was deleted. Make it again." }, { status: 404 });
    let token: string;
    try {
      token = await accessToken(access.ownerId);
    } catch (err) {
      const message = err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling";
      return NextResponse.json({ error: message, needsKling: true, projectId: project.id }, { status: 400 });
    }
    try {
      const report = await renderTrial(token, project);
      return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!), projectId: project.id, report });
    } catch (err) {
      console.error("[creative-studio] avatar trial render failed:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 300) : "Kling couldn't start the trial video.", projectId: project.id }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
