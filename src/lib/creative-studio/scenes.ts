import type Anthropic from "@anthropic-ai/sdk";
import { askClaude } from "@/lib/creative-studio/script";
import type { CreativeFormat, PresenterInfo, SceneAsk } from "@/lib/creative-studio/tables";

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
