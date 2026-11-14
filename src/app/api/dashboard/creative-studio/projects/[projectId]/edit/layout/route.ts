import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import type { EditLayout, MediaLayout, MovableSlot, PipSize } from "@/remotion/types";
import { cleanBox } from "@/remotion/media-box";

type Ctx = { params: Promise<{ projectId: string }> };

const SLOTS: MovableSlot[] = ["title", "qualifier", "cta", "captions", "stickers", "cards", "pip"];
const PIP_SIZES: PipSize[] = ["s", "m", "l"];
const MEDIA_LAYOUTS: MediaLayout[] = ["window", "full", "split", "corner"];
const LAYOUT_NAME: Record<MediaLayout, string> = { window: "in a 9:16 window", full: "full screen", split: "split screen", corner: "you in the corner" };
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Save where things sit on screen, placed by tapping on the preview.
 * POST { layout: { title: { x, y }, captions: … } } — fractions of the frame,
 * a missing slot = the style's default spot. A reaction video's corner
 * video also takes { pip: { size, captions } }; clips on screen take
 * { media: [{ index, layout, box?, fit? }] } (how that cue shows; a 9:16
 * window also takes where it sits and how big, and fill or fit). Saved as a new version (no
 * Claude call), so "Undo last change" puts the old spots back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as {
    layout?: Record<string, unknown>;
    pip?: { size?: unknown; captions?: unknown };
    media?: { index?: unknown; layout?: unknown; box?: unknown; fit?: unknown }[];
  } | null;
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });

  const layout: EditLayout = {};
  for (const slot of SLOTS) {
    const v = body?.layout?.[slot] as { x?: unknown; y?: unknown } | undefined;
    if (!v || typeof v.x !== "number" || typeof v.y !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
    layout[slot] = { x: r4(Math.min(1, Math.max(0, v.x))), y: r4(Math.min(1, Math.max(0, v.y))) };
  }
  const moved = SLOTS.filter((s) => JSON.stringify(layout[s]) !== JSON.stringify(edit.props.overlays.layout?.[s]));
  // The corner video's size and captions (a reaction video only).
  let pip = edit.props.pip;
  const pipChanges: string[] = [];
  if (pip && body?.pip) {
    const size = PIP_SIZES.includes(body.pip.size as PipSize) ? (body.pip.size as PipSize) : pip.size ?? "m";
    const captions = typeof body.pip.captions === "boolean" ? body.pip.captions : pip.captions !== false;
    if (size !== (pip.size ?? "m")) pipChanges.push(`size ${size.toUpperCase()}`);
    if (captions !== (pip.captions !== false)) pipChanges.push(captions ? "its captions on" : "its captions off");
    pip = { ...pip, size, captions };
  }
  // Clips on screen: how each cue shows.
  let media = edit.props.media;
  const mediaChanges: string[] = [];
  if (media && Array.isArray(body?.media)) {
    const vertical = edit.props.format !== "vsl_16x9";
    const cues = [...media.cues];
    for (const m of body.media) {
      const i = typeof m?.index === "number" ? Math.round(m.index) : -1;
      if (!cues[i]) continue;
      const layout = MEDIA_LAYOUTS.includes(m?.layout as MediaLayout) ? (m.layout as MediaLayout) : cues[i].layout;
      const before = JSON.stringify(cues[i]);
      const next = { ...cues[i], layout };
      if (layout === "window") {
        if (m?.box && typeof m.box === "object") next.box = cleanBox(m.box as Record<string, number>, vertical);
        if (m?.fit === "fill" || m?.fit === "fit") next.fit = m.fit;
      }
      if (JSON.stringify(next) === before) continue;
      cues[i] = next;
      const resized = layout === "window" && layout === JSON.parse(before).layout;
      mediaChanges.push(`clip ${next.clip + 1} at ${next.start.toFixed(1)}s ${resized ? "window moved or resized" : LAYOUT_NAME[layout]}`);
    }
    media = { ...media, cues };
  }
  if (moved.length === 0 && pipChanges.length === 0 && mediaChanges.length === 0) return NextResponse.json(await projectDetail(project));
  const notes = [
    moved.length ? `Moved by hand: ${moved.map((m) => (m === "pip" ? "corner video" : m)).join(", ")}.` : "",
    pipChanges.length ? `Corner video: ${pipChanges.join(", ")}.` : "",
    mediaChanges.length ? `On screen: ${mediaChanges.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { layout: _old, ...rest } = edit.props.overlays;
  void _old;
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays: Object.keys(layout).length ? { ...rest, layout } : rest, ...(pip ? { pip } : {}), ...(media ? { media } : {}) },
    notes,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
