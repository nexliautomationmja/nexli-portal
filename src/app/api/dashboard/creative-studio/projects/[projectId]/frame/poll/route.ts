import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { writeStorage } from "@/lib/creative-studio/frames";
import { AUTO_REPLY, checkFrameTask, ManusError, replyToTask } from "@/lib/creative-studio/manus";

export const maxDuration = 90;

type Ctx = { params: Promise<{ projectId: string }> };

/** Check running Manus frame tasks; save finished images as frame options (Manus links are temporary). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();

  const running = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.projectId, project.id),
        eq(creativeAssets.kind, "manus_task"),
        inArray(creativeAssets.status, ["running", "waiting"])
      )
    );

  for (const task of running) {
    if (!task.providerTaskId) continue;
    try {
      const { state, activity } = await checkFrameTask(task.providerTaskId);
      // Save what Manus is doing so the live card survives a reload.
      const meta: Record<string, unknown> = { ...((task.metadata ?? {}) as Record<string, unknown>), activity };
      await db.update(creativeAssets).set({ metadata: meta }).where(eq(creativeAssets.id, task.id));
      if (state.state === "running") {
        if (task.status === "waiting") {
          await db.update(creativeAssets).set({ status: "running", metadata: { ...meta, waiting: null } }).where(eq(creativeAssets.id, task.id));
        }
        continue;
      }
      if (state.state === "waiting") {
        // Already answered (Manus hasn't picked the reply up yet): keep showing it as working.
        const answeredKey = state.eventId ?? `q:${state.prompt.slice(0, 200)}`;
        if (meta.answeredKey === answeredKey) continue;
        const autoReplies = typeof meta.autoReplies === "number" ? meta.autoReplies : 0;
        // First question: answer it ourselves ("use your best judgment"). Never auto-approve actions.
        if (state.kind === "question" && autoReplies < 1) {
          await replyToTask(task.providerTaskId, AUTO_REPLY);
          await db
            .update(creativeAssets)
            .set({ metadata: { ...meta, autoReplies: autoReplies + 1, lastQuestion: state.prompt, answeredKey } })
            .where(eq(creativeAssets.id, task.id));
          continue;
        }
        await db
          .update(creativeAssets)
          .set({
            status: "waiting",
            metadata: {
              ...meta,
              waiting: { kind: state.kind, prompt: state.prompt, options: state.options, eventId: state.eventId, eventType: state.eventType, key: answeredKey },
            },
          })
          .where(eq(creativeAssets.id, task.id));
        continue;
      }
      if (state.state === "failed") {
        await db.update(creativeAssets).set({ status: "failed", error: state.error.slice(0, 500) }).where(eq(creativeAssets.id, task.id));
        continue;
      }
      let saved = 0;
      for (const img of state.images.slice(0, 4)) {
        try {
          const res = await fetch(img.url);
          if (!res.ok) throw new Error(`download ${res.status}`);
          const png = await sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" }).rotate().png().toBuffer({ resolveWithObject: true });
          const path = `${project.id}/options/${randomUUID()}.png`;
          await writeStorage(path, png.data, "image/png");
          await db.insert(creativeAssets).values({
            projectId: project.id,
            kind: "frame_option",
            storagePath: path,
            mime: "image/png",
            width: png.info.width,
            height: png.info.height,
            source: "manus",
            providerTaskId: task.providerTaskId,
            metadata: { taskAssetId: task.id },
          });
          saved++;
        } catch (err) {
          console.error("[creative-studio] saving Manus image failed:", err instanceof Error ? err.message : err);
        }
      }
      await db
        .update(creativeAssets)
        .set(saved > 0 ? { status: "done", error: null } : { status: "failed", error: "Manus's images couldn't be downloaded. Try again." })
        .where(eq(creativeAssets.id, task.id));
    } catch (err) {
      if (err instanceof ManusError && /MANUS_API_KEY/.test(err.message)) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      console.error("[creative-studio] Manus poll failed:", err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json(await projectDetail(project));
}
