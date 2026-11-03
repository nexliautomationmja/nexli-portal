import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { confirmTaskAction, ManusError, replyToTask, stopTask } from "@/lib/creative-studio/manus";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Answer a paused Manus frame task:
 *   { taskId, answer }   → reply to its question
 *   { taskId, allow }    → approve the action it's waiting on (your click, never automatic)
 *   { taskId, cancel }   → stop the task
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { taskId?: string; answer?: string; allow?: boolean; cancel?: boolean } | null;
  const [task] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, body?.taskId ?? "00000000-0000-0000-0000-000000000000"), eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "manus_task")))
    .limit(1);
  if (!task?.providerTaskId) return NextResponse.json({ error: "Manus task not found" }, { status: 404 });
  const meta = (task.metadata ?? {}) as { waiting?: { kind: string; eventId: string | null } } & Record<string, unknown>;

  try {
    if (body?.cancel) {
      await stopTask(task.providerTaskId);
      await db.update(creativeAssets).set({ status: "failed", error: "Cancelled" }).where(eq(creativeAssets.id, task.id));
    } else if (body?.allow) {
      if (!meta.waiting?.eventId) return NextResponse.json({ error: "Nothing to approve" }, { status: 400 });
      const ok = await confirmTaskAction(task.providerTaskId, meta.waiting.eventId);
      if (!ok) return NextResponse.json({ error: "Manus didn't accept the approval. Try again." }, { status: 409 });
      await db.update(creativeAssets).set({ status: "running", metadata: { ...meta, waiting: null } }).where(eq(creativeAssets.id, task.id));
    } else {
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) return NextResponse.json({ error: "Type an answer" }, { status: 400 });
      await replyToTask(task.providerTaskId, answer);
      await db.update(creativeAssets).set({ status: "running", metadata: { ...meta, waiting: null } }).where(eq(creativeAssets.id, task.id));
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof ManusError ? err.message : "Couldn't reach Manus" }, { status: 502 });
  }
  return NextResponse.json(await projectDetail(project));
}
