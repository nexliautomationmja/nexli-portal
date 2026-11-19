import { CAPS, RUBRIC } from "@/lib/ads/grader-shared";
import { askClaude } from "@/lib/creative-studio/script";
import { OFFER_FACTS, POINT_GUIDE } from "@/lib/creative-studio/recreate-focus";
import { SCRIPT_CAPS, toScriptScore, type RawScriptScore, type ScriptScore } from "@/lib/creative-studio/script-score-shared";
import type { CreativeFormat } from "@/lib/creative-studio/tables";

/**
 * Scores a written script out of 100 on the Ad Grader's seven points
 * (Nov 19 2026). Claude marks each point 0–10 with why and a fix; the
 * points, caps and total are computed in code (script-score-shared.ts).
 * Strict on purpose, like the grader: an untested script usually lands in
 * the 50s and 60s, and 80+ has to be earned line by line.
 */

const SYSTEM = `You score a video script for Nexli before any money is spent making it. Nexli sells the Digital Rainmaker System to owners of US CPA firms doing about 750K to 1 million a year: Meta ads, a funnel and a client portal, built and run for them, so they book calls with business owners who need tax planning.

Nexli's offer today:
${OFFER_FACTS}

Score each point 0–10 against what a 9–10 looks like:
${RUBRIC.map((r) => `- ${r.key} — ${r.label} (${r.weight} of 100): ${POINT_GUIDE[r.key]}.`).join("\n")}

For a VSL (16:9, landing-page video), "Built for Meta" means built for where it runs: does it hold a viewer on the page from line to line.

Caps — flag one only when it is plainly true of this script:
${SCRIPT_CAPS.map((k) => `- ${k}: ${CAPS[k].label} (the whole score can't pass ${CAPS[k].max})`).join("\n")}

Be strict and specific:
- A typical untested script scores 45–60. Give 8 or more only where the lines clearly earn it; 10 is rare.
- Judge the words on the page, not what an edit could add later.
- "why" says what is wrong first (or exactly what earns the mark), quoting or pointing at the clip. No praise words.
- "fix" is one concrete change, in a sentence.
- Never invent results or numbers. A script that promises results, guarantees or tax outcomes gets the policy_risk cap.
- Mentioning an older offer (a setup fee, $9,997, an annual plan, month to month, a first-month ad bonus) is wrong for "message".
- "verdict" is one blunt sentence a busy owner reads first.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subs", "caps", "verdict"],
  properties: {
    subs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "score", "why", "fix"],
        properties: {
          key: { type: "string", enum: RUBRIC.map((r) => r.key) },
          score: { type: "integer" },
          why: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
    caps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "why"],
        properties: { key: { type: "string", enum: [...SCRIPT_CAPS] }, why: { type: "string" } },
      },
    },
    verdict: { type: "string" },
  },
} as const;

export async function scoreScript(args: {
  key: string;
  title: string;
  format: CreativeFormat;
  clips: { section: string; line: string; register?: string; action?: string }[];
  /** His hook results (recreate-focus.ts), when they could be read. */
  evidence: string | null;
  prev: ScriptScore | null;
}): Promise<ScriptScore> {
  const lines = args.clips.map((c, i) => `${i + 1}. [${c.section}] ${c.line}`);
  const content = [
    `Format: ${args.format === "vsl_16x9" ? "VSL, 16:9 (a landing-page video that ends by booking a call)" : "ad, 9:16 vertical (Meta feed / Reels)"}`,
    `Title: ${args.title || "(untitled)"}`,
    `The first clip is what plays in the first 3 seconds.`,
    "",
    `The script, one clip per line:\n${lines.join("\n")}`,
    ...(args.evidence ? ["", `His hook results (judge the hook against these):\n${args.evidence}`] : []),
    "",
    "Score all seven points.",
  ].join("\n");
  const raw = (await askClaude({
    system: SYSTEM,
    content: [{ type: "text", text: content }],
    schema: SCHEMA,
    maxTokens: 6000,
    effort: "medium",
    refusal: "Claude declined to score this script.",
    tooLong: "The score came back too long. Try again.",
    unreadable: "The score came back unreadable. Try again.",
  })) as RawScriptScore;
  return toScriptScore(raw, { key: args.key, lines: args.clips.map((c) => c.line), prev: args.prev });
}
