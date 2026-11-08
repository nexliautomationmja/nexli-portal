import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { computeSegments, cutRanges, MIN_KEPT, normalizeSections, round3 } from "@/lib/creative-studio/cutplan";
import { entryFor, latestCut } from "@/lib/creative-studio/autocut-service";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Hand trim from the trim editor: { clipId, start, end, cutWords, sections }.
 * Creates the next cut version where that clip keeps only [start, end]
 * (source seconds) minus the cut words and the hand-cut sections (exact
 * source-second ranges); every other clip is unchanged (its piece is reused),
 * so only this clip re-renders.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as {
    clipId?: string;
    start?: number;
    end?: number;
    cutWords?: number[];
    /** Exact stretches to cut out, in source seconds. */
    sections?: { start?: unknown; end?: unknown }[];
    keepPauses?: boolean;
    /** false = you didn't move the edges: keep the auto-cut's start/end, apply only word cuts. */
    edges?: boolean;
    reset?: boolean;
  } | null;

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
  const manual = {
    start: round3(Math.max(0, start)),
    end: round3(Math.min(duration || end, end)),
    ...(body?.keepPauses ? { keepPauses: true } : {}),
  };
  const wordCount = target.transcript?.version === target.version ? target.transcript.words.length : 0;
  const cutWords = Array.isArray(body?.cutWords)
    ? body.cutWords.filter((i) => Number.isInteger(i) && i >= 0 && i < wordCount)
    : [];
  // Only the editor's "Reset to auto" goes back to the auto-cut; any other window is kept exactly.
  const isReset = body?.reset === true;
  const sections = isReset
    ? []
    : normalizeSections(
        (Array.isArray(body?.sections) ? body.sections : [])
          .slice(0, 50)
          .map((x) => ({ start: Number(x?.start), end: Number(x?.end) })),
        duration || end
      );

  const prevEntry = entryFor(base, target);
  const keepTiming = prevEntry.overrides.filter((o) => o.action !== "cut" && o.action !== "restore");
  const overrides = isReset ? keepTiming : [...keepTiming, ...cutRanges(cutWords)];
  const windowed = isReset || body?.edges === false ? null : manual;
  if (sections.length > 0) {
    const t = target.transcript?.version === target.version ? target.transcript : null;
    const check = computeSegments({ transcript: t, sourceS: duration || end, settings: base.settings, overrides, manual: windowed, sections });
    // computeSegments falls back to the whole window when nothing is left, which would overlap a section.
    const overlapsCut = check.segments.some((s) => sections.some((x) => s.start < x.end - 0.001 && s.end > x.start + 0.001));
    if (check.keptS < MIN_KEPT || overlapsCut) {
      return NextResponse.json({ error: "Those cuts leave almost nothing of the clip. Keep at least a fraction of a second." }, { status: 400 });
    }
  }

  const [cut] = await db
    .insert(creativeCuts)
    .values({
      projectId: project.id,
      version: base.version + 1,
      settings: base.settings,
      plan: clips.map((c) => {
        const prev = entryFor(base, c);
        if (c.id !== target.id) {
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
        }
        return {
          clipId: c.id,
          version: c.version,
          overrides,
          manual: windowed,
          sections,
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
