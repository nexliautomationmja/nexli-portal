import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK, ONSCREEN_RULES, STORY_RULES } from "@/lib/creative-studio/rules.generated";
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
import { presenterOf } from "@/lib/creative-studio/prompts";
import { creativeAssets, creativeProjects, type ClipFields, type FrameSpec, type ShowCue, type ShowLayout } from "@/lib/creative-studio/tables";
import { framesOf, scenesOf } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";
import { sourceMeta, sourceTranscriptLines } from "@/lib/creative-studio/source";

/**
 * Clips on screen (Nov 2026): Claude watches every uploaded clip (stills and
 * words, with times) and writes the presenter's script around them, putting
 * a clip on the lines that show one (which part, and full / split / corner,
 * as the user's prompt says). Written as a one-scene story so the Kling
 * prompts come from the story builder unchanged; the edit lays the clips
 * over those lines. Its own system prompt and schema: no other video's
 * request changes.
 */

type Project = typeof creativeProjects.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;

const ONSCREEN_SYSTEM = `${KLING_FRAMEWORK}\n${STORY_RULES}\n${ONSCREEN_RULES}`;
export const SHOW_LAYOUTS: ShowLayout[] = ["full", "split", "corner"];
/** Shortest and longest part of a clip one line shows (seconds). */
const SHOW_MIN_S = 1.5;
const SHOW_MAX_S = 12;

const STR = { type: "string" } as const;
const NUM = { type: "number" } as const;

/** Flat fields (strict structured output): showClip 0 = no clip on this line. */
const ONSCREEN_CLIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...STORY_CLIP_SCHEMA.required, "showClip", "showFrom", "showTo", "showLayout"],
  properties: {
    ...STORY_CLIP_SCHEMA.properties,
    showClip: { type: "integer" },
    showFrom: NUM,
    showTo: NUM,
    showLayout: { type: "string", enum: ["none", ...SHOW_LAYOUTS] },
  },
} as const;

const ONSCREEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scenes", "clips", "notes"],
  properties: {
    title: STR,
    scenes: { type: "array", items: STORY_SCENE_SCHEMA },
    clips: { type: "array", items: ONSCREEN_CLIP_SCHEMA },
    notes: STR,
  },
} as const;

const ONSCREEN_REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clip", "notes"],
  properties: { clip: ONSCREEN_CLIP_SCHEMA, notes: STR },
} as const;

interface RawOnscreenClip extends RawStoryClip {
  showClip: number;
  showFrom: number;
  showTo: number;
  showLayout: ShowLayout | "none";
}
interface RawOnscreen {
  title: string;
  scenes: RawStory["scenes"];
  clips: RawOnscreenClip[];
  notes: string;
}

/** One uploaded clip, as Claude gets it. */
export interface OnscreenClip {
  id: string;
  durationS: number;
  filename: string;
  vertical: boolean;
  lines: string[];
  stills: { t: number; url: string }[];
  hasAudio: boolean;
}

export interface OnscreenInput extends ScriptInput {
  story: NonNullable<ScriptInput["story"]>;
  onscreen: OnscreenClip[];
}

/** What Claude needs to write or change an on-screen video's script: its opening frame, and every clip. */
export async function onscreenInputFor(project: Project, items: Asset[]): Promise<OnscreenInput> {
  const frames = await framesOf(project.id);
  const first = scenesOf(project, frames).find((sc) => sc.frameId);
  const frame = first ? frames.find((f) => f.id === first.frameId) : undefined;
  if (!frame?.storagePath) throw new Error("Pick the presenter's frame first.");
  // Fewer stills per clip as the clips add up (Claude's image budget): 10 for one clip, 3 each for ten.
  const perClip = Math.max(3, Math.floor(30 / Math.max(1, items.length)));
  const picked = items.map((a) => {
    const all = sourceMeta(a).stills ?? [];
    const step = Math.max(1, Math.ceil(all.length / perClip));
    return all.filter((_, i) => i % step === 0).slice(0, perClip);
  });
  const signed = await signPaths([frame.storagePath, ...picked.flat().map((s) => s.path)], 3600);
  const frameUrl = signed.get(frame.storagePath);
  if (!frameUrl) throw new Error("Couldn't read the frame from storage. Please try again.");
  const studio = await studioById(project.ownerId, project.studioId);
  return {
    title: project.title,
    format: project.format,
    rig: project.rig,
    brief: project.brief,
    firm: firmBrief(studio),
    frameUrls: [frameUrl],
    story: { scenes: [{ frameId: frame.id, label: first?.label ?? "", url: frameUrl }] },
    presenter: presenterOf(project),
    onscreen: items.map((a, i) => {
      const m = sourceMeta(a);
      const words = m.words ?? [];
      return {
        id: a.id,
        durationS: a.durationMs ? a.durationMs / 1000 : words.length ? words[words.length - 1].end : 0,
        filename: m.filename ?? `clip ${i + 1}`,
        vertical: Boolean(a.width && a.height && a.height > a.width),
        lines: sourceTranscriptLines(words),
        stills: picked[i].map((s) => ({ t: s.t, url: signed.get(s.path) ?? "" })).filter((s) => s.url),
        hasAudio: m.hasAudio ?? true,
      };
    }),
  };
}

