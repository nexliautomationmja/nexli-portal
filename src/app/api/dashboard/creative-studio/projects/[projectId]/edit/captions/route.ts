import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { replaceCaptionWords } from "@/lib/creative-studio/words";
import type { CaptionStyle } from "@/remotion/types";

type Ctx = { params: Promise<{ projectId: string }> };

/** Only known fields with known values; anything else is dropped. */
function cleanStyle(v: unknown): CaptionStyle | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  const out: CaptionStyle = {};
  if (x.perLine === 1 || x.perLine === 2 || x.perLine === 3 || x.perLine === 4) out.perLine = x.perLine;
  if (typeof x.scale === "number" && Number.isFinite(x.scale)) out.scale = Math.round(Math.min(1.8, Math.max(0.6, x.scale)) * 100) / 100;
  if (x.case === "caps" || x.case === "title" || x.case === "lower") out.case = x.case;
  if (x.highlight === "gradient" || x.highlight === "green" || x.highlight === "yellow" || x.highlight === "none") out.highlight = x.highlight;
  if (x.box === true) out.box = true;
  if (x.font === "outfit" || x.font === "jakarta") out.font = x.font;
  return Object.keys(out).length ? out : null;
}

/**
 * Captions by hand. POST { style } sets the look (null = back to the
 * rulebook's captions); POST { words: { from, to, text } } retypes those
 * words. Each save is a new version (no Claude call), so undo works.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { style?: unknown; words?: { from?: unknown; to?: unknown; text?: unknown } } | null;
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });

  let props = edit.props;
  let notes: string;
  if (body && "style" in body) {
    const style = cleanStyle(body.style);
    const { captionStyle: _old, ...rest } = props.overlays;
    void _old;
    props = { ...props, overlays: style ? { ...rest, captionStyle: style } : rest };
    notes = style ? "Changed how the captions look." : "Captions back to the rulebook look.";
  } else if (body?.words) {
    const { from, to, text } = body.words;
    if (typeof from !== "number" || typeof to !== "number" || typeof text !== "string" || !Number.isInteger(from) || !Number.isInteger(to)) {
      return NextResponse.json({ error: "Say which caption words to change" }, { status: 400 });
    }
    try {
      const words = replaceCaptionWords(props.words, from, to, text.slice(0, 300));
      props = { ...props, words };
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Those caption words couldn't be changed" }, { status: 400 });
    }
    notes = text.trim() ? `Caption changed to “${text.trim()}”.` : "Removed caption words.";
  } else {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props,
    notes,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
