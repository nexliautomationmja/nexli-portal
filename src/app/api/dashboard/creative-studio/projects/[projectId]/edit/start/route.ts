import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { proposeLayout } from "@/lib/creative-studio/edit";
import { isEditStyle } from "@/lib/creative-studio/edit-styles";
import { captionWords, durationOf, editContext, finalCutFor, latestEdit } from "@/lib/creative-studio/edit-service";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Start (or restyle) the edit: caption words on the final cut's timeline,
 * then Claude lays out the chosen style's graphics. Every call is a new
 * version; caption fixes carry over while the final cut stays the same.
 * POST { style, finalCutId?, durationS? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { style?: unknown; finalCutId?: unknown; durationS?: unknown } | null;
  if (!isEditStyle(body?.style)) return NextResponse.json({ error: "Pick one of the four styles" }, { status: 400 });
  const style = body.style;

  const finalCut = await finalCutFor(project.id, body.finalCutId);
  if (!finalCut) return NextResponse.json({ error: "Approve the auto-cut or upload your final cut first." }, { status: 400 });
  const prev = await latestEdit(project.id);
  if (prev?.status === "rendering") return NextResponse.json({ error: "Wait for the current render to finish." }, { status: 409 });

  try {
    const built = await captionWords(project, finalCut);
    const words = prev && prev.finalCutAssetId === finalCut.id ? prev.props.words : built.words;
    const durationS = await durationOf(finalCut, body.durationS, words);
    const result = await proposeLayout(editContext(project, style, durationS, words, built.lines));
    const unaligned = built.unaligned.length
      ? ` Captions for clip ${built.unaligned.join(", ")} use what Scribe heard rather than the script's spelling, so give them a read.`
      : "";
    await db.insert(creativeEdits).values({
      projectId: project.id,
      version: (prev?.version ?? 0) + 1,
      style,
      finalCutAssetId: finalCut.id,
      props: { format: project.format, durationS, words, overlays: result.overlays },
      notes: `${result.notes}${unaligned}`.trim() || null,
      note: null,
    });
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    console.error("[creative-studio] edit start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Building the edit failed") }, { status: 500 });
  }
}
