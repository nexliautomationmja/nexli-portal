import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeBatches, creativeProjects, type BatchPlanItem } from "@/lib/creative-studio/tables";
import { EMPTY_BRIEF } from "@/lib/creative-studio/prompts";
import { cleanFormatRig } from "@/lib/creative-studio/validate";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { BATCH_MAX } from "@/lib/creative-studio/batch-shared";

/** Batches for the studio home, with how far their videos have got. */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batches = await db
    .select()
    .from(creativeBatches)
    .where(eq(creativeBatches.ownerId, access.ownerId))
    .orderBy(desc(creativeBatches.createdAt))
    .limit(30);
  const ids = batches.map((b) => b.id);
  const projects = ids.length
    ? await db
        .select({ batchId: creativeProjects.batchId, status: creativeProjects.status })
        .from(creativeProjects)
        .where(inArray(creativeProjects.batchId, ids))
    : [];
  return NextResponse.json({
    batches: batches.map((b) => {
      const mine = projects.filter((p) => p.batchId === b.id);
      const count = (...st: string[]) => mine.filter((p) => st.includes(p.status)).length;
      return {
        id: b.id,
        format: b.format,
        count: mine.length,
        brief: b.brief,
        titles: b.plan.map((i) => i.title),
        scripted: count("scripted"),
        rendering: count("approved", "rendering"),
        clipsReady: count("clips_ready"),
        createdAt: b.createdAt.toISOString(),
      };
    }),
  });
}

/**
 * Create a batch from the approved plan: the batch row and one project per
 * video (same as "New video", with its own brief). Pasted frames are
 * uploaded to their projects by the browser afterwards.
 * POST { format, brief, items: [{ title, direction, shot, frame }] }
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as { format?: unknown; brief?: unknown; items?: unknown } | null;
  const { format, rig } = cleanFormatRig(body?.format, null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 6000) : "";
  const raw = Array.isArray(body?.items) ? (body.items as Record<string, unknown>[]) : [];
  const items: BatchPlanItem[] = raw
    .map((i) => ({
      title: typeof i?.title === "string" && i.title.trim() ? i.title.trim().slice(0, 120) : "Untitled video",
      direction: typeof i?.direction === "string" ? i.direction.trim().slice(0, 4000) : "",
      shot: typeof i?.shot === "string" ? i.shot.trim().slice(0, 600) : "",
      frame: typeof i?.frame === "number" && Number.isInteger(i.frame) && i.frame >= 0 ? i.frame : null,
    }))
    .filter((i) => i.direction);
  if (items.length < 2) return NextResponse.json({ error: "A batch needs at least 2 videos with a description" }, { status: 400 });
  if (items.length > BATCH_MAX[format]) {
    return NextResponse.json({ error: `A batch can be at most ${BATCH_MAX[format]} ${format === "vsl_16x9" ? "VSLs" : "ads"}` }, { status: 400 });
  }

  const [batch] = await db
    .insert(creativeBatches)
    .values({ ownerId: access.ownerId, createdBy: access.actorId, format, count: items.length, brief, plan: items })
    .returning({ id: creativeBatches.id });
  const projects = await db
    .insert(creativeProjects)
    .values(
      items.map((it, i) => ({
        ownerId: access.ownerId,
        createdBy: access.actorId,
        title: it.title,
        format,
        rig,
        brief: { ...EMPTY_BRIEF, direction: it.direction },
        batchId: batch.id,
        batchIndex: i,
      }))
    )
    .returning({ id: creativeProjects.id, index: creativeProjects.batchIndex });
  return NextResponse.json({ ok: true, id: batch.id, projects: projects.map((p) => ({ id: p.id, index: p.index ?? 0 })) });
}
