import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";
import { FORMAT_LABEL, RIG_LABEL } from "@/lib/creative-studio/prompts";
import type {
  ClipFields,
  CreativeBrief,
  CreativeFormat,
  CreativeRig,
  FrameSpec,
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

You are writing the script inside the portal's Creative Studio. The portal shows the §10 review page and assembles each clip's complete Kling prompt from the §7 templates using the fields you return, so do not write Kling prompts yourself. Return structured fields only:

- frame.subject — the §5 Subject: starts "Daniela, the woman with …", then outfit, seat and pose, ending with how she moves from the pose. For a handheld selfie frame, describe her holding the phone at arm's length as §5 says. Multi-person frames: leave subject as a short shared description.
- frame.room — the §5 Room: props by side, background left to right, light, ending "Warm natural daylight, soft background blur." (adapt the light if the frame clearly differs).
- frame.base and frame.positions — multi-person (duo/trio) only: base = who they are and their shared look; one position per person with the §5 \`who\` string, the outfit, and the short name for listener directions. Single presenter: base "" and positions [].
- clips — the §3 structure for the format and rig, with the §4 fields. speaker: LEFT/CENTER/RIGHT for multi-person clips, NONE for a single presenter. action: one short physical beat written as a sentence about her that the pose in the frame can support. editNote: the §4 Edit note for the editor. cues: only the §6 pronunciation sentences this line needs, phrased exactly as the playbook phrases them (empty string if none). listenerReactions: multi-person only, one per listener by short name, small and specific; [] otherwise.
- The portal computes each clip's duration with the §4 formula. Keep every line to one idea and about 22 words or fewer; split longer thoughts into two clips.
- notes — plain sentences for the user: risky lines (claims, numbers, long lines), math you recomputed, assumptions you made (e.g. frame order), and anything they should confirm before approving.

Follow every standing rule in §1: C-P-A spelled with hyphens, dollar figures as digits, "investment" never "price", no guarantees, no savior positioning, "legally" when talking about keeping money from the I-R-S.
`;

const SYSTEM = `${KLING_FRAMEWORK}\n${PORTAL_ADDENDUM}`;

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

const FRAME_SCHEMA = {
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
  required: ["frame", "clips", "notes"],
  properties: { frame: FRAME_SCHEMA, clips: { type: "array", items: CLIP_SCHEMA }, notes: STR },
} as const;

const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clip", "notes"],
  properties: { clip: CLIP_SCHEMA, notes: STR },
} as const;

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
}

function briefText(input: ScriptInput): string {
  const b = input.brief;
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

async function callClaude(content: Anthropic.ContentBlockParam[], schema: object, maxTokens: number): Promise<unknown> {
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  // Server-side refusal fallback ("default" routes by refusal category).
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "high", format: { type: "json_schema", schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];

  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to write this script. Try rewording the angle.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The script was too long for one pass. Try a shorter brief or split the VSL.");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Claude returned an unreadable script. Please try again.");
  }
}

export async function generateScript(
  input: ScriptInput
): Promise<{ frame: FrameSpec; clips: ClipFields[]; notes: string }> {
  const raw = (await callClaude(
    [
      ...frameBlocks(input.frameUrls),
      {
        type: "text",
        text: `${briefText(input)}\n\nWrite the full clip-by-clip script for this video.`,
      },
    ],
    SCRIPT_SCHEMA,
    48_000
  )) as { frame: FrameSpec; clips: RawClip[]; notes: string };

  const clips = (raw.clips ?? []).map(toClipFields).filter((c) => c.line);
  if (clips.length === 0) throw new Error("Claude returned no clips. Please try again.");
  return {
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

export async function rewriteClip(args: {
  input: ScriptInput;
  frame: FrameSpec | null;
  clips: ClipFields[];
  index: number;
  instruction: string;
}): Promise<{ clip: ClipFields; notes: string }> {
  const { input, frame, clips, index, instruction } = args;
  const script = clips
    .map((c, i) => `${i + 1}. [${c.section}${c.speaker ? ` · ${c.speaker}` : ""}] ${c.line}`)
    .join("\n");
  const raw = (await callClaude(
    [
      ...frameBlocks(input.frameUrls.slice(0, 1)),
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
          `Current fields: ${JSON.stringify(clips[index])}`,
          instruction ? `What to change: ${instruction}` : "Make it sharper and more natural to say, following the framework.",
        ].join("\n"),
      },
    ],
    REWRITE_SCHEMA,
    8_000
  )) as { clip: RawClip; notes: string };
  return { clip: toClipFields(raw.clip), notes: raw.notes?.trim() ?? "" };
}
