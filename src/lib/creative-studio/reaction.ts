import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { KLING_FRAMEWORK, REACTION_RULES, STORY_RULES } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import {
  STORY_CLIP_SCHEMA,
  STORY_SCENE_SCHEMA,
  askClaude,
  presenterLine,
  storyScriptJson,
  toStoryClip,
  toStoryResult,
  type RawStory,
  type RawStoryClip,
  type ScriptInput,
  type ScriptResult,
} from "@/lib/creative-studio/script";
import { WATCH_MAX_S, WATCH_MIN_S, presenterOf } from "@/lib/creative-studio/prompts";
import { creativeAssets, creativeProjects, type ClipFields, type FrameSpec, type WatchWindow } from "@/lib/creative-studio/tables";
import { framesOf, scenesOf } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";
import { sourceMeta, sourceOf, sourceTranscriptLines } from "@/lib/creative-studio/source";

/**
 * Reaction videos (Nov 2026): Claude watches the video (its stills and every
 * word, with times) and writes the presenter's hook → watch → react script.
 * Written as a one-scene story — talking clips are to_camera, watch clips are
 * silent with the part of the video watched — so the Kling prompts come from
 * the story builder unchanged. Its own system prompt (framework + story rules
 * + reaction rules) and schema: no other video's request changes.
 */

type Project = typeof creativeProjects.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;

const REACTION_SYSTEM = `${KLING_FRAMEWORK}\n${STORY_RULES}\n${REACTION_RULES}`;

const STR = { type: "string" } as const;
const NUM = { type: "number" } as const;

const REACTION_CLIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...STORY_CLIP_SCHEMA.required, "watchFrom", "watchTo"],
  properties: {
    ...STORY_CLIP_SCHEMA.properties,
    kind: { type: "string", enum: ["to_camera", "silent"] },
    watchFrom: NUM,
    watchTo: NUM,
  },
} as const;

const REACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scenes", "clips", "source", "notes"],
  properties: {
    title: STR,
    scenes: { type: "array", items: STORY_SCENE_SCHEMA },
    clips: { type: "array", items: REACTION_CLIP_SCHEMA },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "captioned"],
      properties: { summary: STR, captioned: { type: "boolean" } },
    },
    notes: STR,
  },
} as const;

const REACTION_REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clip", "notes"],
  properties: { clip: REACTION_CLIP_SCHEMA, notes: STR },
} as const;

interface RawReactionClip extends RawStoryClip {
  watchFrom: number;
  watchTo: number;
}
interface RawReaction {
  title: string;
  scenes: RawStory["scenes"];
  clips: RawReactionClip[];
  source: { summary: string; captioned: boolean };
  notes: string;
}

/** The video, as Claude gets it. */
export interface ReactionSource {
  durationS: number;
  filename: string;
  /** Every word, as timed phrases ("[12.4–15.0 s] …"). */
  lines: string[];
  stills: { t: number; url: string }[];
  hasAudio: boolean;
}

export interface ReactionInput extends ScriptInput {
  story: NonNullable<ScriptInput["story"]>;
  reaction: ReactionSource;
}

export interface ReactionResult extends ScriptResult {
  /** Claude's read of the video. */
  source: { summary: string; captioned: boolean };
}

/** The video, once Claude can read it (stills taken, words heard); else why not, for the page. */
export async function readySource(project: Project): Promise<{ source: Asset } | { error: string; status: number }> {
  const source = await sourceOf(project);
  if (!source) return { error: "Upload the video to react to first.", status: 400 };
  const meta = sourceMeta(source);
  if (!meta.analyzedAt) return { error: meta.analyzeError ?? "Still getting the video ready. Try again in a moment.", status: 409 };
  return { source };
}

/** What Claude needs to write or change a reaction video's script: its one frame, and the video. */
export async function reactionInputFor(project: Project, source: Asset): Promise<ReactionInput> {
  const meta = sourceMeta(source);
  const frames = await framesOf(project.id);
  const first = scenesOf(project, frames).find((sc) => sc.frameId);
  const frame = first ? frames.find((f) => f.id === first.frameId) : undefined;
  if (!frame?.storagePath) throw new Error("Pick the frame of the presenter holding the phone first.");
  const stills = meta.stills ?? [];
  const signed = await signPaths([frame.storagePath, ...stills.map((s) => s.path)], 3600);
  const frameUrl = signed.get(frame.storagePath);
  if (!frameUrl) throw new Error("Couldn't read the frame from storage. Please try again.");
  const studio = await studioById(project.ownerId, project.studioId);
  const words = meta.words ?? [];
  const durationS = source.durationMs ? source.durationMs / 1000 : words.length ? words[words.length - 1].end : 0;
  return {
    title: project.title,
    format: project.format,
    rig: project.rig,
    brief: project.brief,
    firm: firmBrief(studio),
    frameUrls: [frameUrl],
    story: { scenes: [{ frameId: frame.id, label: first?.label ?? "", url: frameUrl }] },
    presenter: presenterOf(project),
    reaction: {
      durationS,
      filename: meta.filename ?? "video",
      lines: sourceTranscriptLines(words),
      stills: stills.map((s) => ({ t: s.t, url: signed.get(s.path) ?? "" })).filter((s) => s.url),
      hasAudio: meta.hasAudio ?? true,
    },
  };
}

