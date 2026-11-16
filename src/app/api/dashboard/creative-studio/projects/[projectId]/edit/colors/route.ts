import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { cleanColors, getColors, parseTarget, setColors } from "@/lib/creative-studio/edit-text";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Pick the colours of one text box by hand: the card and its words.
 * POST { target, colors: { bg?, text? } } as #RRGGBB; leaving one out puts
 * that colour back to the rulebook's. Saved as a new version with no Claude
 * call, so "Undo last change" puts it back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { target?: unknown; colors?: unknown } | null;
  const target = parseTarget(body?.target);
  if (!target) return NextResponse.json({ error: "Unknown text to color" }, { status: 400 });
  const colors = cleanColors(body?.colors);
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });
  const overlays = setColors(edit.props.overlays, target, colors);
  if (!overlays) return NextResponse.json({ error: "That text isn't in this edit anymore" }, { status: 409 });
  const before = getColors(edit.props.overlays, target);
  if (before.bg === colors.bg && before.text === colors.text) return NextResponse.json(await projectDetail(project));

  const what =
    target.slot === "rung" ? `ladder ${target.field}` : target.slot === "card" ? `card ${target.index + 1}` : target.slot === "sticker" ? `sticker ${target.index + 1}` : target.slot;
  const picked = [colors.bg ? `card ${colors.bg}` : null, colors.text ? `text ${colors.text}` : null].filter(Boolean).join(", ");
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays },
    notes: picked ? `Colors for the ${what} set by hand: ${picked}.` : `The ${what} is back to the Nexli colors.`,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
