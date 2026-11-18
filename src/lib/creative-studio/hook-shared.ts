import type { ClipFields, CutOverride, CutSettings, FrameSpec, ManualTrim, TimeCut } from "@/lib/creative-studio/tables";
import { describedFor } from "@/lib/creative-studio/remake-shared";
import type { EditOverlays, EditStyle } from "@/remotion/types";

/**
 * Hook Tester (Nov 2026), the parts the browser and the server share. A hook
 * test takes one video (made here, or dropped in) and gives the three hooks
 * most worth testing against the one it has. For a video made here, Kling
 * makes only the hook clip; the pick becomes a new video that reuses the
 * rest of the original's clips.
 */

export const HOOK_KINDS = {
  pain: "Pain called out",
  stat: "Number or stat",
  belief: "Belief, then broken",
  question: "Question",
  story: "Short story",
  bold_claim: "Bold claim",
  curiosity: "Curiosity gap",
  pattern_interrupt: "Pattern interrupt",
} as const;
export type HookKind = keyof typeof HOOK_KINDS;
export const HOOK_KIND_IDS = Object.keys(HOOK_KINDS) as HookKind[];

/** Kling charges about this per second of clip (same figure the script page uses). */
export const HOOK_CREDITS_PER_SECOND = 12;
export const HOOK_UPLOAD_MAX_BYTES = 300 * 1024 * 1024;
export const HOOK_UPLOAD_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };
/** A hook line is one Kling clip: about 22 words, 12 seconds at most. */
export const HOOK_MAX_WORDS = 26;

/** One hook Claude proposes (and, once made, where its clip and its video are). */
export interface HookIdea {
  id: string;
  /** 1 = the best bet. */
  rank: number;
  kind: HookKind;
  /** What the presenter says, written the way the framework wants lines written. */
  line: string;
  register: string;
  action: string;
  cues: string;
  editNote: string;
  /** The on-screen title that would go with it (36 characters or fewer). */
  title: string;
  /** Why it's worth testing against the current hook. */
  why: string;
  /** What Claude leaned on, as short labels (one of his ads with its 3-second view rate, a long-running ad in the niche). */
  evidence: string[];
  /** The video made with this hook, once there is one. */
  projectId?: string | null;
}

/** Claude's read of the video before it writes anything. */
export interface HookRead {
  summary: string;
  /** What the hook now does and its main weakness, bluntly. */
  currentHook: string;
  /** The current hook's words. */
  said: string;
  kind: HookKind | "none";
  /** A video made here: how many clips at the start are the hook (the new clip replaces them). */
  replaces: number;
  /** A dropped-in video: where its hook ends, in seconds. */
  hookEndS: number | null;
  notes: string;
}

/** What the hooks were judged against. */
export interface HookBasis {
  /** His own ads that ran long enough to judge. */
  judged: number;
  /** Long-running ads in the niche (Ad Library research). */
  market: number;
  researchAgeDays: number | null;
  /** Ref → a short label for the page ("A3" → "Volume trap v2 · 34% watched 3 s · winner"). */
  refs: Record<string, string>;
}

export type HookTestStatus = "new" | "reading" | "ready" | "failed";
export type HookTakeStatus = "draft" | "rendering" | "done" | "failed" | "blocked";

/** Where a video made from a hook test came from (creative_projects.hook_of). */
export interface HookOrigin {
  testId: string;
  /** The original video (null when the hook came from a dropped-in video). */
  projectId: string | null;
  title: string;
  hookId: string;
  line: string;
  /** How many of the original's opening clips the new hook replaced. */
  replaced: number;
  /** The original's trims on the clips that were reused, by the new clip ids (the first auto-cut starts from them). */
  cut?: {
    settings: CutSettings;
    entries: Record<string, { version: number; overrides: CutOverride[]; manual: ManualTrim | null; sections: TimeCut[] }>;
  } | null;
  /** The original's edit: its style and look, to put on the new cut in one tap. */
  look?: {
    style: EditStyle;
    instruction?: string;
    overlays: EditOverlays;
  } | null;
}

export interface HookTakeView {
  status: HookTakeStatus;
  videoUrl: string | null;
  error: string | null;
  durationS: number;
}

