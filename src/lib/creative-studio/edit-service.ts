import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeEdits,
  creativeProjects,
  type StoredMedia,
  type StoredPip,
  type TranscriptWord,
} from "@/lib/creative-studio/tables";
import type { CaptionWord, EditProps, EditStyle, MediaCue, MediaTrack, PipTrack, PipWindow } from "@/remotion/types";
import type { EditContext } from "@/lib/creative-studio/edit";
import { clipsOf } from "@/lib/creative-studio/service";
import { loadCut } from "@/lib/creative-studio/autocut-service";
import { cutTimelineWords, placeSourceWords, wholeCutWords } from "@/lib/creative-studio/words";
import { mediaItems, sourceMeta, sourceOf } from "@/lib/creative-studio/source";
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

export function editContext(
  project: Project,
  style: EditStyle,
  durationS: number,
  words: CaptionWord[],
  lines: EditContext["lines"],
  /** A reaction video's corner video (Claude keeps graphics clear of it). */
  pip?: StoredPip,
  /** Clips on screen (Claude keeps graphics clear of them). */
  media?: StoredMedia
): EditContext {
  return {
    style,
    format: project.format,
    rig: project.rig,
    durationS,
    direction: project.brief?.direction ?? "",
    positions: project.frameSpec?.positions ?? [],
    lines,
    words,
    ...(pip ? { reaction: { windows: pip.windows.map((w) => ({ start: w.start, end: w.end })), summary: pip.summary ?? "" } } : {}),
    ...(media?.cues.length ? { onscreen: media.cues.map((c) => ({ start: c.start, end: c.end, layout: c.layout, clip: c.clip + 1, ...(c.layout === "window" ? { x: c.box?.x ?? 0.7 } : {}) })) } : {}),
  };
}

/**
 * Clips on screen for a new edit: each line whose clip has one shows it over
 * that line's window on the auto-cut. With none, `note` says why (added to
 * Claude's notes).
 */
export async function mediaTrack(project: Project, lines: EditContext["lines"]): Promise<{ media?: StoredMedia; note: string }> {
  if (project.media?.mode !== "onscreen") return { note: "" };
  if (lines.some((l) => l.start === null || l.end === null)) {
    return { note: " The clips on screen follow the auto-cut's timing, so they aren't added to a final cut you uploaded yourself." };
  }
  const items = await mediaItems(project);
  const missing = items.find((a) => !sourceMeta(a).proxyPath);
  if (missing) throw new Error(sourceMeta(missing).proxyError ?? "A clip on screen is still being prepared. Try again in a minute.");
  const index = new Map(items.map((a, i) => [a.id, i]));
  const clips = await clipsOf(project.id);
  const byNumber = new Map(clips.map((c) => [c.idx + 1, c]));
  const cues: MediaCue[] = [];
  for (const l of lines) {
    const c = byNumber.get(l.number);
    const i = c?.show ? index.get(c.show.mediaId) : undefined;
    if (!c?.show || i === undefined || l.start === null || l.end === null || l.end <= l.start) continue;
    cues.push({ clip: i, start: r3(l.start), end: r3(l.end), from: c.show.from, to: c.show.to, layout: c.show.layout });
  }
  cues.sort((a, b) => a.start - b.start);
  return {
    media: { clips: items.map((a) => ({ mediaId: a.id, aspect: a.width && a.height ? Math.round((a.width / a.height) * 10_000) / 10_000 : 9 / 16 })), cues },
    note: cues.length ? "" : " No line shows a clip, so the clips on screen aren't in this edit.",
  };
}

