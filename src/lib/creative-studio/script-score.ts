import { askClaude } from "@/lib/creative-studio/script";
import { OFFER_FACTS } from "@/lib/creative-studio/offer-facts";
import { CLAUDE_CHECKS, buildScore, type RawScriptScore, type ScriptScore } from "@/lib/creative-studio/script-score-shared";
import type { CreativeFormat } from "@/lib/creative-studio/tables";

/**
 * Scores a written script out of 100 on a fixed checklist
 * (script-score-shared.ts). Code measures 12 of the 19 checks from the
 * words; Claude only answers the 7 yes/no questions below, each with a
 * quote from the script that code then verifies. Points and the total are
 * computed in code, so the same script always gets the same score.
 */

const SYSTEM = `You check a video script for Nexli against a fixed checklist. Nexli sells the Digital Rainmaker System to owners of US CPA firms doing about 750K to 1 million a year: Meta ads, a funnel and a client portal, built and run for them, so they book calls with business owners who need tax planning.

Nexli's offer today:
${OFFER_FACTS}

You answer only yes/no questions about the words on the page. Rules:
- Answer each question with pass (true/false), the clip number, and a quote copied EXACTLY from that clip (at least 3 words, same words in the same order). Your answer is checked against the script: a quote that isn't in that clip makes the answer not count.
- Be strict and literal: judge what the lines say, not what an edit or a delivery could add. When in doubt, pass=false for a question that asks whether something is there.
- When pass is false (or, for the "run of 5+ clips" question, when you found such a run), "fix" is one concrete change in a sentence that would make it pass, pointing at the clip. Otherwise "fix" is "".
- "verdict" is one blunt sentence on the script as a whole. No praise words.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["checks", "verdict"],
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "pass", "clip", "quote", "fix"],
        properties: {
          id: { type: "string", enum: CLAUDE_CHECKS.map((c) => c.id) },
          pass: { type: "boolean" },
          clip: { type: "integer" },
          quote: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
    verdict: { type: "string" },
  },
} as const;

export async function scoreScript(args: {
  key: string;
  title: string;
  format: CreativeFormat;
  clips: { section: string; line: string }[];
  /** The reference video's words (for the "copied from the reference" check), when there's one. */
  referenceText: string | null;
  prev: ScriptScore | null;
}): Promise<ScriptScore> {
  const lines = args.clips.map((c, i) => `Clip ${i + 1} [${c.section}]: ${c.line}`);
  const questions = CLAUDE_CHECKS.map((c) => `- ${c.id}: ${c.question}`).join("\n");
  const content = [
    `Format: ${args.format === "vsl_16x9" ? "VSL, 16:9 (a landing-page video that ends by booking a call)" : "ad, 9:16 vertical (Meta feed / Reels), pointing to a VSL"}`,
    `Title: ${args.title || "(untitled)"}`,
    "",
    `The script:\n${lines.join("\n")}`,
    "",
    `Answer every question (one entry per id):\n${questions}`,
  ].join("\n");
  const raw = (await askClaude({
    system: SYSTEM,
    content: [{ type: "text", text: content }],
    schema: SCHEMA,
    maxTokens: 6000,
    effort: "medium",
    refusal: "Claude declined to check this script.",
    tooLong: "The check came back too long. Try again.",
    unreadable: "The check came back unreadable. Try again.",
  })) as RawScriptScore;
  return buildScore({ key: args.key, clips: args.clips, format: args.format, referenceText: args.referenceText, raw, prev: args.prev });
}
