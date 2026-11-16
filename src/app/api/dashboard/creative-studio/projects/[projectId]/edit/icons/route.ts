import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { canHaveFx, cleanFx, getFx, parseTarget, setFx } from "@/lib/creative-studio/edit-text";
import { ICON_INFO } from "@/remotion/components/fx-icons";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Animated icons with one text box (stars, dollar signs…): around the card
 * or a shower over the video while it pops in. POST { target, fx: { icon,
 * motion } | null }; null takes them off. Saved as a new version with no
 * Claude call, so "Undo last change" puts it back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { target?: unknown; fx?: unknown } | null;
  const target = parseTarget(body?.target);
  if (!target || !canHaveFx(target)) return NextResponse.json({ error: "Icons go on the title, qualifier, CTA, stickers or cards" }, { status: 400 });
  const fx = cleanFx(body?.fx);
  if (body?.fx && !fx) return NextResponse.json({ error: "Unknown icon" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });
  const overlays = setFx(edit.props.overlays, target, fx);
  if (!overlays) return NextResponse.json({ error: "That text isn't in this edit anymore" }, { status: 409 });
  if (JSON.stringify(getFx(edit.props.overlays, target)) === JSON.stringify(fx)) return NextResponse.json(await projectDetail(project));

  const what = target.slot === "card" ? `card ${target.index + 1}` : target.slot === "sticker" ? `sticker ${target.index + 1}` : `the ${target.slot}`;
  const how = fx ? `${ICON_INFO[fx.icon].label} ${fx.motion === "rain" ? "showering over the video" : "around"} ${what}.` : `No more icons on ${what}.`;
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays },
    notes: how.charAt(0).toUpperCase() + how.slice(1),
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
