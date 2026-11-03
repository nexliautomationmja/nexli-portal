import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail, replaceScript } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Restore an earlier script version (the current one is kept in history too). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { version?: number } | null;
  const snap = (project.scriptHistory ?? []).find((h) => h.version === body?.version);
  if (!snap) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  await replaceScript(
    project,
    { frameSpec: snap.frameSpec, notes: snap.notes, clips: snap.clips },
    `Replaced by restoring v${snap.version}`
  );
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
