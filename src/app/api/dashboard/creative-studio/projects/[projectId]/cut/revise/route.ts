import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeCuts, type CutOverride } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { applyRevision, reviseCut } from "@/lib/creative-studio/autocut";
import { entryFor, latestCut } from "@/lib/creative-studio/autocut-service";
import { claudeError } from "@/lib/creative-studio/script";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * "Tighter where she says…": Claude maps the note to timing edits (or a
 * re-render when the take itself is wrong) and a new cut version is created.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1500) : "";
  if (!note) return NextResponse.json({ error: "Say what to change" }, { status: 400 });

  const base = await latestCut(project.id);
  if (!base || base.status === "cutting") {
    return NextResponse.json({ error: "Wait for the current cut to finish first." }, { status: 409 });
  }
  const clips = await clipsOf(project.id);
  const current = new Map<number, CutOverride[]>(
    clips.map((c, i) => [i, entryFor(base, c).overrides])
  );

  let rev;
  try {
    rev = await reviseCut({
      note,
      settings: base.settings,
      clips: clips.map((c, i) => ({
        number: i + 1,
        section: c.section,
        line: c.line,
        transcript: c.transcript && c.transcript.version === c.version ? c.transcript : null,
        overrides: current.get(i) ?? [],
      })),
    });
  } catch (err) {
    console.error("[creative-studio] cut revise failed:", err);
    return NextResponse.json({ error: claudeError(err, "Couldn't apply that note") }, { status: 502 });
  }

  const wordCounts = clips.map((c) => (c.transcript?.version === c.version ? c.transcript.words.length : 0));
  const next = applyRevision(base.settings, current, rev, clips.length, wordCounts);
  const rerender = rev.rerender
    .map((r) => ({ clip: clips[r.clip - 1], note: r.note }))
    .filter((r) => r.clip)
    .map((r) => ({ clipId: r.clip!.id, number: r.clip!.idx + 1, note: r.note }));
  const changed =
    rev.edits.length > 0 || rerender.length > 0 || next.settings.speed !== base.settings.speed || next.settings.gap !== base.settings.gap;
  if (!changed) {
    return NextResponse.json({ ...(await projectDetail(project)), summary: rev.summary || "Nothing in that note mapped to a change." });
  }

  const rerenderIds = new Set(rerender.map((r) => r.clipId));
  const [cut] = await db
    .insert(creativeCuts)
    .values({
      projectId: project.id,
      version: base.version + 1,
      settings: next.settings,
      plan: clips.map((c, i) => ({
        clipId: c.id,
        version: c.version,
        // A re-rendered take gets new words, so its old fixes don't apply.
        overrides: rerenderIds.has(c.id) ? [] : next.overrides.get(i) ?? [],
        manual: rerenderIds.has(c.id) ? null : entryFor(base, c).manual,
        segments: [],
        sourceS: 0,
        keptS: 0,
        hash: "",
      })),
      status: "cutting",
      note,
    })
    .returning({ id: creativeCuts.id });
  return NextResponse.json({ ...(await projectDetail(project)), cutId: cut.id, summary: rev.summary, rerender });
}
