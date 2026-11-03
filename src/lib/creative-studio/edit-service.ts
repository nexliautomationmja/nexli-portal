import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeEdits,
  creativeProjects,
  type TranscriptWord,
} from "@/lib/creative-studio/tables";
import type { CaptionWord, EditProps, EditStyle } from "@/remotion/types";
import type { EditContext } from "@/lib/creative-studio/edit";
import { clipsOf } from "@/lib/creative-studio/service";
import { loadCut } from "@/lib/creative-studio/autocut-service";
import { cutTimelineWords, wholeCutWords } from "@/lib/creative-studio/words";
import { transcribeUrl } from "@/lib/creative-studio/transcribe";
import { readStorage } from "@/lib/creative-studio/frames";
import { signPaths } from "@/lib/creative-studio/storage";

type Project = typeof creativeProjects.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;
type Edit = typeof creativeEdits.$inferSelect;

export async function latestEdit(projectId: string): Promise<Edit | null> {
  const [edit] = await db
    .select()
    .from(creativeEdits)
    .where(eq(creativeEdits.projectId, projectId))
    .orderBy(desc(creativeEdits.version))
    .limit(1);
  return edit ?? null;
}

/** The final cut to edit: the one asked for, else the newest. */
export async function finalCutFor(projectId: string, id?: unknown): Promise<Asset | null> {
  const byId = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
  const [asset] = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.projectId, projectId),
        eq(creativeAssets.kind, "final_cut"),
        ...(byId ? [eq(creativeAssets.id, id as string)] : [])
      )
    )
    .orderBy(desc(creativeAssets.createdAt))
    .limit(1);
  return asset ?? null;
}

type FinalCutMeta = { fromCutId?: string; words?: TranscriptWord[]; durationS?: number };

/**
 * Caption words on the final cut's timeline plus the script lines for
 * Claude. An approved auto-cut maps each clip's word timings through its
 * kept segments (no new transcription); an uploaded cut is transcribed once
 * by Scribe and the words are kept on the asset.
 */
export async function captionWords(
  project: Project,
  finalCut: Asset
): Promise<{ words: CaptionWord[]; lines: EditContext["lines"]; unaligned: number[] }> {
  const meta = (finalCut.metadata ?? {}) as FinalCutMeta;
  const clips = await clipsOf(project.id);

  if (meta.fromCutId) {
    const cut = await loadCut(project.id, meta.fromCutId);
    const rows = cut ? clips.map((c) => ({ c, e: cut.plan.find((p) => p.clipId === c.id) })) : [];
    const usable = cut && rows.length > 0 && rows.every(({ c, e }) => e && c.transcript && c.transcript.version === e.version);
    if (cut && usable) {
      const speed = cut.settings.speed;
      const { words, unaligned } = cutTimelineWords(
        rows.map(({ c, e }) => ({ line: c.line, words: c.transcript!.words, segments: e!.segments })),
        speed
      );
      let t = 0;
      const lines = rows.map(({ c, e }) => {
        const start = t;
        t += e!.keptS / speed;
        return { number: c.idx + 1, section: c.section, speaker: c.speaker, line: c.line, start, end: t };
      });
      return { words, lines, unaligned };
    }
  }

  let heard = meta.words;
  if (!heard) {
    const path = finalCut.storagePath;
    if (!path) throw new Error("The final cut's video is missing");
    const url = (await signPaths([path], 3600)).get(path);
    if (!url) throw new Error("Couldn't read the final cut from storage");
    heard = (await transcribeUrl(url, () => readStorage(path))).words;
    await db
      .update(creativeAssets)
      .set({ metadata: { ...(finalCut.metadata ?? {}), words: heard } })
      .where(eq(creativeAssets.id, finalCut.id));
  }
  if (heard.length === 0) throw new Error("No speech was found in the final cut, so there's nothing to caption.");
  const lines = clips.map((c) => ({ number: c.idx + 1, section: c.section, speaker: c.speaker, line: c.line, start: null, end: null }));
  return { words: wholeCutWords(heard), lines, unaligned: [] };
}

/** The cut's length: stored on the asset, else what the browser measured, else the last word. */
export async function durationOf(finalCut: Asset, hint: unknown, words: CaptionWord[]): Promise<number> {
  if (finalCut.durationMs && finalCut.durationMs > 0) return finalCut.durationMs / 1000;
  const meta = (finalCut.metadata ?? {}) as FinalCutMeta;
  if (meta.durationS && meta.durationS > 0) return meta.durationS;
  const h = typeof hint === "number" && Number.isFinite(hint) && hint > 0.5 && hint < 3600 ? Math.round(hint * 1000) / 1000 : null;
  if (h) {
    await db.update(creativeAssets).set({ durationMs: Math.round(h * 1000) }).where(eq(creativeAssets.id, finalCut.id));
    return h;
  }
  const last = words[words.length - 1];
  return last ? last.end + 0.5 : 1;
}

export function editContext(project: Project, style: EditStyle, durationS: number, words: CaptionWord[], lines: EditContext["lines"]): EditContext {
  return {
    style,
    format: project.format,
    rig: project.rig,
    durationS,
    direction: project.brief?.direction ?? "",
    positions: project.frameSpec?.positions ?? [],
    lines,
    words,
  };
}

/** The full Remotion props for an edit, with a fresh signed URL for its cut. */
export async function renderProps(edit: Edit, seconds: number): Promise<EditProps> {
  const [cut] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, edit.finalCutAssetId)).limit(1);
  if (!cut?.storagePath) throw new Error("The final cut for this edit is missing");
  const videoUrl = (await signPaths([cut.storagePath], seconds)).get(cut.storagePath);
  if (!videoUrl) throw new Error("Couldn't sign the final cut for the render");
  return { style: edit.style, videoUrl, ...edit.props };
}