function call(content: Anthropic.ContentBlockParam[], schema: object, maxTokens: number, firm = ""): Promise<unknown> {
  return askClaude({
    // A client studio: Nexli's own walkthrough and offer facts are cut out, the firm's brief added.
    system: firm ? `${withoutNexliSections(ONSCREEN_SYSTEM)}${firm}` : ONSCREEN_SYSTEM,
    content,
    schema,
    maxTokens,
    effort: "high",
    refusal: "Claude declined to write this script. Try other clips or reword your prompt.",
    tooLong: "The script came back too long. Try fewer clips or a shorter brief.",
    unreadable: "Claude returned an unreadable script. Please try again.",
  });
}

/** The presenter's frame, then each clip: its stills (labeled with times) and its words. */
function clipBlocks(input: OnscreenInput): Anthropic.ContentBlockParam[] {
  return [
    { type: "text", text: "Scene 1, the presenter:" },
    { type: "image", source: { type: "url", url: input.story.scenes[0].url } },
    ...input.onscreen.flatMap((c, i): Anthropic.ContentBlockParam[] => [
      {
        type: "text",
        text: `CLIP ${i + 1} ("${c.filename}", ${c.durationS.toFixed(1)} s, ${c.vertical ? "vertical" : "horizontal"}). Stills through it:`,
      },
      ...c.stills.flatMap((s): Anthropic.ContentBlockParam[] => [
        { type: "text", text: `Clip ${i + 1} at ${s.t.toFixed(1)} s:` },
        { type: "image", source: { type: "url", url: s.url } },
      ]),
      {
        type: "text",
        text: c.lines.length
          ? `What clip ${i + 1} says, with times in seconds:\n${c.lines.join("\n")}`
          : c.hasAudio
            ? `Clip ${i + 1} has no words (go by the stills).`
            : `Clip ${i + 1} has no sound (go by the stills).`,
      },
    ]),
  ];
}

