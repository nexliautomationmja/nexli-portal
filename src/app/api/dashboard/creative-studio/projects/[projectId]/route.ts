import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeProjects, type FrameSpec } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail, rebuildPrompts } from "@/lib/creative-studio/service";
import { removePaths } from "@/lib/creative-studio/storage";
import { cleanBrief, cleanFormatRig } from "@/lib/creative-studio/validate";
import { presenterForStudio } from "@/lib/creative-studio/presenters";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  return NextResponse.json(await projectDetail(project));
}

function cleanFrameSpec(input: unknown, current: FrameSpec | null): FrameSpec | null {
  if (!input || typeof input !== "object") return null;
  const f = input as Partial<FrameSpec>;
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 4000) : "");
  return {
    // A story's scene descriptions and presenter aren't edited here; keep them.
    ...(current?.scenes ? { scenes: current.scenes } : {}),
    ...(current && "presenterId" in current ? { presenterId: current.presenterId } : {}),
    subject: s(f.subject),
    room: s(f.room),
    base: s(f.base),
    positions: Array.isArray(f.positions)
      ? f.positions
          .filter((p) => p && ["LEFT", "CENTER", "RIGHT"].includes(p.position))
          .map((p) => ({ position: p.position, who: s(p.who), outfit: s(p.outfit), shortName: s(p.shortName) }))
      : [],
  };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const patch: Partial<typeof creativeProjects.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (body.brief) patch.brief = cleanBrief(body.brief);
  if (body.format !== undefined || body.rig !== undefined) {
    const fr = cleanFormatRig(body.format ?? project.format, body.rig ?? project.rig);
    patch.format = fr.format;
    patch.rig = fr.rig;
  }
  if (body.frameSpec !== undefined) patch.frameSpec = cleanFrameSpec(body.frameSpec, project.frameSpec);
  // Who presents this video (null = the studio's default).
  if (body.presenterId !== undefined) {
    const presenter = await presenterForStudio(access.ownerId, project.studioId, body.presenterId);
    if (presenter === undefined) return NextResponse.json({ error: "That presenter isn't in this studio." }, { status: 400 });
    patch.presenter = presenter;
  }

  // Anything that changes the prompts unlocks an approved script.
  const changesPrompts =
    patch.format !== undefined || patch.rig !== undefined || patch.frameSpec !== undefined || patch.presenter !== undefined;
  if (changesPrompts && project.status === "approved") {
    patch.status = "scripted";
    patch.approvedAt = null;
  }

  const [updated] = await db
    .update(creativeProjects)
    .set(patch)
    .where(eq(creativeProjects.id, project.id))
    .returning();
  if (changesPrompts) await rebuildPrompts(updated);
  return NextResponse.json(await projectDetail(updated));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const assets = await db
    .select({ path: creativeAssets.storagePath })
    .from(creativeAssets)
    .where(eq(creativeAssets.projectId, project.id));
  await removePaths(assets.map((a) => a.path));
  await db.delete(creativeProjects).where(eq(creativeProjects.id, project.id));
  return NextResponse.json({ ok: true });
}
