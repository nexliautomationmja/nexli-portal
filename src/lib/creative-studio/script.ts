import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK, STORY_RULES, REFERENCE_RULES } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import { FORMAT_LABEL, RIG_LABEL, hasSetVoice } from "@/lib/creative-studio/prompts";
import {
  CLIP_KINDS,
  type ClipFields,
  type ClipKind,
  type CreativeBrief,
  type CreativeFormat,
  type CreativeRig,
  type FrameSpec,
  type PresenterInfo,
  type ScenePerson,
  type SceneSpec,
} from "@/lib/creative-studio/tables";

/**
 * Claude writes the script (frame description + per-clip fields) from
 * Marcel's Kling framework. The portal assembles the Kling prompts itself
 * (prompts.ts), so Claude never writes them — that keeps the standing rules
 * in every prompt and the output small enough for one function call.
 */

const MODEL = "claude-opus-5-5";

// Appended after the verbatim framework: how the framework maps onto the
// portal's structured fields. The framework itself stays the source of truth.
const PORTAL_ADDENDUM = `
---

# Working inside the Nexli portal (Creative Studio)

You are writing the script inside the portal's Creative Studio. The user gives you the opening frame and explains the video in their own words; they only choose ad or VSL. Infer everything else the §2 intake asks for (angle, old and new belief, proof, CTA, required lines) from their words, the framework and the current offer facts in §9 — do not ask questions. The portal shows the §10 review page and assembles each clip's complete Kling prompt from the §7 templates using the fields you return, so do not write Kling prompts yourself. Return structured fields only:

- frame.subject — the §5 Subject: starts "Daniela, the woman with …", then outfit, seat and pose, ending with how she moves from the pose. For a handheld selfie frame, describe her holding the phone at arm's length as §5 says. Multi-person frames: leave subject as a short shared description.
- frame.room — the §5 Room: props by side, background left to right, light, ending "Warm natural daylight, soft background blur." (adapt the light if the frame clearly differs).
- frame.base and frame.positions — multi-person (duo/trio) only: base = who they are and their shared look; one position per person with the §5 \`who\` string, the outfit, and the short name for listener directions. Single presenter: base "" and positions [].
- clips — the §3 structure for the format and rig, with the §4 fields. speaker: LEFT/CENTER/RIGHT for multi-person clips, NONE for a single presenter. action: one short physical beat written as a sentence about her that the pose in the frame can support. editNote: the §4 Edit note for the editor. cues: only the §6 pronunciation sentences this line needs, phrased exactly as the playbook phrases them (empty string if none). listenerReactions: multi-person only, one per listener by short name, small and specific; [] otherwise.
- The portal computes each clip's duration with the §4 formula. Keep every line to one idea and about 22 words or fewer; split longer thoughts into two clips.
- rig — read it from the frame: solo_locked (one person, camera on a stand), solo_selfie (one person holding the phone), duo (two people), trio (three people). VSLs are always solo_locked.
- title — a short working title for the video (3–6 words).
- notes — plain sentences for the user: risky lines (claims, numbers, long lines), math you recomputed, assumptions you made (e.g. frame order), and anything they should confirm before approving.

Follow every standing rule in §1: C-P-A spelled with hyphens, dollar figures as digits, "investment" never "price", no guarantees, no savior positioning, "legally" when talking about keeping money from the I-R-S.
`;

const SYSTEM = `${KLING_FRAMEWORK}\n${PORTAL_ADDENDUM}`;
/** A story video: the framework, then the story rules (they replace the one-frame field list). */
const STORY_SYSTEM = `${KLING_FRAMEWORK}\n${STORY_RULES}`;

const STR = { type: "string" } as const;

const CLIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["section", "speaker", "line", "register", "action", "editNote", "cues", "listenerReactions"],
  properties: {
    section: STR,
    speaker: { type: "string", enum: ["LEFT", "CENTER", "RIGHT", "NONE"] },
    line: STR,
    register: STR,
    action: STR,
    editNote: STR,
    cues: STR,
    listenerReactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["shortName", "reaction"],
        properties: { shortName: STR, reaction: STR },
      },
    },
  },
} as const;

