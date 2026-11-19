import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipFieldsOf, clipsOf, projectDetail, replaceScript, scoreEligible, scriptInputFor } from "@/lib/creative-studio/service";
import { claudeError, reviseScript } from "@/lib/creative-studio/script";
import { markMediaWritten, readyMedia } from "@/lib/creative-studio/media";
import { recreateEvidence } from "@/lib/creative-studio/recreate-focus";
import { scoreScript } from "@/lib/creative-studio/script-score";
import { improvementNote, nextScoreStep, scriptKey, type ScriptScore } from "@/lib/creative-studio/script-score-shared";

// Improving a VSL rewrites the whole script (a couple of minutes); a score is under one.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * The script's score out of 100 (Nov 19 2026; scripts recreated in Nexli's
 * studio), driven by the project page and the batch board:
 * POST { action: "score" }   → scores the current script (once per version of its lines).
 * POST { action: "improve" } → the ONE automatic rewrite, aimed at the points
 *   under 7 of 10 (and any old-offer wording); the new script is then scored
 *   by the next "score" call.
 * Each run is claimed (scriptScore.pending), so two open pages never run it twice.
 * 409 = already running or nothing to do.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  if (!scoreEligible(project)) return NextResponse.json({ error: "Only videos recreated in Nexli's studio are scored." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === "improve" ? "improve" : "score";

  const clips = await clipsOf(project.id);
  const key = scriptKey(clips.map((c) => ({ section: c.section, line: c.line })));
  const prev = project.scriptScore ?? null;
  const step = nextScoreStep({ eligible: true, status: project.status, clips: clips.length, score: prev ? { ...prev, stale: prev.key !== key } : null });
  if (step !== action) {
    return NextResponse.json({ error: action === "improve" ? "Nothing to improve right now." : "This script is already scored.", detail: await projectDetail(project) }, { status: 409 });
  }

  // Claim the run: only when no other run is live (the claim is part of the update's condition).
  const at = new Date().toISOString();
  const claim: ScriptScore = prev
    ? { ...prev, pending: { kind: action, at } }
    : { v: 1, key: "", score: 0, raw: 0, band: "skip", subs: [], caps: [], oldOffer: [], verdict: "", improved: false, before: null, pending: { kind: action, at }, at };
  const claimed = await db
    .update(creativeProjects)
    .set({ scriptScore: claim })
    .where(
      and(
        eq(creativeProjects.id, project.id),
        sql`(${creativeProjects.scriptScore} IS NULL OR ${creativeProjects.scriptScore}->'pending' IS NULL OR ${creativeProjects.scriptScore}->'pending' = 'null'::jsonb OR (${creativeProjects.scriptScore}->'pending'->>'at')::timestamptz < now() - interval '320 seconds')`
      )
    )
    .returning({ id: creativeProjects.id });
  if (claimed.length === 0) return NextResponse.json({ error: "It's already being scored.", detail: await projectDetail(project) }, { status: 409 });

  const release = async (next: ScriptScore | null) => {
    await db.update(creativeProjects).set({ scriptScore: next }).where(eq(creativeProjects.id, project.id));
  };

  try {
    if (action === "score") {
      const score = await scoreScript({
        key,
        title: project.title,
        format: project.format,
        clips: clips.map((c) => ({ section: c.section, line: c.line })),
        evidence: await recreateEvidence(project.ownerId),
        prev,
      });
      await release(score);
    } else {
      const media = await readyMedia(project);
      if ("error" in media) {
        await release(prev);
        return NextResponse.json({ error: media.error }, { status: media.status });
      }
      const result = await reviseScript({
        input: await scriptInputFor(project, "change"),
        frame: project.frameSpec,
        clips: clips.map(clipFieldsOf),
        note: improvementNote(prev as ScriptScore),
      });
      // Approved (or changed) while the rewrite ran: the script on the page wins, the rewrite is dropped.
      const now = await loadProject(access.ownerId, project.id);
      const nowKey = scriptKey((await clipsOf(project.id)).map((c) => ({ section: c.section, line: c.line })));
      if (!now || now.status !== "scripted" || nowKey !== key) {
        await release(now?.scriptScore ? { ...now.scriptScore, pending: null } : null);
        return NextResponse.json({ error: "The script changed while it was being improved, so the improvement was dropped.", detail: now ? await projectDetail(now) : null }, { status: 409 });
      }
      await replaceScript(
        project,
        { frameSpec: result.frame, notes: result.notes, clips: result.clips, rig: result.rig },
        `Before the automatic improvement (scored ${prev?.score ?? "?"}/100)`
      );
      await markMediaWritten(project);
      // The old score stays (now stale): the next "score" shows what it was before.
      await release({ ...(prev as ScriptScore), improved: true, justImproved: true, pending: null });
    }
  } catch (err) {
    console.error(`[creative-studio] script ${action} failed:`, err instanceof Error ? err.message : err);
    await release(prev ? { ...prev, pending: null } : null);
    return NextResponse.json({ error: claudeError(err, action === "score" ? "Scoring the script failed" : "Improving the script failed") }, { status: 502 });
  }

  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
