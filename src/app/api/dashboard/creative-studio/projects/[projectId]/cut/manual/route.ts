import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { cutRanges, round3 } from "@/lib/creative-studio/cutplan";
import { entryFor, latestCut } from "@/lib/creative-studio/autocut-service";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Hand trim from the trim editor: { clipId, start, end, cutWords }. Creates
 * the next cut version where that clip keeps only [start, end] (source
 * seconds) minus the cut words; every other clip is unchanged (its piece is
 * reused), so only this clip re-renders.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { clipId?: string; start?: number; end?: number; cutWords?: number[] } | null;

  const base = await latestCut(project.id);
  if (!base || base.status === "cutting") {
    return NextResponse.json({ error: "Wait for the current cut to finish first." }, { status: 409 });
  }
  const clips = await clipsOf(project.id);
  const target = clips.find((c) => c.id === body?.clipId);
  if (!target) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const duration = target.transcript?.version === target.version ? target.transcript.durationS : target.durationS;
  const start = Number(body?.start);
  const end = Number(body?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.2) {
    return NextResponse.json({ error: "Keep at least a fraction of a second of the clip." }, { status: 400 });
  }
  const manual = { start: round3(Math.max(0, start)), end: round3(Math.min(duration || end, end)) };
  const wordCount = target.transcript?.version === target.version ? target.transcript.words.length : 0;
  const cutWords = Array.isArray(body?.cutWords)
    ? body.cutWords.filter((i) => Number.isInteger(i) && i >= 0 && i < wordCount)
    : [];
  // Full trim window = no manual entry (back to the auto-cut).
  const isReset = manual.start <= 0.001 && manual.end >= (duration || 0) - 0.001 && cutWords.length === 0;

  const [cut] = await db
    .insert(creativeCuts)
    .values({
      projectId: project.id,
      version: base.version + 1,
      settings: base.settings,
      plan: clips.map((c) => {
        const prev = entryFor(base, c);
        if (c.id !== target.id) {
          return { clipId: c.id, version: c.version, overrides: prev.overrides, manual: prev.manual, segments: [], sourceS: 0, keptS: 0, hash: "" };
        }
        const keepTiming = prev.overrides.filter((o) => o.action !== "cut" && o.action !== "restore");
        return {
          clipId: c.id,
          version: c.version,
          overrides: [...keepTiming, ...cutRanges(cutWords)],
          manual: isReset ? null : manual,
          segments: [],
          sourceS: 0,
          keptS: 0,
          hash: "",
        };
      }),
      status: "cutting",
      note: isReset ? `Reset clip ${target.idx + 1} to the auto-cut` : `Manual trim · clip ${target.idx + 1}`,
    })
    .returning({ id: creativeCuts.id });
  return NextResponse.json({ ...(await projectDetail(project)), cutId: cut.id });
}