/** Clips on screen as Remotion takes them: each clip's light copy, freshly signed. */
async function signedMedia(stored: StoredMedia, seconds: number): Promise<MediaTrack> {
  const assets = await Promise.all(
    stored.clips.map(async (c) => (await db.select().from(creativeAssets).where(eq(creativeAssets.id, c.mediaId)).limit(1))[0] ?? null)
  );
  const paths = assets.map((a) => (a ? sourceMeta(a).proxyPath ?? null : null));
  const signed = await signPaths(paths, seconds);
  return {
    clips: stored.clips.map((c, i) => ({ src: (paths[i] && signed.get(paths[i]!)) || "", aspect: c.aspect })),
    cues: stored.cues,
  };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A reaction video's corner video for a new edit: it plays in the watch
 * clips' windows on the auto-cut, its words are placed in them, and the size
 * and caption choice from the last edit carry over. With no corner video,
 * `note` says why (added to Claude's notes).
 */
export async function reactionTrack(project: Project, lines: EditContext["lines"], prev?: StoredPip): Promise<{ pip?: StoredPip; note: string }> {
  if (!project.reaction) return { note: "" };
  const source = await sourceOf(project);
  if (!source) return { note: " The video in the corner is missing, so this edit has none. Upload it again on the video page." };
  const meta = sourceMeta(source);
  if (!meta.proxyPath) throw new Error(meta.proxyError ?? "The video in the corner is still being prepared. Try again in a minute.");
  if (lines.some((l) => l.start === null || l.end === null)) {
    return { note: " The video in the corner follows the auto-cut's timing, so it isn't added to a final cut you uploaded yourself." };
  }
  const clips = await clipsOf(project.id);
  const byNumber = new Map(clips.map((c) => [c.idx + 1, c]));
  const windows: PipWindow[] = [];
  for (const l of lines) {
    const c = byNumber.get(l.number);
    if (c?.kind !== "silent" || !c.watch || l.start === null || l.end === null || l.end <= l.start) continue;
    windows.push({ start: r3(l.start), end: r3(l.end), from: c.watch.from, to: c.watch.to });
  }
  windows.sort((a, b) => a.start - b.start);
  const aspect = source.width && source.height ? source.width / source.height : 9 / 16;
  return {
    pip: {
      sourceId: source.id,
      aspect: Math.round(aspect * 10_000) / 10_000,
      windows,
      size: prev?.size ?? "m",
      // The video's own burned-in captions make a second set noise.
      captions: prev?.captions ?? !meta.captioned,
      words: placeSourceWords(meta.words ?? [], windows),
      ...(meta.summary ? { summary: meta.summary } : {}),
    },
    note: windows.length ? "" : " No clip watches the video, so the corner video stays paused the whole time.",
  };
}

/** The corner video as Remotion takes it: the source's light copy, freshly signed. */
async function signedPip(stored: StoredPip, seconds: number): Promise<PipTrack> {
  const [source] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, stored.sourceId)).limit(1);
  const path = source ? sourceMeta(source).proxyPath : undefined;
  const src = path ? (await signPaths([path], seconds)).get(path) : undefined;
  if (!src) throw new Error("The video in the corner is missing, so this edit can't render. Pick the style again to make the edit without it.");
  const { sourceId: _id, summary: _summary, ...track } = stored;
  void _id;
  void _summary;
  return { ...track, src };
}

/** The full Remotion props for an edit, with a fresh signed URL for its cut (and its corner video). */
export async function renderProps(edit: Edit, seconds: number): Promise<EditProps> {
  const [cut] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, edit.finalCutAssetId)).limit(1);
  if (!cut?.storagePath) throw new Error("The final cut for this edit is missing");
  const videoUrl = (await signPaths([cut.storagePath], seconds)).get(cut.storagePath);
  if (!videoUrl) throw new Error("Couldn't sign the final cut for the render");
  const { pip: stored, media: storedMedia, ...props } = edit.props;
  const pip = stored ? await signedPip(stored, seconds) : undefined;
  const media = storedMedia ? await signedMedia(storedMedia, seconds) : undefined;
  return { style: edit.style, videoUrl, ...props, ...(pip ? { pip } : {}), ...(media ? { media } : {}) };
}
