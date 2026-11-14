import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { proposeLayout } from "@/lib/creative-studio/edit";
import { isEditStyle } from "@/lib/creative-studio/edit-styles";
import { captionWords, durationOf, editContext, finalCutFor, latestEdit, reactionTrack, mediaTrack } from "@/lib/creative-studio/edit-service";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Start (or restyle) the edit: caption words on the final cut's timeline,
 * then Claude lays out the chosen style's graphics — or, for "custom", the
 * edit the user described in their own words. Every call is a new version;
 * caption fixes carry over while the final cut stays the same.
 * POST { style, instruction?, finalCutId?, durationS? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { style?: unknown; instruction?: unknown; finalCutId?: unknown; durationS?: unknown; keepLook?: unknown } | null;
  if (!isEditStyle(body?.style)) return NextResponse.json({ error: "Pick a style or describe the edit" }, { status: 400 });
  const style = body.style;
  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 4000) : "";
  if (style === "custom" && !instruction) return NextResponse.json({ error: "Describe how you want it edited" }, { status: 400 });

  const finalCut = await finalCutFor(project.id, body.finalCutId);
  if (!finalCut) return NextResponse.json({ error: "Approve the auto-cut or upload your final cut first." }, { status: 400 });
  const prev = await latestEdit(project.id);
  if (prev?.status === "rendering") return NextResponse.json({ error: "Wait for the current render to finish." }, { status: 409 });

  try {
    const built = await captionWords(project, finalCut);
    const sameCut = prev && prev.finalCutAssetId === finalCut.id;
    const words = sameCut ? prev.props.words : built.words;
    // Spots placed by hand (title clear of her face…) carry over to a new style on the same cut,
    // and to a new cut when asked ("put this edit on the new cut": same frame, same spots).
    const keep = sameCut || (body?.keepLook === true && prev);
    const layout = keep ? prev.props.overlays.layout : undefined;
    const captionStyle = keep ? prev.props.overlays.captionStyle : undefined;
    const sizes = keep ? prev.props.overlays.sizes : undefined;
    const durationS = await durationOf(finalCut, body.durationS, words);
    // A reaction video: the video she reacts to, in the corner (its size and captions carry over on the same cut).
    const reaction = await reactionTrack(project, built.lines, keep ? prev.props.pip : undefined);
    // Clips on screen: shown over their lines (how a cue shows, and a window's spot and size, carry over on the same cut).
    const onscreen = await mediaTrack(project, built.lines);
    if (onscreen.media && keep && prev.props.media) {
      const before = prev.props.media;
      onscreen.media.cues = onscreen.media.cues.map((c) => {
        const id = onscreen.media!.clips[c.clip]?.mediaId;
        const old = before.cues.find((o) => Math.abs(o.start - c.start) < 0.05 && before.clips[o.clip]?.mediaId === id);
        return old ? { ...c, layout: old.layout, ...(old.box ? { box: old.box } : {}), ...(old.fit ? { fit: old.fit } : {}) } : c;
      });
    }
    const result = await proposeLayout({
      ...editContext(project, style, durationS, words, built.lines, reaction.pip, onscreen.media),
      instruction: instruction || undefined,
      firm: firmBrief(await studioById(access.ownerId, project.studioId)),
    });
    const unaligned = built.unaligned.length
      ? ` Captions for clip ${built.unaligned.join(", ")} use what Scribe heard rather than the script's spelling, so give them a read.`
      : "";
    await db.insert(creativeEdits).values({
      projectId: project.id,
      version: (prev?.version ?? 0) + 1,
      style,
      finalCutAssetId: finalCut.id,
      props: {
        format: project.format,
        durationS,
        words,
        overlays: { ...result.overlays, ...(layout ? { layout } : {}), ...(captionStyle ? { captionStyle } : {}), ...(sizes ? { sizes } : {}) },
        ...(instruction ? { instruction } : {}),
        ...(reaction.pip ? { pip: reaction.pip } : {}),
        ...(onscreen.media ? { media: onscreen.media } : {}),
      },
      notes: `${result.notes}${unaligned}${reaction.note}${onscreen.note}`.trim() || null,
      note: instruction || null,
    });
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    console.error("[creative-studio] edit start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Building the edit failed") }, { status: 500 });
  }
}
