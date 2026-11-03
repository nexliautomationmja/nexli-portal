import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { reviseLayout } from "@/lib/creative-studio/edit";
import { applySwaps } from "@/lib/creative-studio/words";
import { captionWords, editContext, finalCutFor, latestEdit } from "@/lib/creative-studio/edit-service";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** Change the edit in plain words ("shorter title", "qualifier at 0:03", "the caption should say CALENDAR"). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
  if (!note) return NextResponse.json({ error: "Say what to change" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });
  const finalCut = await finalCutFor(project.id, edit.finalCutAssetId);
  if (!finalCut) return NextResponse.json({ error: "The final cut for this edit is missing" }, { status: 400 });

  try {
    const { lines } = await captionWords(project, finalCut);
    const ctx = editContext(project, edit.style, edit.props.durationS, edit.props.words, lines);
    const result = await reviseLayout(ctx, edit.props.overlays, note);
    let words = edit.props.words;
    let fixed = "";
    if (result.swaps.length) {
      const swapped = applySwaps(words, result.swaps);
      words = swapped.words;
      fixed = swapped.applied
        ? ` Caption fix: ${result.swaps.map((s) => `${s.find} → ${s.replace}`).join(", ")}.`
        : ` I couldn't find "${result.swaps[0].find}" in the captions.`;
    }
    await db.insert(creativeEdits).values({
      projectId: project.id,
      version: edit.version + 1,
      style: edit.style,
      finalCutAssetId: edit.finalCutAssetId,
      props: { ...edit.props, words, overlays: result.overlays },
      notes: `${result.notes}${fixed}`.trim() || null,
      note,
    });
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    console.error("[creative-studio] edit revise failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Changing the edit failed") }, { status: 500 });
  }
}