export const FRAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "room", "base", "positions"],
  properties: {
    subject: STR,
    room: STR,
    base: STR,
    positions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "who", "outfit", "shortName"],
        properties: {
          position: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
          who: STR,
          outfit: STR,
          shortName: STR,
        },
      },
    },
  },
} as const;

const SCRIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "rig", "frame", "clips", "notes"],
  properties: {
    title: STR,
    rig: { type: "string", enum: ["solo_locked", "solo_selfie", "duo", "trio"] },
    frame: FRAME_SCHEMA,
    clips: { type: "array", items: CLIP_SCHEMA },
    notes: STR,
  },
} as const;

const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clip", "notes"],
  properties: { clip: CLIP_SCHEMA, notes: STR },
} as const;

// ── Story videos ─────────────────────────────────────────────────────────

const STORY_PERSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["position", "presenter", "who", "look", "shortName", "pronoun"],
  properties: {
    position: { type: "string", enum: ["ONLY", "LEFT", "CENTER", "RIGHT"] },
    presenter: { type: "boolean" },
    who: STR,
    look: STR,
    shortName: STR,
    pronoun: { type: "string", enum: ["she", "he"] },
  },
} as const;

export const STORY_SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scene", "camera", "setting", "people"],
  properties: {
    scene: { type: "integer" },
    camera: { type: "string", enum: ["locked", "selfie", "handheld"] },
    setting: STR,
    people: { type: "array", items: STORY_PERSON_SCHEMA },
  },
} as const;

export const STORY_CLIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scene", "kind", "speaker", "section", "line", "register", "action", "editNote", "cues", "listenerReactions"],
  properties: {
    scene: { type: "integer" },
    kind: { type: "string", enum: ["to_camera", "in_scene", "voiceover", "silent"] },
    speaker: { type: "string", enum: ["PRESENTER", "LEFT", "CENTER", "RIGHT"] },
    section: STR,
    line: STR,
    register: STR,
    action: STR,
    editNote: STR,
    cues: STR,
    listenerReactions: CLIP_SCHEMA.properties.listenerReactions,
  },
} as const;

const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scenes", "clips", "notes"],
  properties: {
    title: STR,
    scenes: { type: "array", items: STORY_SCENE_SCHEMA },
    clips: { type: "array", items: STORY_CLIP_SCHEMA },
    notes: STR,
  },
} as const;

const STORY_REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clip", "notes"],
  properties: { clip: STORY_CLIP_SCHEMA, notes: STR },
} as const;

interface RawStoryPerson {
  position: ScenePerson["position"];
  presenter: boolean;
  who: string;
  look: string;
  shortName: string;
  pronoun: "she" | "he";
}
interface RawStoryScene {
  scene: number;
  camera: SceneSpec["camera"];
  setting: string;
  people: RawStoryPerson[];
}
export interface RawStoryClip {
  scene: number;
  kind: ClipKind;
  speaker: "PRESENTER" | "LEFT" | "CENTER" | "RIGHT";
  section: string;
  line: string;
  register: string;
  action: string;
  editNote: string;
  cues: string;
  listenerReactions: { shortName: string; reaction: string }[];
}
export interface RawStory {
  title: string;
  scenes: RawStoryScene[];
  clips: RawStoryClip[];
  notes: string;
}

const CAMERAS: SceneSpec["camera"][] = ["locked", "selfie", "handheld"];
const POSITIONS: ScenePerson["position"][] = ["ONLY", "LEFT", "CENTER", "RIGHT"];

