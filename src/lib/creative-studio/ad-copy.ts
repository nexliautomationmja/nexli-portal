import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";

/**
 * Meta ad copy: 4 primary texts (mid-length, spaced out, with emojis — each
 * with a different hook) and 4 headlines, plus a description and CTA button.
 * Written from a studio video's script and edit, or from any video or image
 * dropped into the Ad copy tool (transcript + frames). Marcel's standing copy
 * rules and current offer facts come from his Kling framework (§1 and §9).
 */

const MODEL = "claude-opus-5-5";
const VARIANTS = 4;

export const CTA_BUTTONS = ["Book Now", "Learn More", "Apply Now", "Get Quote", "Contact Us", "Sign Up"] as const;
export type CtaButton = (typeof CTA_BUTTONS)[number];

export interface AdCopy {
  primaryTexts: string[];
  headlines: string[];
  description: string;
  cta: CtaButton;
  notes: string;
}

/** One saved version of the copy (with the change request that produced it). */
export type AdCopyVersion = AdCopy & { version: number; note: string | null };

/** Read a saved version, including single-copy rows from before variations. */
export function normalizeCopy(raw: unknown): AdCopyVersion {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (many: unknown, one: unknown) =>
    Array.isArray(many) ? many.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) : typeof one === "string" && one.trim() ? [one] : [];
  return {
    primaryTexts: list(r.primaryTexts, r.primaryText),
    headlines: list(r.headlines, r.headline),
    description: typeof r.description === "string" ? r.description : "",
    cta: CTA_BUTTONS.includes(r.cta as CtaButton) ? (r.cta as CtaButton) : "Book Now",
    notes: typeof r.notes === "string" ? r.notes : "",
    version: typeof r.version === "number" ? r.version : 1,
    note: typeof r.note === "string" ? r.note : null,
  };
}

/** The framework section that starts at `start` (a heading prefix) up to the next "## ". */
function section(start: string): string {
  const i = KLING_FRAMEWORK.indexOf(start);
  if (i < 0) return "";
  const rest = KLING_FRAMEWORK.slice(i);
  const next = rest.indexOf("\n## ", 3);
  return (next > 0 ? rest.slice(0, next) : rest).trim();
}