function briefText(input: OnscreenInput): string {
  return [
    `Format: ${input.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}`,
    presenterLine(input.presenter),
    `Clips to show on screen: ${input.onscreen.length} (numbered above).`,
    `What the user wants, in their words (including how the clips should appear, when they say):\n${input.brief.direction?.trim() || "(nothing given: decide the story and where each clip shows from the clips)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** Claude's cue, kept to a real clip and a 1.5–12 s part inside it; null for no clip. `moved` = it had to change. */
export function fitShow(raw: Pick<RawOnscreenClip, "showClip" | "showFrom" | "showTo" | "showLayout">, clips: OnscreenClip[]): { show: ShowCue | null; moved: boolean } {
  const n = Math.round(Number(raw.showClip));
  const clip = n >= 1 ? clips[n - 1] : undefined;
  if (!clip || raw.showLayout === "none") return { show: null, moved: Boolean(n >= 1 && !clip) };
  const layout: ShowLayout = SHOW_LAYOUTS.includes(raw.showLayout as ShowLayout) ? (raw.showLayout as ShowLayout) : "full";
  const end = clip.durationS > 0 ? clip.durationS : Number.POSITIVE_INFINITY;
  let from = Number(raw.showFrom);
  let to = Number(raw.showTo);
  const given = Number.isFinite(from) && Number.isFinite(to) && to > from;
  if (!given) {
    from = 0;
    to = 5;
  }
  const len = Math.min(SHOW_MAX_S, Math.max(SHOW_MIN_S, to - from));
  from = Math.max(0, from);
  if (from > end - SHOW_MIN_S) from = Math.max(0, end - len);
  to = Math.min(end, from + len);
  const show = { mediaId: clip.id, from: tenth(from), to: tenth(to), layout };
  return { show, moved: !given || Math.abs(show.from - Number(raw.showFrom)) > 0.05 || Math.abs(show.to - Number(raw.showTo)) > 0.05 };
}

/** Claude's JSON → the stored script: the one scene, its clips, each line's clip on screen. */
function toOnscreenResult(raw: RawOnscreen, input: OnscreenInput): ScriptResult {
  const story = toStoryResult({ title: raw.title, scenes: raw.scenes, clips: raw.clips, notes: raw.notes } as RawStory, input);
  const scene = story.frame.scenes?.[0];
  if (!scene) throw new Error("Claude returned no scene. Please try again.");
  const moved: number[] = [];
  const clips: ClipFields[] = [];
  for (const c of raw.clips ?? []) {
    const f = toStoryClip(c, scene);
    if (f.kind === "silent" ? !f.action : !f.line) continue;
    const fit = f.kind === "silent" ? { show: null, moved: false } : fitShow(c, input.onscreen);
    if (fit.moved) moved.push(clips.length + 1);
    clips.push(fit.show ? { ...f, show: fit.show } : f);
  }
  if (clips.length === 0) throw new Error("Claude returned no clips. Please try again.");
  const unused = input.onscreen.map((c, i) => (clips.some((x) => x.show?.mediaId === c.id) ? 0 : i + 1)).filter(Boolean);
  const notes = [
    story.notes,
    moved.length ? `Line ${moved.join(", ")}: the part of the clip shown was adjusted to fit (${SHOW_MIN_S}–${SHOW_MAX_S} s, inside the clip). Check the times.` : "",
    unused.length ? `Clip ${unused.join(", ")} isn't shown anywhere yet. Ask for it in a revision if you want it in.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { ...story, clips, notes };
}

/** The current script as Claude reads it back: the story JSON plus each line's clip on screen. */
function currentJson(frame: FrameSpec | null, clips: ClipFields[], input: OnscreenInput) {
  const json = storyScriptJson(frame, clips, input);
  const number = new Map(input.onscreen.map((c, i) => [c.id, i + 1]));
  return {
    ...json,
    clips: json.clips.map((c, i) => {
      const s = clips[i]?.show;
      return { ...c, showClip: s ? number.get(s.mediaId) ?? 0 : 0, showFrom: s?.from ?? 0, showTo: s?.to ?? 0, showLayout: s?.layout ?? "none" };
    }),
  };
}

export async function generateOnscreenScript(input: OnscreenInput): Promise<ScriptResult> {
  const raw = (await call(
    [...clipBlocks(input), { type: "text", text: `${briefText(input)}\n\nWrite the full clip-by-clip script for this video, with the clips on screen.` }],
    ONSCREEN_SCHEMA,
    32_000,
    input.firm
  )) as RawOnscreen;
  return toOnscreenResult(raw, input);
}

/** Revise the whole script from a plain-English note (it can move clips, or change how they show). */
export async function reviseOnscreenScript(args: { input: OnscreenInput; frame: FrameSpec | null; clips: ClipFields[]; note: string }): Promise<ScriptResult> {
  const { input, frame, clips, note } = args;
  const raw = (await call(
    [
      ...clipBlocks(input),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Current script (JSON):\n${JSON.stringify(currentJson(frame, clips, input))}`,
          "",
          `The user's requested changes: ${note}`,
          "",
          "Return the complete revised script. Change only what the note asks for (plus anything the framework requires as a consequence); keep every other line, the clips on screen and the scene description exactly as they are.",
        ].join("\n"),
      },
    ],
    ONSCREEN_SCHEMA,
    32_000,
    input.firm
  )) as RawOnscreen;
  return toOnscreenResult(raw, input);
}

/** Claude rewrites one line (its clip on screen can change too). */
export async function rewriteOnscreenClip(args: {
  input: OnscreenInput;
  frame: FrameSpec | null;
  clips: ClipFields[];
  index: number;
  instruction: string;
}): Promise<{ clip: ClipFields; notes: string }> {
  const { input, frame, clips, index, instruction } = args;
  const scene = frame?.scenes?.[0];
  if (!scene) throw new Error("This video has no scene description yet. Write the script again first.");
  const current = currentJson(frame, clips, input);
  const lines = current.clips
    .map((c, i) => `${i + 1}. [${c.section}${c.showClip ? ` · clip ${c.showClip} ${c.showLayout} ${c.showFrom}–${c.showTo} s` : ""}] ${c.line || c.action}`)
    .join("\n");
  const raw = (await call(
    [
      ...clipBlocks(input),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Scene description in use (JSON):\n${JSON.stringify(current.scenes)}`,
          "",
          `Current script:\n${lines}`,
          "",
          `Rewrite line ${index + 1} only, keeping it in its section and consistent with the lines around it.`,
          `Current fields: ${JSON.stringify(current.clips[index])}`,
          instruction ? `What to change: ${instruction}` : "Make it sharper and more natural, following the framework.",
        ].join("\n"),
      },
    ],
    ONSCREEN_REWRITE_SCHEMA,
    8_000,
    input.firm
  )) as { clip: RawOnscreenClip; notes: string };
  const f = toStoryClip(raw.clip, scene);
  if (f.kind !== "silent" && !f.line) throw new Error("Claude returned an empty line. Please try again.");
  const fit = f.kind === "silent" ? { show: null, moved: false } : fitShow(raw.clip, input.onscreen);
  const notes = [raw.notes?.trim() ?? "", fit.moved ? "The part of the clip shown was adjusted to fit. Check the times." : ""].filter(Boolean).join(" ");
  return { clip: fit.show ? { ...f, show: fit.show } : f, notes };
}
