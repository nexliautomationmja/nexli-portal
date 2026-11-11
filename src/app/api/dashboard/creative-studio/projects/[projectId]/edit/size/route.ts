import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { SIZE_MAX, SIZE_MIN, type SizeSlot } from "@/remotion/types";

type Ctx = { params: Promise<{ projectId: string }> };

const SLOTS: SizeSlot[] = ["title", "qualifier", "cta", "stickers", "cards"];
const LABEL: Record<SizeSlot, string> = { title: "Title", qualifier: "Qualifier", cta: "CTA", stickers: "Stickers", cards: "Cards" };

/**
 * Make a text element bigger or smaller by hand, like Instagram's text size:
 * the whole box scales. POST { slot, scale } (1 = the rulebook size). Saved
 * as a new version with no Claude call, so "Undo last change" puts it back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { slot?: unknown; scale?: unknown } | null;
  const slot = SLOTS.find((s) => s === body?.slot);
  const raw = typeof body?.scale === "number" && Number.isFinite(body.scale) ? body.scale : null;
  if (!slot || raw === null) return NextResponse.json({ error: "Pick the text and its size" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });

  const scale = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, raw)) * 100) / 100;
  const current = edit.props.overlays.sizes?.[slot] ?? 1;
  if (Math.abs(current - scale) < 0.005) return NextResponse.json(await projectDetail(project));
  const others = { ...(edit.props.overlays.sizes ?? {}) };
  delete others[slot];
  const sizes = scale === 1 ? others : { ...others, [slot]: scale };
  const { sizes: _prev, ...rest } = edit.props.overlays;
  void _prev;
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays: Object.keys(sizes).length ? { ...rest, sizes } : rest },
    notes: `${LABEL[slot]} size set to ${Math.round(scale * 100)}% by hand.`,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