function call(content: Anthropic.ContentBlockParam[], schema: object, maxTokens: number, firm = ""): Promise<unknown> {
  return askClaude({
    // A client studio: Nexli's own walkthrough and offer facts are cut out, the firm's brief added.
    system: firm ? `${withoutNexliSections(REACTION_SYSTEM)}${firm}` : REACTION_SYSTEM,
    content,
    schema,
    maxTokens,
    effort: "high",
    refusal: "Claude declined to write this reaction. Try another video or reword your take.",
    tooLong: "The script came back too long. Try a shorter video or a narrower take.",
    unreadable: "Claude returned an unreadable script. Please try again.",
  });
}

/** The frame, then the video's stills, each labeled with its time. */
function sourceBlocks(input: ReactionInput): Anthropic.ContentBlockParam[] {
  const r = input.reaction;
  return [
    { type: "text", text: "Scene 1, the presenter holding the phone:" },
    { type: "image", source: { type: "url", url: input.story.scenes[0].url } },
    { type: "text", text: `The video they react to ("${r.filename}", ${r.durationS.toFixed(1)} s long). Stills taken through it, in order:` },
    ...r.stills.flatMap((s): Anthropic.ContentBlockParam[] => [
      { type: "text", text: `Still at ${s.t.toFixed(1)} s:` },
      { type: "image", source: { type: "url", url: s.url } },
    ]),
  ];
}

function wordsText(r: ReactionSource): string {
  if (r.lines.length) return `Every word the video says, with its time in seconds:\n${r.lines.join("\n")}`;
  return r.hasAudio ? "Nobody speaks in the video (no words were heard), so go by the stills." : "The video has no sound, so go by the stills.";
}

function briefText(input: ReactionInput): string {
  return [
    `Format: ${input.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}`,
    presenterLine(input.presenter),
    `The user's take on the video, in their words:\n${input.brief.direction?.trim() || "(none given: decide the take from the video)"}`,
    wordsText(input.reaction),
  ]
    .filter(Boolean)
    .join("\n\n");
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/**
 * A part Claude picked, kept inside the video and 2–10 s long: it keeps its
 * start when that's inside the video, else it becomes the video's last
 * stretch of the same length. A missing one continues from the last part
 * watched. `moved` = it had to be changed.
 */
export function fitWatch(rawFrom: unknown, rawTo: unknown, after: number, durationS: number): { watch: WatchWindow; moved: boolean } {
  const end = durationS > 0 ? durationS : Number.POSITIVE_INFINITY;
  let from = Number(rawFrom);
  let to = Number(rawTo);
  const given = Number.isFinite(from) && Number.isFinite(to) && to > from;
  if (!given) {
    from = after;
    to = after + 6;
  }
  const len = Math.min(WATCH_MAX_S, Math.max(WATCH_MIN_S, to - from));
  from = Math.max(0, from);
  if (from > end - WATCH_MIN_S) from = Math.max(0, end - len);
  to = Math.min(end, from + len);
  const watch = { from: tenth(from), to: tenth(to) };
  const moved = !given || Math.abs(watch.from - Number(rawFrom)) > 0.05 || Math.abs(watch.to - Number(rawTo)) > 0.05;
  return { watch, moved };
}

/** The plain watching action, for a watch clip Claude left without one. */
function watchingAction(input: ScriptInput): string {
  const he = input.presenter?.pronoun === "he";
  return `${he ? "He" : "She"} looks down at the phone in ${he ? "his" : "her"} hand and watches the screen.`;
}

/** Claude's reaction JSON → the stored script: the one scene, its clips, each watch clip's part. */
export function toReactionResult(raw: RawReaction, input: ReactionInput): ReactionResult {
  const watching = watchingAction(input);
  const rawClips = (raw.clips ?? []).map((c) => (c?.kind === "silent" && !(c.action ?? "").trim() ? { ...c, action: watching } : c));
  const story = toStoryResult({ title: raw.title, scenes: raw.scenes, clips: rawClips, notes: raw.notes } as RawStory, input);
  const scene = story.frame.scenes?.[0];
  if (!scene) throw new Error("Claude returned no scene. Please try again.");
  const moved: number[] = [];
  const clips: ClipFields[] = [];
  let after = 0;
  for (const c of rawClips) {
    const f = toStoryClip(c, scene);
    if (f.kind === "silent") {
      const fit = fitWatch(c.watchFrom, c.watchTo, after, input.reaction.durationS);
      after = fit.watch.to;
      if (fit.moved) moved.push(clips.length + 1);
      clips.push({ ...f, section: /^clip$/i.test(f.section) ? "Watch" : f.section, watch: fit.watch });
    } else if (f.line) {
      clips.push(f);
    }
  }
  if (clips.length === 0) throw new Error("Claude returned no clips. Please try again.");
  const notes = [
    story.notes,
    moved.length
      ? `Clip ${moved.join(", ")}: the part watched was adjusted to fit the video (${WATCH_MIN_S}–${WATCH_MAX_S} seconds, inside its length). Check the times.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    ...story,
    clips,
    notes,
    source: { summary: (raw.source?.summary ?? "").trim().slice(0, 500), captioned: Boolean(raw.source?.captioned) },
  };
}

/** The current script as Claude reads it back: the story JSON plus each watch clip's part. */
function currentJson(frame: FrameSpec | null, clips: ClipFields[], input: ReactionInput) {
  const json = storyScriptJson(frame, clips, input);
  return {
    ...json,
    clips: json.clips.map((c, i) => ({ ...c, watchFrom: clips[i]?.watch?.from ?? 0, watchTo: clips[i]?.watch?.to ?? 0 })),
  };
}

export async function generateReactionScript(input: ReactionInput): Promise<ReactionResult> {
  const raw = (await call(
    [...sourceBlocks(input), { type: "text", text: `${briefText(input)}\n\nWrite the full clip-by-clip script for this reaction video.` }],
    REACTION_SCHEMA,
    32_000,
    input.firm
  )) as RawReaction;
  return toReactionResult(raw, input);
}

/** Revise the whole reaction script from a plain-English note. */
export async function reviseReactionScript(args: { input: ReactionInput; frame: FrameSpec | null; clips: ClipFields[]; note: string }): Promise<ReactionResult> {
  const { input, frame, clips, note } = args;
  const raw = (await call(
    [
      ...sourceBlocks(input),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Current script (JSON):\n${JSON.stringify(currentJson(frame, clips, input))}`,
          "",
          `The user's requested changes: ${note}`,
          "",
          "Return the complete revised script. Change only what the note asks for (plus anything the framework requires as a consequence); keep every other clip, the parts watched and the scene description exactly as they are.",
        ].join("\n"),
      },
    ],
    REACTION_SCHEMA,
    32_000,
    input.firm
  )) as RawReaction;
  return toReactionResult(raw, input);
}