export function cleanPeople(raw: unknown): ScenePerson[] {
  if (!Array.isArray(raw)) return [];
  let presenterSeen = false;
  return raw.slice(0, 4).flatMap((x) => {
    const r = (x ?? {}) as Partial<RawStoryPerson>;
    const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    if (!t(r.who) && !t(r.look)) return [];
    // One presenter per scene.
    const presenter = Boolean(r.presenter) && !presenterSeen;
    if (presenter) presenterSeen = true;
    return [
      {
        position: POSITIONS.includes(r.position as ScenePerson["position"]) ? (r.position as ScenePerson["position"]) : "ONLY",
        presenter,
        who: t(r.who),
        look: t(r.look),
        shortName: t(r.shortName) || t(r.who),
        pronoun: r.pronoun === "he" ? "he" : "she",
        // Kling picks every voice from the frame (only Daniela's is set, by the portal).
        voice: "",
      },
    ];
  });
}

/** The scene index (0-based) for Claude's 1-based scene number, clamped to the scenes there are. */
const sceneIndex = (n: unknown, count: number) => {
  const i = Math.round(Number(n)) - 1;
  return Number.isFinite(i) ? Math.min(count - 1, Math.max(0, i)) : 0;
};

export function toStoryClip(c: RawStoryClip, scene: SceneSpec): ClipFields {
  const kind: ClipKind = CLIP_KINDS.includes(c.kind) ? c.kind : "to_camera";
  // Someone other than the presenter speaks only if they're in that scene's frame.
  const speaker =
    c.speaker && c.speaker !== "PRESENTER" && scene.people.some((p) => p.position === c.speaker)
      ? (c.speaker as ClipFields["speaker"])
      : null;
  return {
    section: (c.section ?? "").trim() || "Clip",
    speaker,
    line: kind === "silent" ? "" : (c.line ?? "").trim(),
    register: (c.register ?? "").trim(),
    action: (c.action ?? "").trim(),
    editNote: (c.editNote ?? "").trim(),
    cues: kind === "silent" ? "" : (c.cues ?? "").trim(),
    listenerReactions: Array.isArray(c.listenerReactions) ? c.listenerReactions : [],
    kind,
    frameId: scene.frameId,
  };
}

