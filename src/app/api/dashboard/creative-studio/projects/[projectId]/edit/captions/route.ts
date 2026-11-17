import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { captionWords, finalCutFor, latestEdit } from "@/lib/creative-studio/edit-service";
import { replaceCaptionWords } from "@/lib/creative-studio/words";
import { STYLE_LABEL } from "@/lib/creative-studio/edit-styles";
import type { CaptionStyle, EditStyle } from "@/remotion/types";

// Turning captions on can transcribe the whole cut (Scribe).
export const maxDuration = 300;

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
 * words; POST { on } switches the captions on or off (on with no caption
 * words makes them from the cut first). Each save is a new version (no
 * Claude call), so undo works.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { style?: unknown; words?: { from?: unknown; to?: unknown; text?: unknown }; on?: unknown } | null;
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });

  let props = edit.props;
  let notes: string;
  let editStyle: EditStyle = edit.style;
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
  } else if (typeof body?.on === "boolean") {
    const on = body.on;
    let words = props.words;
    if (on && words.length === 0) {
      const finalCut = await finalCutFor(project.id, edit.finalCutAssetId);
      if (!finalCut) return NextResponse.json({ error: "The final cut for this edit is missing" }, { status: 400 });
      try {
        words = (await captionWords(project, finalCut, true)).words;
      } catch (err) {
        console.error("[creative-studio] making captions failed:", err instanceof Error ? err.message : err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Making the captions failed" }, { status: 500 });
      }
    }
    // Solo, VSL and Ladder always run captions and POV never does; the other way round needs the custom composition.
    if (editStyle !== "custom" && on !== (editStyle !== "pov")) editStyle = "custom";
    const { captions: _was, ...rest } = props.overlays;
    void _was;
    props = { ...props, words, overlays: editStyle === "custom" ? { ...rest, captions: on } : rest };
    // A switched edit says what it is, so "put this edit on the new cut" can rebuild it.
    if (editStyle !== edit.style && !props.instruction) {
      props = { ...props, instruction: `The ${STYLE_LABEL[edit.style]} style's graphics, with captions ${on ? "on" : "off"}.` };
    }
    notes = `${on ? `Captions on (${words.length} words).` : "Captions off."}${editStyle !== edit.style ? " Switched to “Your way” so the edit can include that." : ""}`;
  } else {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: editStyle,
    finalCutAssetId: edit.finalCutAssetId,
    props,
    notes,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
