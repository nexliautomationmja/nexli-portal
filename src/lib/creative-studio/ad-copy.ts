import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";

/**
 * Meta ad copy for a finished video: primary text (mid-length, spaced out,
 * with emojis), headline, description and CTA button, written from the
 * video's script and edit. Marcel's standing copy rules and current offer
 * facts come from his Kling framework (§1 and §9) so the ad says what the
 * video says.
 */

const MODEL = "claude-opus-5-5";

export const CTA_BUTTONS = ["Book Now", "Learn More", "Apply Now", "Get Quote", "Contact Us", "Sign Up"] as const;
export type CtaButton = (typeof CTA_BUTTONS)[number];

export interface AdCopy {
  primaryText: string;
  headline: string;
  description: string;
  cta: CtaButton;
  notes: string;
}

/** The framework section that starts at `start` (a heading prefix) up to the next "## ". */
function section(start: string): string {
  const i = KLING_FRAMEWORK.indexOf(start);
  if (i < 0) return "";
  const rest = KLING_FRAMEWORK.slice(i);
  const next = rest.indexOf("\n## ", 3);
  return (next > 0 ? rest.slice(0, next) : rest).trim();
}

const SYSTEM = `You write Meta (Facebook and Instagram) ad copy for Nexli, which runs paid-ads client acquisition for CPA firms. Each ad runs with one short talking-head video; the copy sits above it in the feed.

${section("## 1. Standing rules")}

${section("## 9. Current Nexli offer facts")}

Those rules were written for the spoken script. In written copy: write "CPA" (never C-P-A) and "IRS" (never I-R-S).

# The primary text — mid-length, spaced out, with emojis
- 80–140 words. Not a long-form ad and not a one-liner.
- The first line is the hook and must work on its own before Meta's "See more" cut (about 125 characters). It carries the video's idea in sharper words, not a transcript of the first clip.
- Short blocks of one or two sentences, with a blank line between every block. 5–8 blocks.
- 3–6 emojis in total, used as markers at the start of lines or bullets (for example ✅ 👉 📅 📈 💡 ⚠️), never several in a row and never mid-word.
- An optional 2–4 line emoji bullet list for the mechanism or what they get.
- End with one clear call to action line that matches the video's CTA.
- Match the video: same angle, same proof, same numbers. Use only figures that appear in the script or the offer facts. Leave the investment amount out unless the script says it.

# Meta ad policy
- Never assert or imply the reader's personal attributes or finances ("Are you broke?", "your failing firm"). Speak to the situation ("If your firm is stuck at…"), not to who they are.
- No guarantees, income claims or before/after promises. Soften absolutes.
- Don't mention Facebook or Instagram.

# Headline, description, button
- headline: 27–40 characters, the benefit or the outcome.
- description: 30 characters or fewer, supports the headline (for example "For CPA firms doing $750K+").
- cta: the button that fits the video's ask (a call → "Book Now").

notes: one or two plain sentences for the user: the angle you chose and anything to check (a claim, a number).

On a revision you get the current copy and the user's note: change only what the note asks for and keep the rest.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["primaryText", "headline", "description", "cta", "notes"],
  properties: {
    primaryText: { type: "string" },
    headline: { type: "string" },
    description: { type: "string" },
    cta: { type: "string", enum: [...CTA_BUTTONS] },
    notes: { type: "string" },
  },
} as const;

export interface CopyContext {
  title: string;
  direction: string;
  lines: { section: string; line: string }[];
  /** On-screen title / qualifier / CTA from the edit, when there is one. */
  onScreen: string[];
}

function contextText(c: CopyContext): string {
  return [
    `Video: ${c.title}`,
    `What it's about (the user's words): ${c.direction || "(not given)"}`,
    `Script, in order:\n${c.lines.map((l, i) => `${i + 1}. [${l.section}] ${l.line}`).join("\n") || "(no script)"}`,
    c.onScreen.length ? `On-screen text in the edit:\n${c.onScreen.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callClaude(content: string): Promise<AdCopy> {
  const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.create>[0];
  const message = (await client.beta.messages.create(params)) as Anthropic.Beta.BetaMessage;
  if (message.stop_reason === "refusal") throw new Error("Claude declined to write this copy. Try rewording the note.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as AdCopy;
  } catch {
    throw new Error("Claude returned unreadable copy. Please try again.");
  }
}

const EMOJI = /\p{Extended_Pictographic}/gu;
export const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}$]/u.test(w)).length;

/** Shape problems worth one retry: length, spacing, emoji count, hook length. */
function problems(c: AdCopy): string[] {
  const out: string[] = [];
  const words = wordCount(c.primaryText);
  if (words > 160) out.push(`The primary text is ${words} words; bring it to 80–140.`);
  if (words < 60) out.push(`The primary text is only ${words} words; bring it to 80–140.`);
  const blocks = c.primaryText.split(/\n\s*\n/).filter((b) => b.trim()).length;
  if (blocks < 4) out.push("Space it out: short blocks with a blank line between each.");
  const emojis = (c.primaryText.match(EMOJI) ?? []).length;
  if (emojis < 2) out.push("Add a few emojis as line markers (3–6 in total).");
  if (emojis > 8) out.push(`There are ${emojis} emojis; keep it to 3–6.`);
  const hook = c.primaryText.split("\n")[0] ?? "";
  if (hook.length > 140) out.push("The first line runs past Meta's 'See more' cut; shorten the hook.");
  return out;
}

function clean(c: AdCopy): AdCopy {
  return {
    primaryText: c.primaryText
      .replace(/\r/g, "")
      .replace(/C-P-A/g, "CPA")
      .replace(/I-R-S/g, "IRS")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    headline: c.headline.trim().slice(0, 60),
    description: c.description.trim().slice(0, 60),
    cta: CTA_BUTTONS.includes(c.cta) ? c.cta : "Book Now",
    notes: (c.notes ?? "").trim(),
  };
}

async function write(prompt: string): Promise<AdCopy> {
  let copy = clean(await callClaude(prompt));
  const issues = problems(copy);
  if (issues.length) copy = clean(await callClaude(`${prompt}\n\nYour previous draft:\n${JSON.stringify(copy)}\n\nFix these and return the full copy:\n- ${issues.join("\n- ")}`));
  return copy;
}

export function writeAdCopy(ctx: CopyContext): Promise<AdCopy> {
  return write(`${contextText(ctx)}\n\nWrite the Meta ad copy for this video.`);
}

export function reviseAdCopy(ctx: CopyContext, current: AdCopy, note: string): Promise<AdCopy> {
  return write(`${contextText(ctx)}\n\nCurrent copy:\n${JSON.stringify(current)}\n\nThe user's requested change: ${note}\n\nReturn the full copy with only that change made.`);
}