/** Claude's story JSON → the stored script (exported for the scratch tests). */
export function toStoryResult(raw: RawStory, input: ScriptInput): ScriptResult {
  const slots = input.story?.scenes ?? [];
  if (slots.length === 0) throw new Error("This story has no scene frames yet.");
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const specs: SceneSpec[] = slots.map((slot, i) => {
    const r = rawScenes.find((x) => Math.round(Number(x?.scene)) === i + 1) ?? rawScenes[i];
    return {
      frameId: slot.frameId,
      label: slot.label,
      camera: CAMERAS.includes(r?.camera) ? r!.camera : "locked",
      setting: (r?.setting ?? "").trim(),
      people: cleanPeople(r?.people),
    };
  });
  const clips = (raw.clips ?? [])
    .map((c) => toStoryClip(c, specs[sceneIndex(c?.scene, specs.length)]))
    .filter((c) => (c.kind === "silent" ? Boolean(c.action) : Boolean(c.line)));
  if (clips.length === 0) throw new Error("Claude returned no clips. Please try again.");
  const unused = specs.map((sc, i) => (clips.some((c) => c.frameId === sc.frameId) ? null : i + 1)).filter((n): n is number => n !== null);
  const notes = [
    (raw.notes ?? "").trim(),
    unused.length ? `Scene${unused.length > 1 ? "s" : ""} ${unused.join(", ")} ${unused.length > 1 ? "aren't" : "isn't"} in the script yet.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const first = specs[0];
  const lead = first.people.find((p) => p.presenter) ?? first.people[0];
  return {
    title: (raw.title ?? "").trim().slice(0, 120),
    // Multi-scene stories aren't the founders' duo/trio rig; the edit suggests Solo.
    rig: "solo_locked",
    frame: { subject: lead?.look ?? "", room: first.setting, base: "", positions: [], scenes: specs, presenterId: input.presenter?.id || null },
    clips,
    notes,
  };
}

/** The current story script as Claude reads it back (scene numbers, not frame ids). */
export function storyScriptJson(frame: FrameSpec | null, clips: ClipFields[], input: ScriptInput) {
  const slots = input.story?.scenes ?? [];
  const number = (frameId: string | null | undefined) => Math.max(0, slots.findIndex((s) => s.frameId === frameId)) + 1;
  return {
    scenes: slots.map((slot, i) => {
      const spec = frame?.scenes?.find((x) => x.frameId === slot.frameId);
      const people = (spec?.people ?? []).map((p) => ({
        position: p.position,
        presenter: p.presenter,
        who: p.who,
        look: p.look,
        shortName: p.shortName,
        pronoun: p.pronoun,
      }));
      return { scene: i + 1, label: slot.label, camera: spec?.camera ?? "locked", setting: spec?.setting ?? "", people };
    }),
    clips: clips.map((c) => ({
      scene: number(c.frameId),
      kind: c.kind ?? "to_camera",
      speaker: c.speaker ?? "PRESENTER",
      section: c.section,
      line: c.line,
      register: c.register,
      action: c.action,
      editNote: c.editNote,
      cues: c.cues,
      listenerReactions: c.listenerReactions,
    })),
  };
}

export function presenterLine(p: PresenterInfo | undefined): string {
  if (!p) return "";
  const pron = p.pronoun === "he" ? "he/him" : "she/her";
  if (!p.name) return `The presenter: the person in the frames (${pron}). Don't name them unless the user does.`;
  const voice = hasSetVoice(p)
    ? `the portal adds ${p.pronoun === "he" ? "his" : "her"} voice to every clip`
    : `Kling gives ${p.pronoun === "he" ? "him" : "her"} a voice that fits the frame`;
  return `The presenter: ${p.name} (${pron}). Describe ${p.name} from the frames; ${voice}.`;
}

function storyBriefText(input: ScriptInput): string {
  const scenes = input.story?.scenes ?? [];
  return [
    `Format: ${input.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}`,
    presenterLine(input.presenter),
    `What the user wants this video to be, in their words:\n${input.brief.direction?.trim() || "(no direction yet: infer the story from the scenes)"}`,
    `Scenes attached: ${scenes.length}, in story order (each image is labeled with its scene number).`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function storyFrameBlocks(input: ScriptInput): Anthropic.ContentBlockParam[] {
  return (input.story?.scenes ?? []).slice(0, 8).flatMap((sc, i) => [
    { type: "text" as const, text: `Scene ${i + 1}${sc.label ? ` — ${sc.label}` : ""}:` },
    { type: "image" as const, source: { type: "url" as const, url: sc.url } },
  ]);
}

/** A one-frame video's clip fields, exactly as Claude has always seen them (no kind / frame id). */
function classicFields(c: ClipFields) {
  return {
    section: c.section,
    speaker: c.speaker,
    line: c.line,
    register: c.register,
    action: c.action,
    editNote: c.editNote,
    cues: c.cues,
    listenerReactions: c.listenerReactions,
  };
}

interface RawClip {
  section: string;
  speaker: "LEFT" | "CENTER" | "RIGHT" | "NONE";
  line: string;
  register: string;
  action: string;
  editNote: string;
  cues: string;
  listenerReactions: { shortName: string; reaction: string }[];
}

function toClipFields(c: RawClip): ClipFields {
  return {
    section: c.section.trim() || "Clip",
    speaker: c.speaker === "NONE" ? null : c.speaker,
    line: c.line.trim(),
    register: c.register.trim(),
    action: c.action.trim(),
    editNote: c.editNote.trim(),
    cues: c.cues.trim(),
    listenerReactions: Array.isArray(c.listenerReactions) ? c.listenerReactions : [],
  };
}

export interface ScriptInput {
  title: string;
  format: CreativeFormat;
  rig: CreativeRig;
  brief: CreativeBrief;
  /** Signed URLs of the frame images, primary first. */
  frameUrls: string[];
  /** A client studio's firm brief (studios.ts firmBrief); empty for Nexli. */
  firm?: string;
  /** A story video: its scenes in order (frame id, label, signed URL). Absent = a one-frame video. */
  story?: { scenes: { frameId: string; label: string; url: string }[] };
  /** Who presents (story videos). */
  presenter?: PresenterInfo;
  /** A video to recreate: Claude copies its structure, hook and pacing (never its words). */
  reference?: ReferenceVideo;
}

/** A reference video as Claude reads it: length, timed phrases, stills. */
export interface ReferenceVideo {
  durationS: number;
  lines: string[];
  stills: { t: number; url: string }[];
}

/** The reference video before everything else: its stills and every word, with times. */
function referenceBlocks(input: ScriptInput): Anthropic.ContentBlockParam[] {
  const r = input.reference;
  if (!r) return [];
  return [
    { type: "text", text: `THE REFERENCE VIDEO TO RECREATE (${r.durationS.toFixed(1)} s). Stills through it:` },
    ...r.stills.flatMap((st) => [
      { type: "text" as const, text: `Reference still at ${st.t.toFixed(1)} s:` },
      { type: "image" as const, source: { type: "url" as const, url: st.url } },
    ]),
    {
      type: "text",
      text: `What the reference says, with times in seconds:\n${r.lines.join("\n") || "(no words: go by the stills)"}\n\nEND OF THE REFERENCE. Copy its shape for this video; never its words, claims or brand.`,
    },
  ];
}

function briefText(input: ScriptInput): string {
  const b = input.brief;
  if (b.direction?.trim()) {
    return [
      `Format: ${input.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}`,
      `What the user wants this video to be, in their words:\n${b.direction.trim()}`,
      `Frames attached: ${input.frameUrls.length} (the first is the opening frame for every clip).`,
    ].join("\n\n");
  }
  const lines = [
    `Project: ${input.title}`,
    `Format: ${FORMAT_LABEL[input.format]} (${input.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"})`,
    `Rig: ${RIG_LABEL[input.rig]}`,
    `Old belief: ${b.oldBelief || "(not given — infer from the angle)"}`,
    `New belief: ${b.newBelief || "(not given — infer from the angle)"}`,
    `Proof or math: ${b.proof || "(none given)"}`,
    `CTA destination: ${b.cta || "(not given — use the §3 default for this format)"}`,
    `Required lines (verbatim where given): ${b.requiredLines || "(none)"}`,
    `Extra notes: ${b.notes || "(none)"}`,
    `Frames attached: ${input.frameUrls.length}${input.frameUrls.length > 1 ? " — the first is the opening frame for every clip unless the notes say otherwise" : ""}.`,
  ];
  return lines.join("\n");
}

function frameBlocks(urls: string[]): Anthropic.ImageBlockParam[] {
  return urls.slice(0, 4).map((url) => ({ type: "image", source: { type: "url", url } }));
}

async function callClaude(content: Anthropic.ContentBlockParam[], schema: object, maxTokens: number, firm = "", story = false, reference = false): Promise<unknown> {
  const base = `${story ? STORY_SYSTEM : SYSTEM}${reference ? `\n${REFERENCE_RULES}` : ""}`;
  return askClaude({
    // A client studio: Nexli's own walkthrough and offer facts are cut out, the firm's brief added.
    system: firm ? `${withoutNexliSections(base)}${firm}` : base,
    content,
    schema,
    maxTokens,
    effort: "high",
    refusal: "Claude declined to write this script. Try rewording the angle.",
    tooLong: "The script was too long for one pass. Try a shorter brief or split the VSL.",
    unreadable: "Claude returned an unreadable script. Please try again.",
  });
}

/** One structured-output call to Claude (the studio's writers share this shape). */
export async function askClaude(args: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: object;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  refusal: string;
  tooLong: string;
  unreadable: string;
}): Promise<unknown> {
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  // Server-side refusal fallback ("default" routes by refusal category).
  const params = {
    model: MODEL,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.content }],
    output_config: { effort: args.effort, format: { type: "json_schema", schema: args.schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];

  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error(args.refusal);
  if (message.stop_reason === "max_tokens") throw new Error(args.tooLong);
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(args.unreadable);
  }
}

export interface ScriptResult {
  title: string;
  rig: CreativeRig;
  frame: FrameSpec;
  clips: ClipFields[];
  notes: string;
}

const RIGS: CreativeRig[] = ["solo_locked", "solo_selfie", "duo", "trio"];

function toResult(raw: RawScript, format: CreativeFormat): ScriptResult {
  const clips = (raw.clips ?? []).map(toClipFields).filter((c) => c.line);
  if (clips.length === 0) throw new Error("Claude returned no clips. Please try again.");
  const rig = format === "vsl_16x9" ? "solo_locked" : RIGS.includes(raw.rig) ? raw.rig : "solo_locked";
  return {
    title: (raw.title ?? "").trim().slice(0, 120),
    rig,
    frame: {
      subject: raw.frame?.subject?.trim() ?? "",
      room: raw.frame?.room?.trim() ?? "",
      base: raw.frame?.base?.trim() ?? "",
      positions: Array.isArray(raw.frame?.positions) ? raw.frame.positions : [],
    },
    clips,
    notes: raw.notes?.trim() ?? "",
  };
}

interface RawScript {
  title: string;
  rig: CreativeRig;
  frame: FrameSpec;
  clips: RawClip[];
  notes: string;
}

/** Revise the whole script from a plain-English note ("make the hook punchier, drop clip 4"). */
export async function reviseScript(args: {
  input: ScriptInput;
  frame: FrameSpec | null;
  clips: ClipFields[];
  note: string;
}): Promise<ScriptResult> {
  const { input, frame, clips, note } = args;
  if (input.story) {
    const raw = (await callClaude(
      [
        ...referenceBlocks(input), ...storyFrameBlocks(input),
        {
          type: "text",
          text: [
            storyBriefText(input),
            "",
            `Current script (JSON):\n${JSON.stringify(storyScriptJson(frame, clips, input))}`,
            "",
            `The user's requested changes: ${note}`,
            "",
            "Return the complete revised script. Change only what the note asks for (plus anything the framework requires as a consequence); keep every other clip and scene description exactly as it is.",
          ].join("\n"),
        },
      ],
      STORY_SCHEMA,
      48_000,
      input.firm,
      true,
      Boolean(input.reference)
    )) as RawStory;
    return toStoryResult(raw, input);
  }
  const raw = (await callClaude(
    [
      ...referenceBlocks(input), ...frameBlocks(input.frameUrls.slice(0, 1)),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Current script (JSON):\n${JSON.stringify({ rig: input.rig, frame, clips: clips.map(classicFields) })}`,
          "",
          `The user's requested changes: ${note}`,
          "",
          "Return the complete revised script. Change only what the note asks for (plus anything the framework requires as a consequence); keep every other clip exactly as it is.",
        ].join("\n"),
      },
    ],
    SCRIPT_SCHEMA,
    48_000,
    input.firm,
    false,
    Boolean(input.reference)
  )) as RawScript;
  return toResult(raw, input.format);
}