export interface HookIdeaView extends HookIdea {
  /** Seconds Kling will make, and what that costs. */
  durationS: number;
  credits: number;
  take: HookTakeView | null;
  video: { id: string; title: string } | null;
}

export interface HookTestView {
  id: string;
  title: string;
  source: "project" | "upload";
  status: HookTestStatus;
  error: string | null;
  note: string | null;
  createdAt: string;
  video: { url: string | null; vertical: boolean; durationS: number | null };
  /** The video it was made from (a video made here); null for a dropped-in one. */
  project: { id: string; title: string; exists: boolean; ready: boolean; /** The frame the hook clips are made from (the original hook's own). */ frameUrl: string | null } | null;
  read: HookRead | null;
  basis: HookBasis | null;
  hooks: HookIdeaView[];
  /** The opening clips the new hook replaces, and the line it has to lead into. */
  replacing: { lines: string[]; next: string | null } | null;
}

export interface HookTestRow {
  id: string;
  title: string;
  source: "project" | "upload";
  status: HookTestStatus;
  hooks: number;
  made: number;
  thumbUrl: string | null;
  createdAt: string;
}

export const wordCountOf = (line: string) => line.trim().split(/\s+/).filter(Boolean).length;

/** Fields of the hook clip: the original opening clip's setup (who speaks, the scene, the listeners) with the new words. */
export function hookClipFields(first: ClipFields, idea: Pick<HookIdea, "line" | "register" | "action" | "cues" | "editNote">): ClipFields {
  return {
    section: "Hook",
    speaker: first.speaker ?? null,
    line: idea.line,
    register: idea.register,
    action: idea.action,
    editNote: idea.editNote,
    cues: idea.cues,
    listenerReactions: first.listenerReactions ?? [],
    kind: first.kind && first.kind !== "silent" ? first.kind : "to_camera",
    frameId: first.frameId ?? null,
  };
}

/**
 * The frame a new hook clip is made from: the one the original's hook clip
 * was actually made from, so the new clip matches the clips it sits next to.
 * `frameIds` = the video's frames, opening frame first.
 *
 * If the video's frame was changed since and its clips weren't re-made, that
 * is still the OLD frame (the one the kept clips show) — unless the script's
 * description has already been rewritten for the new frame, where the old
 * picture would no longer match the words Kling is given.
 */
export function hookFrameId(first: { frameAssetId: string | null; takeFrameId: string | null }, frameIds: string[], frameSpec: FrameSpec | null): string | null {
  const current = (first.frameAssetId && frameIds.includes(first.frameAssetId) ? first.frameAssetId : null) ?? frameIds[0] ?? null;
  const madeFrom = first.takeFrameId && frameIds.includes(first.takeFrameId) ? first.takeFrameId : null;
  if (!madeFrom || madeFrom === current) return current;
  return current && describedFor(frameSpec, current) ? current : madeFrom;
}

/** How many opening clips read as the hook, from their section names (at least 1, never the whole video). */
export function hookSpan(sections: string[], claude?: number | null): number {
  const max = Math.max(1, Math.min(3, sections.length - 1));
  if (claude && Number.isInteger(claude) && claude >= 1) return Math.min(max, claude);
  let n = 0;
  while (n < sections.length && /hook/i.test(sections[n] ?? "")) n++;
  return Math.max(1, Math.min(max, n || 1));
}

/** "Volume trap" + the hook's on-screen title → the new video's name ("Volume trap · The $240K ceiling"). */
export function hookVideoTitle(title: string, label: string, n: number): string {
  const base = title.split(" · ")[0].trim() || "Untitled video";
  return `${base.slice(0, 120)} · ${label.trim().slice(0, 60) || `hook ${n}`}`;
}

/**
 * Deep copy with ids and storage paths rewritten: any string that is a key
 * of `ids` becomes its value, and any string under `fromPrefix` moves under
 * `toPrefix` (each such path is reported through `onPath`, so the file can
 * be copied). Everything else is returned as it was.
 */
export function remapDeep<T>(value: T, ids: Map<string, string>, fromPrefix: string, toPrefix: string, onPath?: (from: string, to: string) => void): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const id = ids.get(v);
      if (id) return id;
      if (v.startsWith(fromPrefix)) {
        const to = toPrefix + v.slice(fromPrefix.length);
        onPath?.(v, to);
        return to;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[ids.get(k) ?? k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
