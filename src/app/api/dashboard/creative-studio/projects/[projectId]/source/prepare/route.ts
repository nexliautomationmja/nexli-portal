import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claimStep, mediaOf, runSourceStep, sourceMeta, sourceOf, type SourceStep } from "@/lib/creative-studio/source";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Get the video she reacts to ready, one step per request (the page runs
 * both side by side and resumes them after a reload):
 * POST { step: "analyze" } — stills and the words, so Claude can watch it;
 * POST { step: "proxy" } — the light copy the edit plays in the corner.
 * With { assetId } it's one of the videos shown on screen or to recreate
 * (a video to recreate only needs "analyze").
 * A step that's done, or running in another request, returns straight away.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const deadline = Date.now() + 290_000;
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { step?: unknown; assetId?: unknown } | null;
  const step: SourceStep | null = body?.step === "analyze" || body?.step === "proxy" ? body.step : null;
  if (!step) return NextResponse.json({ error: "Unknown step" }, { status: 400 });

  const assetId = typeof body?.assetId === "string" ? body.assetId : null;
  const source = assetId ? await mediaOf(project, assetId) : await sourceOf(project);
  if (!source) return NextResponse.json({ error: assetId ? "That video is gone. Upload it again." : "This video has no video to react to yet." }, { status: 404 });
  const meta = sourceMeta(source);
  const done = step === "analyze" ? Boolean(meta.analyzedAt) : Boolean(meta.proxyPath) || meta.role === "recreate";
  if (!done && (await claimStep(source.id, step))) await runSourceStep(source, step, deadline);
  return NextResponse.json(await projectDetail(project));
}
