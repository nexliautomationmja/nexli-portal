import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { parseTarget, setText } from "@/lib/creative-studio/edit-text";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Change one piece of on-screen text by hand — the user's own words or a
 * version Claude suggested. POST { target, text }. Saved as a new version
 * (no layout call), so "Undo last change" brings the old text back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { target?: unknown; text?: unknown } | null;
  const target = parseTarget(body?.target);
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!target) return NextResponse.json({ error: "Unknown text to change" }, { status: 400 });
  if (!text && !(target.slot === "card" && target.field === "sub")) return NextResponse.json({ error: "Type the new text" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });
  const overlays = setText(edit.props.overlays, target, text);
  if (!overlays) return NextResponse.json({ error: "That text isn't in this edit anymore" }, { status: 409 });

  const label = target.slot === "rung" ? `ladder ${target.field}` : target.slot === "card" && target.field === "sub" ? "card's second line" : target.slot;
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays },
    notes: `Changed the ${label} to “${text}”.`,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