const SYSTEM = `You write Meta (Facebook and Instagram) ad copy for Nexli, which runs paid-ads client acquisition for CPA firms. The copy sits above one video or image in the feed. You get what's in the ad: a studio video's script, or the transcript and frames of a video (or the image itself) the user dropped in.

${section("## 1. Standing rules")}

${section("## 9. Current Nexli offer facts")}

Those rules were written for the spoken script. In written copy: write "CPA" (never C-P-A) and "IRS" (never I-R-S).

# ${VARIANTS} primary texts — each mid-length, spaced out, with emojis
Write ${VARIANTS} versions for A/B testing. Every version follows the same style; they differ in the hook and angle (for example a question, a bold contrarian claim, a short story opener, a number-led hook). Don't make near-duplicates.
- 80–140 words each. Not a long-form ad and not a one-liner.
- The first line is the hook and must work on its own before Meta's "See more" cut (about 125 characters). It carries the ad's idea in sharper words, not a transcript of its first line.
- Short blocks of one or two sentences, with a blank line between every block. 5–8 blocks.
- 3–6 emojis in total, used as markers at the start of lines or bullets (for example ✅ 👉 📅 📈 💡 ⚠️), never several in a row and never mid-word.
- An optional 2–4 line emoji bullet list for the mechanism or what they get.
- End with one clear call to action line that matches the ad's ask.
- Match the ad: same angle, same proof, same numbers. Use only figures that appear in what you were given or the offer facts. Leave the investment amount out unless the ad says it.

# Meta ad policy
- Never assert or imply the reader's personal attributes or finances ("Are you broke?", "your failing firm"). Speak to the situation ("If your firm is stuck at…"), not to who they are.
- No guarantees, income claims or before/after promises. Soften absolutes.
- Don't mention Facebook or Instagram.

# ${VARIANTS} headlines, a description, a button
- headlines: ${VARIANTS} different ones, 27–40 characters each, the benefit or the outcome, each from a different angle.
- description: 30 characters or fewer, supports the headlines (for example "For CPA firms doing $750K+").
- cta: the button that fits the ad's ask (a call → "Book Now").

notes: one or two plain sentences for the user: the angles you chose and anything to check (a claim, a number, a word you weren't sure you heard right).

On a revision you get the current copy and the user's note: change only what the note asks for (across all versions unless it names one) and keep the rest.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["primaryTexts", "headlines", "description", "cta", "notes"],
  properties: {
    primaryTexts: { type: "array", items: { type: "string" } },
    headlines: { type: "array", items: { type: "string" } },
    description: { type: "string" },
    cta: { type: "string", enum: [...CTA_BUTTONS] },
    notes: { type: "string" },
  },
} as const;

export interface CopyContext {
  title?: string;
  direction?: string;
  /** A studio video's script, in order. */
  lines?: { section: string; line: string }[];
  /** On-screen text in the studio edit. */
  onScreen?: string[];
  /** What's said in a dropped-in video (Scribe). */
  transcript?: string;
  /** Frames of a dropped-in video, or the image itself. */
  images?: { mediaType: "image/jpeg" | "image/png"; data: string }[];
  /** What the user wants pushed (offer, audience…). */
  note?: string;
  /** What was dropped in, when it isn't a studio video. */
  media?: "video" | "image";
  /** Set in a client firm's studio: the copy sells the firm, never Nexli. */
  firm?: { name: string; brief: string };
}

function contextText(c: CopyContext): string {
  return [
    c.title ? `Video: ${c.title}` : "",
    c.direction ? `What it's about (the user's words): ${c.direction}` : "",
    c.lines?.length ? `Script, in order:\n${c.lines.map((l, i) => `${i + 1}. [${l.section}] ${l.line}`).join("\n")}` : "",
    c.onScreen?.length ? `On-screen text in the edit:\n${c.onScreen.join("\n")}` : "",
    c.media === "video"
      ? `The user dropped in a video. ${c.images?.length ?? 0} frames from it are attached, in order.\nWhat's said in it (transcript):\n${c.transcript?.trim() || "(no speech found)"}`
      : "",
    c.media === "image" ? "The user dropped in an image (attached). Read any text on it and what it shows." : "",
    c.note ? `What the user wants this copy to push: ${c.note}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const NEXLI_INTRO = "for Nexli, which runs paid-ads client acquisition for CPA firms.";

/** Nexli: the prompt above, exactly. A client firm: about the firm, without Nexli's offer facts. */
export function adCopySystem(firm?: CopyContext["firm"]): string {
  if (!firm) return SYSTEM;
  return (
    SYSTEM.replace(NEXLI_INTRO, () => `for ${firm.name}, one of Nexli's client firms (Nexli makes the firm's ads; the copy sells the firm).`).replace(
      `${section("## 9. Current Nexli offer facts")}\n\n`,
      ""
    ) + firm.brief
  );
}

async function callClaude(content: Anthropic.ContentBlockParam[], firm?: CopyContext["firm"]): Promise<AdCopy> {
  const client = new Anthropic({ timeout: 200_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 8000,
    system: adCopySystem(firm),
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];
  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to write this copy. Try rewording the note.");
  if (message.stop_reason === "max_tokens") throw new Error("The copy came back cut off. Please try again.");
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

/** Shape problems worth one retry, per primary text: length, spacing, emoji count, hook length. */
export function problems(c: AdCopy): string[] {
  const out: string[] = [];
  if (c.primaryTexts.length < VARIANTS) out.push(`Write ${VARIANTS} primary texts (got ${c.primaryTexts.length}).`);
  if (c.headlines.length < VARIANTS) out.push(`Write ${VARIANTS} headlines (got ${c.headlines.length}).`);
  c.primaryTexts.forEach((t, i) => {
    const n = `Primary text ${i + 1}`;
    const words = wordCount(t);
    if (words > 160) out.push(`${n} is ${words} words; bring it to 80–140.`);
    if (words < 60) out.push(`${n} is only ${words} words; bring it to 80–140.`);
    if (t.split(/\n\s*\n/).filter((b) => b.trim()).length < 4) out.push(`${n}: space it out — short blocks with a blank line between each.`);
    const emojis = (t.match(EMOJI) ?? []).length;
    if (emojis < 2) out.push(`${n}: add a few emojis as line markers (3–6 in total).`);
    if (emojis > 8) out.push(`${n} has ${emojis} emojis; keep it to 3–6.`);
    if ((t.split("\n")[0] ?? "").length > 140) out.push(`${n}: the first line runs past Meta's "See more" cut; shorten the hook.`);
  });
  c.headlines.forEach((h, i) => {
    if (h.length > 45) out.push(`Headline ${i + 1} is ${h.length} characters; keep it to 27–40.`);
  });
  return out;
}

