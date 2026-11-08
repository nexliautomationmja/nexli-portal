import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { DEFAULT_CUT } from "@/lib/creative-studio/autocut";
import { entryFor, latestCut } from "@/lib/creative-studio/autocut-service";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Start a new auto-cut version once every clip is rendered. Settings and
 * per-clip fixes carry over from the previous version (a re-rendered take
 * starts clean). The page then renders each clip's piece and joins them.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { note?: string } | null;

  const clips = await clipsOf(project.id);
  if (clips.length === 0 || clips.some((c) => c.status !== "done" || !c.videoAssetId)) {
    return NextResponse.json({ error: "The auto-cut starts once every clip is rendered." }, { status: 400 });
  }
  const base = await latestCut(project.id);
  if (base?.status === "cutting") {
    return NextResponse.json({ ...(await projectDetail(project)), cutId: base.id });
  }
  const [cut] = await db
    .insert(creativeCuts)
    .values({
      projectId: project.id,
      version: (base?.version ?? 0) + 1,
      settings: base?.settings ?? DEFAULT_CUT,
      plan: clips.map((c) => {
        const prev = entryFor(base, c);
        return {
          clipId: c.id,
          version: c.version,
          overrides: prev.overrides,
          manual: prev.manual,
          sections: prev.sections,
          segments: [],
          sourceS: 0,
          keptS: 0,
          hash: "",
        };
      }),
      status: "cutting",
      note: typeof body?.note === "string" ? body.note.slice(0, 500) : base ? "New takes" : null,
    })
    .returning({ id: creativeCuts.id });
  return NextResponse.json({ ...(await projectDetail(project)), cutId: cut.id });
}
