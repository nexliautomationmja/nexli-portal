import type Anthropic from "@anthropic-ai/sdk";
import { askClaude } from "@/lib/creative-studio/script";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import { MAX_SCENES } from "@/lib/creative-studio/prompts";
import type { CreativeFormat, PresenterInfo, SceneAsk, SceneSlot } from "@/lib/creative-studio/tables";

/**
 * Frames that arrived without a direction: Claude says what it sees in each
 * one and asks the one question it needs answered to write the video (Marcel:
 * "ask for context on what the video will be about, based on the frame").
 */

const STR = { type: "string" } as const;

const READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenes", "question", "suggestion"],
  properties: {
    scenes: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["label", "read"], properties: { label: STR, read: STR } },
    },
    question: STR,
    suggestion: STR,
  },
} as const;

function context(firmName: string | null): string {
  return firmName
    ? `You are the creative partner in a video studio. This video is an ad for ${firmName}, one of Nexli's client firms. Nexli makes the firm's short Facebook/Instagram video ads and longer VSLs with an AI presenter rendered on Kling.`
    : "You are the creative partner in Nexli's Creative Studio. Nexli makes short Facebook/Instagram video ads and longer VSLs (AI presenters rendered on Kling) that sell its Digital Rainmaker System to C-P-A firm owners: ads, funnel, booked calls and a client portal, built and run for the firm.";
}

export async function readScenes(args: {
  frames: { id: string; url: string }[];
  format: CreativeFormat;
  presenter: PresenterInfo;
  firmName: string | null;
  firmBrief: string;
}): Promise<SceneAsk> {
  const { frames, format } = args;
  const many = frames.length > 1;
  const content: Anthropic.ContentBlockParam[] = [
    ...frames.flatMap((f, i) => [
      { type: "text" as const, text: many ? `Scene ${i + 1}:` : "The frame:" },
      { type: "image" as const, source: { type: "url" as const, url: f.url } },
    ]),
    {
      type: "text",
      text: [
        `These are the ${many ? `${frames.length} scene frames, in the order the user added them,` : "opening frame"} of a ${format === "vsl_16x9" ? "landscape VSL (16:9)" : "vertical ad (9:16)"}.${args.presenter.name ? ` The presenter is ${args.presenter.name}.` : ""} The user hasn't said what the video is about yet.`,
        many
          ? "1. For each scene, a 2–4 word label and one plain line on what you see that matters for the story: who, where, the mood."
          : "1. One entry: a 2–4 word label and one plain line on what you see that matters: who, where, the mood.",
        "2. Ask the user ONE short, friendly question to get what you still need to write it — the angle or story, and where it should send people — tailored to what you see. Example: \"Looks like a C-P-A going from buried in returns to a full calendar. What's the angle, and should it send people to the VSL?\"",
        "3. Suggest one direction they could accept as is, in their voice, 1–2 sentences.",
        "Plain words, no jargon, no markdown.",
      ].join("\n"),
    },
  ];
  const raw = (await askClaude({
    system: `${context(args.firmName)}${args.firmBrief}`,
    content,
    schema: READ_SCHEMA,
    maxTokens: 4_000,
    effort: "low",
    refusal: "Claude couldn't read these frames.",
    tooLong: "Claude couldn't read these frames.",
    unreadable: "Claude couldn't read these frames. Try again.",
  })) as { scenes?: { label?: string; read?: string }[]; question?: string; suggestion?: string };
  return {
    frames: frames.map((f) => f.id),
    reads: frames.map((_, i) => ({
      label: (raw.scenes?.[i]?.label ?? "").trim().slice(0, 60),
      read: (raw.scenes?.[i]?.read ?? "").trim().slice(0, 300),
    })),
    question: (raw.question ?? "").trim().slice(0, 400) || "What's this video about, and where should it send people?",
    suggestion: (raw.suggestion ?? "").trim().slice(0, 600),
  };
}

// ── Storyboard: Claude splits the story into scenes for Manus ───────────

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenes", "notes"],
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keep", "label", "shot"],
        properties: { keep: { type: "integer" }, label: STR, shot: STR },
      },
    },
    notes: STR,
  },
} as const;