/** Claude rewrites one clip of a reaction video (a watch clip can move to another part). */
export async function rewriteReactionClip(args: {
  input: ReactionInput;
  frame: FrameSpec | null;
  clips: ClipFields[];
  index: number;
  instruction: string;
}): Promise<{ clip: ClipFields; notes: string }> {
  const { input, frame, clips, index, instruction } = args;
  const scene = frame?.scenes?.[0];
  if (!scene) throw new Error("This reaction has no scene description yet. Write the script again first.");
  const current = currentJson(frame, clips, input);
  const lines = current.clips
    .map((c, i) => `${i + 1}. [${c.section} · ${c.kind === "silent" ? `watches ${c.watchFrom}–${c.watchTo} s` : "to camera"}] ${c.line || c.action}`)
    .join("\n");
  const raw = (await call(
    [
      ...sourceBlocks(input),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Scene description in use (JSON):\n${JSON.stringify(current.scenes)}`,
          "",
          `Current script:\n${lines}`,
          "",
          `Rewrite clip ${index + 1} only, keeping it in its section and consistent with the clips around it.`,
          `Current fields: ${JSON.stringify(current.clips[index])}`,
          instruction ? `What to change: ${instruction}` : "Make it sharper and more natural, following the framework.",
        ].join("\n"),
      },
    ],
    REACTION_REWRITE_SCHEMA,
    8_000,
    input.firm
  )) as { clip: RawReactionClip; notes: string };
  const c = raw.clip?.kind === "silent" && !(raw.clip.action ?? "").trim() ? { ...raw.clip, action: watchingAction(input) } : raw.clip;
  const f = toStoryClip(c, scene);
  if (f.kind !== "silent") {
    if (!f.line) throw new Error("Claude returned an empty line. Please try again.");
    return { clip: f, notes: raw.notes?.trim() ?? "" };
  }
  // A watch clip follows on from the last part watched before it.
  const after = clips.slice(0, index).reduce((t, x) => (x.watch ? x.watch.to : t), 0);
  const fit = fitWatch(c.watchFrom, c.watchTo, after, input.reaction.durationS);
  const notes = [raw.notes?.trim() ?? "", fit.moved ? "The part watched was adjusted to fit the video. Check the times." : ""].filter(Boolean).join(" ");
  return { clip: { ...f, section: /^clip$/i.test(f.section) ? "Watch" : f.section, watch: fit.watch }, notes };
}

/** After a reaction script is written: which video it was written for, and Claude's read of that video. */
export async function markReactionWritten(project: Project, source: Asset, read: { summary: string; captioned: boolean }): Promise<void> {
  await db
    .update(creativeProjects)
    .set({ reaction: { sourceId: source.id, scriptFor: source.id } })
    .where(eq(creativeProjects.id, project.id));
  await db
    .update(creativeAssets)
    .set({ metadata: sql`coalesce(${creativeAssets.metadata}, '{}'::jsonb) || ${JSON.stringify({ summary: read.summary, captioned: read.captioned })}::jsonb` })
    .where(eq(creativeAssets.id, source.id));
}