export async function generateScript(input: ScriptInput): Promise<ScriptResult> {
  if (input.story) {
    const raw = (await callClaude(
      [...referenceBlocks(input), ...storyFrameBlocks(input), { type: "text", text: `${storyBriefText(input)}\n\nWrite the full clip-by-clip script for this story.` }],
      STORY_SCHEMA,
      48_000,
      input.firm,
      true,
      Boolean(input.reference)
    )) as RawStory;
    return toStoryResult(raw, input);
  }
  const raw = (await callClaude(
    [
      ...referenceBlocks(input), ...frameBlocks(input.frameUrls),
      {
        type: "text",
        text: `${briefText(input)}\n\nWrite the full clip-by-clip script for this video.`,
      },
    ],
    SCRIPT_SCHEMA,
    48_000,
    input.firm,
    false,
    Boolean(input.reference)
  )) as RawScript;
  return toResult(raw, input.format);
}

export async function rewriteClip(args: {
  input: ScriptInput;
  frame: FrameSpec | null;
  clips: ClipFields[];
  index: number;
  instruction: string;
}): Promise<{ clip: ClipFields; notes: string }> {
  const { input, frame, clips, index, instruction } = args;
  if (input.story) {
    const current = storyScriptJson(frame, clips, input);
    const lines = current.clips
      .map((c, i) => `${i + 1}. [Scene ${c.scene} · ${c.kind} · ${c.section}${c.speaker !== "PRESENTER" ? ` · ${c.speaker}` : ""}] ${c.line || `(no talking) ${c.action}`}`)
      .join("\n");
    const raw = (await callClaude(
      [
        ...referenceBlocks(input), ...storyFrameBlocks(input),
        {
          type: "text",
          text: [
            storyBriefText(input),
            "",
            `Scene descriptions in use (JSON):\n${JSON.stringify(current.scenes)}`,
            "",
            `Current script:\n${lines}`,
            "",
            `Rewrite clip ${index + 1} only, keeping it in its scene and section and consistent with the clips around it.`,
            `Current fields: ${JSON.stringify(current.clips[index])}`,
            instruction ? `What to change: ${instruction}` : "Make it sharper and more natural, following the framework.",
          ].join("\n"),
        },
      ],
      STORY_REWRITE_SCHEMA,
      8_000,
      input.firm,
      true,
      Boolean(input.reference)
    )) as { clip: RawStoryClip; notes: string };
    const specs = frame?.scenes ?? [];
    const slots = input.story.scenes;
    const fallback = specs.find((x) => x.frameId === clips[index]?.frameId) ?? specs[0];
    const want = slots[sceneIndex(raw.clip?.scene, slots.length)]?.frameId;
    const scene = specs.find((x) => x.frameId === want) ?? fallback;
    if (!scene) throw new Error("This story has no scene descriptions yet. Rewrite the script first.");
    return { clip: toStoryClip(raw.clip, scene), notes: raw.notes?.trim() ?? "" };
  }
  const script = clips
    .map((c, i) => `${i + 1}. [${c.section}${c.speaker ? ` · ${c.speaker}` : ""}] ${c.line}`)
    .join("\n");
  const raw = (await callClaude(
    [
      ...referenceBlocks(input), ...frameBlocks(input.frameUrls.slice(0, 1)),
      {
        type: "text",
        text: [
          briefText(input),
          "",
          `Frame description in use:\nSubject: ${frame?.subject ?? ""}\nRoom: ${frame?.room ?? ""}`,
          "",
          `Current script:\n${script}`,
          "",
          `Rewrite clip ${index + 1} only, keeping it in its section and consistent with the clips around it.`,
          `Current fields: ${JSON.stringify(clips[index] ? classicFields(clips[index]) : clips[index])}`,
          instruction ? `What to change: ${instruction}` : "Make it sharper and more natural to say, following the framework.",
        ].join("\n"),
      },
    ],
    REWRITE_SCHEMA,
    8_000,
    input.firm,
    false,
    Boolean(input.reference)
  )) as { clip: RawClip; notes: string };
  return { clip: toClipFields(raw.clip), notes: raw.notes?.trim() ?? "" };
}

/** A user-facing message for a failed Claude call. */
export function claudeError(err: unknown, fallback: string): string {
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? "network"}). Please try again.`;
  return err instanceof Error ? err.message : fallback;
}
