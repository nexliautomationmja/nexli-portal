import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { clampCount } from "@/lib/creative-studio/batch-shared";

/**
 * Batch planning: Claude splits one idea into N genuinely different videos
 * (angle, hook, old belief), each with its own brief and a one-line frame
 * shot for Manus. Nothing is created until the user approves the plan.
 */

const MODEL = "claude-opus-5-5";

const PLAN_ADDENDUM = `
---

# Planning a batch inside the Nexli portal

The user wants several videos made at once from one idea. Plan exactly the number they asked for. Each video must be genuinely different: its own angle, hook and old belief to shift (use §2 and §3 for what a strong angle is, and the §9 offer facts). Don't make near-duplicates or the same hook reworded.

For each video return:
- title — a short working title, 3–6 words.
- direction — the brief for that one video, written the way the user would describe a single video to you: what it's about, the angle, who it's for, the proof or math to use, the call to action, and any lines it must include. 2–5 sentences. Another writer will turn it into a full clip-by-clip script with this framework, so be specific.
- shot — one line describing Daniela's opening frame for an image generator: where she is, how she's seated or standing, framing. If the user asked for a setting (e.g. "lounge chair"), keep that setting for every video and vary only small details; otherwise vary the setting a little between videos.

notes — one or two plain sentences on how you split the idea.

Follow the §1 standing rules in every direction (C-P-A spelled with hyphens in spoken lines, "investment" never "price", no guarantees, no savior positioning).
`;

const SYSTEM = `${KLING_FRAMEWORK}\n${PLAN_ADDENDUM}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["videos", "notes"],
  properties: {
    videos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "direction", "shot"],
        properties: { title: { type: "string" }, direction: { type: "string" }, shot: { type: "string" } },
      },
    },
    notes: { type: "string" },
  },
} as const;

export interface PlannedVideo {
  title: string;
  direction: string;
  shot: string;
}

export async function planBatch(args: { brief: string; count: number; format: CreativeFormat }): Promise<{ videos: PlannedVideo[]; notes: string }> {
  const count = clampCount(args.format, args.count);
  const kind = args.format === "vsl_16x9" ? "VSLs (16:9 horizontal, single presenter)" : "ad creatives (9:16 vertical)";
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Make ${count} ${kind}.\n\nThe user's idea, in their words:\n${args.brief.trim()}\n\nPlan the ${count} videos.`,
      },
    ],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];
  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to plan this batch. Try rewording the idea.");
  if (message.stop_reason === "max_tokens") throw new Error("The plan came back cut off. Try fewer videos or a shorter idea.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let raw: { videos?: PlannedVideo[]; notes?: string };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Claude returned an unreadable plan. Please try again.");
  }
  return { videos: cleanPlan(raw.videos ?? [], count), notes: (raw.notes ?? "").trim() };
}

/** Trim, drop empty items, cap at `count`. */
export function cleanPlan(videos: PlannedVideo[], count: number): PlannedVideo[] {
  return videos
    .map((v) => ({
      title: (v.title ?? "").trim().slice(0, 120) || "Untitled video",
      direction: (v.direction ?? "").trim().slice(0, 4000),
      shot: (v.shot ?? "").trim().slice(0, 600),
    }))
    .filter((v) => v.direction)
    .slice(0, count);
}
