import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claimStep, runSourceStep, sourceMeta, sourceOf, type SourceStep } from "@/lib/creative-studio/source";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Get the video she reacts to ready, one step per request (the page runs
 * both side by side and resumes them after a reload):
 * POST { step: "analyze" } — stills and the words, so Claude can watch it;
 * POST { step: "proxy" } — the light copy the edit plays in the corner.
 * A step that's done, or running in another request, returns straight away.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const deadline = Date.now() + 290_000;
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { step?: unknown } | null;
  const step: SourceStep | null = body?.step === "analyze" || body?.step === "proxy" ? body.step : null;
  if (!step) return NextResponse.json({ error: "Unknown step" }, { status: 400 });

  const source = await sourceOf(project);
  if (!source) return NextResponse.json({ error: "This video has no video to react to yet." }, { status: 404 });
  const meta = sourceMeta(source);
  const done = step === "analyze" ? Boolean(meta.analyzedAt) : Boolean(meta.proxyPath);
  if (!done && (await claimStep(source.id, step))) await runSourceStep(source, step, deadline);
  return NextResponse.json(await projectDetail(project));
}