const tidy = (s: string) => s.replace(/\r/g, "").replace(/C-P-A/g, "CPA").replace(/I-R-S/g, "IRS");

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase().replace(/\s+/g, " ").trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clean(c: AdCopy): AdCopy {
  return {
    primaryTexts: uniq((Array.isArray(c.primaryTexts) ? c.primaryTexts : []).map((t) => tidy(t).replace(/\n{3,}/g, "\n\n").trim())).slice(0, VARIANTS),
    headlines: uniq((Array.isArray(c.headlines) ? c.headlines : []).map((h) => tidy(h).trim().slice(0, 60))).slice(0, VARIANTS),
    description: tidy(c.description ?? "").trim().slice(0, 60),
    cta: CTA_BUTTONS.includes(c.cta) ? c.cta : "Book Now",
    notes: (c.notes ?? "").trim(),
  };
}

function blocks(ctx: CopyContext, text: string): Anthropic.ContentBlockParam[] {
  const imgs: Anthropic.ContentBlockParam[] = (ctx.images ?? []).slice(0, 8).map((im) => ({
    type: "image",
    source: { type: "base64", media_type: im.mediaType, data: im.data },
  }));
  return [...imgs, { type: "text", text }];
}

async function write(ctx: CopyContext, ask: string): Promise<AdCopy> {
  const prompt = `${contextText(ctx)}\n\n${ask}`;
  let copy = clean(await callClaude(blocks(ctx, prompt), ctx.firm));
  const issues = problems(copy);
  if (issues.length) {
    copy = clean(
      await callClaude(
        blocks(ctx, `${prompt}\n\nYour previous draft:\n${JSON.stringify(copy)}\n\nFix these and return the full copy:\n- ${issues.join("\n- ")}`),
        ctx.firm
      )
    );
  }
  if (copy.primaryTexts.length === 0 || copy.headlines.length === 0) throw new Error("Claude didn't return usable copy. Please try again.");
  return copy;
}

export function writeAdCopy(ctx: CopyContext): Promise<AdCopy> {
  return write(ctx, `Write the Meta ad copy for this ad: ${VARIANTS} primary texts and ${VARIANTS} headlines.`);
}

export function reviseAdCopy(ctx: CopyContext, current: AdCopy, note: string): Promise<AdCopy> {
  const { primaryTexts, headlines, description, cta } = current;
  return write(
    ctx,
    `Current copy:\n${JSON.stringify({ primaryTexts, headlines, description, cta })}\n\nThe user's requested change: ${note}\n\nReturn the full copy (${VARIANTS} primary texts, ${VARIANTS} headlines) with only that change made.`
  );
}