const STORYBOARD = `
---

# Planning the scenes of a story video (Creative Studio)

Before any script is written, plan the scenes this story moves through. Each scene is one place and moment with its own opening frame; an image maker (Manus) makes the frames from your shot lines, and the script is written from those frames afterwards.

- Split the user's story into 3–6 scenes (never more than ${MAX_SCENES}), in story order. Follow the framework's structure for the format: an ad hooks in the first scene and still ends on the qualifier and call to action unless the user's direction says otherwise. Think in places and moments: where we are, who's there, what the presenter is doing.
- label: 2–4 words.
- shot: one line for the image maker: the place, the presenter (by name) with outfit, pose and expression, anyone else in the frame, the camera (locked-off on a stand, a selfie the presenter holds, or handheld), and the light. A scene can have nobody in it (a calendar, a street), or other people. Keep the presenter's look consistent unless the story changes it (a different day, a different outfit).
- Scenes the user already has (their frames are attached, labeled "Scene N, keep") stay in the plan: list them with keep = N, where they belong in the story (normally the order given), with a short label; their shot can be "". New scenes have keep = 0.
- notes: one or two plain sentences on the story arc, scene by scene.`;

export async function planScenes(args: {
  direction: string;
  note: string;
  format: CreativeFormat;
  presenter: PresenterInfo;
  firmBrief: string;
  /** Scenes that already have a frame (kept), with signed URLs. */
  kept: { label: string; url: string }[];
  /** The current plan for scenes without a frame yet (when re-planning). */
  planned: { label: string; shot: string }[];
}): Promise<{ scenes: { keep: number; label: string; shot: string }[]; notes: string }> {
  const content: Anthropic.ContentBlockParam[] = [
    ...args.kept.flatMap((k, i) => [
      { type: "text" as const, text: `Scene ${i + 1}, keep${k.label ? ` (${k.label})` : ""}:` },
      { type: "image" as const, source: { type: "url" as const, url: k.url } },
    ]),
    {
      type: "text",
      text: [
        `Format: ${args.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}`,
        `The presenter: ${args.presenter.name || "the person in the frames"} (${args.presenter.pronoun === "he" ? "he/him" : "she/her"})${args.presenter.look ? `. How they look: ${args.presenter.look}` : ""}`,
        `The story, in the user's words:\n${args.direction.trim()}`,
        args.planned.length
          ? `Current plan for the scenes without frames yet:\n${args.planned.map((p, i) => `- ${p.label || `Scene ${i + 1}`}: ${p.shot}`).join("\n")}`
          : "",
        args.note ? `What the user wants changed in the plan: ${args.note}` : "Plan the scenes.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  const system = args.firmBrief ? `${withoutNexliSections(KLING_FRAMEWORK)}${STORYBOARD}${args.firmBrief}` : `${KLING_FRAMEWORK}${STORYBOARD}`;
  const raw = (await askClaude({
    system,
    content,
    schema: PLAN_SCHEMA,
    maxTokens: 8_000,
    effort: "medium",
    refusal: "Claude declined to plan these scenes. Try rewording the story.",
    tooLong: "The plan came out too long. Try a shorter story.",
    unreadable: "Claude returned an unreadable plan. Please try again.",
  })) as { scenes?: { keep?: number; label?: string; shot?: string }[]; notes?: string };
  const scenes = (raw.scenes ?? [])
    .map((x) => ({
      keep: Number.isInteger(x?.keep) ? (x!.keep as number) : 0,
      label: (x?.label ?? "").trim().slice(0, 80),
      shot: (x?.shot ?? "").trim().slice(0, 1200),
    }))
    .filter((x) => x.keep > 0 || x.shot);
  if (scenes.length === 0) throw new Error("Claude returned no scenes. Please try again.");
  return { scenes, notes: (raw.notes ?? "").trim().slice(0, 1200) };
}

/**
 * The new scene list from Claude's plan: kept scenes (they have frames) where
 * Claude put them, new ones as planned slots, every framed scene kept even if
 * Claude left it out, and planned slots dropped from the end past the limit.
 */
export function mergePlan(
  current: SceneSlot[],
  planned: { keep: number; label: string; shot: string }[],
  newId: () => string,
  max = MAX_SCENES
): SceneSlot[] {
  const framed = current.filter((sc) => sc.frameId);
  const used = new Set<string>();
  const next: SceneSlot[] = [];
  for (const x of planned) {
    const kept = x.keep > 0 ? framed[x.keep - 1] : undefined;
    if (kept && !used.has(kept.id)) {
      used.add(kept.id);
      next.push({ ...kept, label: kept.label || x.label });
    } else if (!kept && x.shot) {
      next.push({ id: newId(), label: x.label, shot: x.shot, frameId: null });
    }
  }
  for (const sc of framed) if (!used.has(sc.id)) next.push(sc);
  while (next.length > max) {
    const at = next.map((sc) => !sc.frameId).lastIndexOf(true);
    if (at < 0) break;
    next.splice(at, 1);
  }
  return next;
}
