import Anthropic from "@anthropic-ai/sdk";
import { KLING_FRAMEWORK } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import { clampPhotoCount, FEED_SIZE, STORY_SIZE } from "@/lib/creative-studio/photo-ads-shared";

/**
 * Photo ads: Claude turns one prompt into up to 20 genuinely different static
 * ad concepts (headline + Daniela's scene + look); after the user's quick
 * review, Manus makes each one as a finished ad in a Story and a Feed size.
 */

const MODEL = "claude-opus-5-5";

export { clampPhotoCount, FEED_SIZE, PHOTO_MAX, STORY_SIZE } from "@/lib/creative-studio/photo-ads-shared";

const PLAN_ADDENDUM = `
---

# Planning static photo ads inside the Nexli portal

This time the user wants static image ads for Facebook and Instagram, not videos — several at once from one idea, to test against each other. Every ad is a photo of Daniela with a short headline on it; a designer makes each one in a Story (9:16) and a Feed (4:5) size. Everything about angles, hooks, beliefs to shift and the standing rules still applies; the clip, Kling and pronunciation sections don't.

Plan exactly the number of ads asked for. Make them genuinely different so the test teaches something: different angles or old beliefs (§2, §3), different hook styles (a question, a bold claim, a number, a call-out of who it's for, a contrarian line, a before/after), different scenes and looks. No near-duplicates and no headline reworded twice.

For each ad return:
- title — a 2–5 word working title.
- angle — one sentence: the angle and why it should stop this audience mid-scroll.
- headline — the words on the image. 3–9 words, at most 60 characters, readable in one glance on a phone. Written text, so spell it "CPA" (the C-P-A spelling is only for spoken lines). No hashtags, no emojis.
- subline — an optional small line under the headline (at most 12 words), usually the call to action or the qualifier. Use "" when the headline stands alone.
- scene — Daniela's photo for the designer, in one or two sentences: where she is, what she's wearing, pose and expression, what she's holding or doing, the camera framing, and where the clean space for the text is. If the user named a setting, keep it for every ad and vary only the details; otherwise vary the setting between ads.
- look — the type and colour treatment in one line (e.g. "bold white condensed sans on a dark navy band across the top, cyan highlight on the key number").

notes — one or two plain sentences on how you split the idea.

The §1 copy guardrails apply to every headline and subline: no guarantees or promised results, no savior positioning, no unverifiable claims, "investment" never "price". Use only facts you were given (the §9 offer facts, or the firm's facts in a client studio, or the user's words); never invent numbers, results or prices.
`;

const SYSTEM = `${KLING_FRAMEWORK}\n${PLAN_ADDENDUM}`;

/** Client studios: whoever is in the studio's reference pictures, never Daniela. */
const forClient = (text: string) => text.replace(/\bDaniela's\b/g, "the presenter's").replace(/\bDaniela\b/g, "the presenter");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ads", "notes"],
  properties: {
    ads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "angle", "headline", "subline", "scene", "look"],
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
          headline: { type: "string" },
          subline: { type: "string" },
          scene: { type: "string" },
          look: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

export interface PhotoConcept {
  title: string;
  angle: string;
  headline: string;
  subline: string;
  scene: string;
  look: string;
}

export const CONCEPT_LIMITS = { title: 120, angle: 600, headline: 90, subline: 140, scene: 900, look: 300 } as const;

/** Trim each field to its limit; drop concepts without a headline or scene. */
export function cleanConcepts(ads: Partial<PhotoConcept>[], count: number): PhotoConcept[] {
  const f = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  return ads
    .map((a) => ({
      title: f(a.title, CONCEPT_LIMITS.title) || "Photo ad",
      angle: f(a.angle, CONCEPT_LIMITS.angle),
      headline: f(a.headline, CONCEPT_LIMITS.headline),
      subline: f(a.subline, CONCEPT_LIMITS.subline),
      scene: f(a.scene, CONCEPT_LIMITS.scene),
      look: f(a.look, CONCEPT_LIMITS.look),
    }))
    .filter((a) => a.headline && a.scene)
    .slice(0, count);
}

export async function planPhotoAds(args: {
  prompt: string;
  count: number;
  /** A client studio's firm brief (studios.ts firmBrief); empty for Nexli. */
  firm?: string;
}): Promise<{ ads: PhotoConcept[]; notes: string }> {
  const count = clampPhotoCount(args.count);
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 16_000,
    // A client studio's presenter isn't Daniela (and isn't decided yet): "the presenter".
    system: args.firm ? `${withoutNexliSections(KLING_FRAMEWORK)}\n${forClient(PLAN_ADDENDUM)}${args.firm}` : SYSTEM,
    messages: [
      {
        role: "user",
        content: `Make ${count} static photo ad${count > 1 ? "s" : ""}.\n\nThe user's idea, in their words:\n${args.prompt.trim()}\n\nPlan the ${count} ad${count > 1 ? "s" : ""}.`,
      },
    ],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];
  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to plan these ads. Try rewording the prompt.");
  if (message.stop_reason === "max_tokens") throw new Error("The plan came back cut off. Try fewer ads or a shorter prompt.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let raw: { ads?: Partial<PhotoConcept>[]; notes?: string };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Claude returned an unreadable plan. Please try again.");
  }
  const ads = cleanConcepts(raw.ads ?? [], count);
  if (!ads.length) throw new Error("Claude didn't come back with any ads. Try again.");
  return { ads, notes: (raw.notes ?? "").trim().slice(0, 1000) };
}

/** What Manus is asked to make for one concept: the same ad in both sizes. */
export function photoAdPrompt(concept: PhotoConcept & { note?: string | null }, opts: { client: boolean; hasReferences: boolean }): string {
  const ad = opts.client ? { ...concept, scene: forClient(concept.scene), look: forClient(concept.look) } : concept;
  const who = opts.client ? "the presenter" : "Daniela";
  const reference = opts.client
    ? "The attached photos are reference pictures of the presenter. It must clearly be the same person: same face, hair, skin tone and build."
    : opts.hasReferences
      ? "The attached photos are reference images of Daniela. She must clearly be the same woman: same face, hair, skin tone and build."
      : "Daniela is a confident woman in her thirties with long dark wavy hair.";
  const words = [`Headline: "${ad.headline}"`, ad.subline ? `Small line under it: "${ad.subline}"` : null].filter(Boolean).join("\n");
  return [
    `Create one finished static Facebook/Instagram ad, in two sizes. Both files are the same ad — the same photo of ${who}, the same words and the same look — laid out for each size.`,
    reference,
    `The photo: ${ad.scene}`,
    `The words on the ad, exactly as written here (same spelling, capitals and punctuation; add no other words):\n${words}`,
    ad.look ? `The look: ${ad.look}` : null,
    ad.note?.trim() ? `Changes asked for since the last version: ${ad.note.trim()}` : null,
    [
      "The two files:",
      `1. story.png — exactly ${STORY_SIZE.width}×${STORY_SIZE.height} pixels (9:16, for Stories and Reels). Keep the top 250 px and the bottom 340 px free of text, because Instagram covers them.`,
      `2. feed.png — exactly ${FEED_SIZE.width}×${FEED_SIZE.height} pixels (4:5, for the Feed).`,
    ].join("\n"),
    [
      "How to make it:",
      `- The photo is photorealistic: natural light, realistic skin, hair and fabric, ${who} with a natural, confident expression, and clean space in the composition where the text goes.`,
      "- Put the words on with a design tool or code (for example HTML/CSS rendered to PNG, or an image library) — not inside the AI image generator — so every letter is crisp and spelled exactly. Big, bold, high contrast and easy to read on a phone; at most two fonts.",
      "- No logos, watermarks, fake buttons, fake app screens, emojis or any text besides the words above.",
    ].join("\n"),
    "Attach exactly two PNG files named story.png and feed.png, at those exact pixel sizes, in your final message.",
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The automatic answer to Manus's first question on a photo ad. */
export const PHOTO_AUTO_REPLY =
  "This request comes from an automated tool, so nobody can answer questions. Please use your best judgment from the brief and the reference photos and make the ad now: attach story.png (1080×1920) and feed.png (1080×1350) in your final message.";

/** Which size an image is, from its name or its shape (Story 9:16, Feed 4:5). */
export function sizeOf(filename: string | null, width: number, height: number): "story" | "feed" | null {
  const name = (filename ?? "").toLowerCase();
  const ratio = height / Math.max(1, width);
  if (/story|9x16|9_16|1920/.test(name) && ratio > 1.5) return "story";
  if (/feed|4x5|4_5|1350/.test(name) && ratio > 1.1 && ratio <= 1.5) return "feed";
  if (ratio > 1.6 && ratio < 1.95) return "story";
  if (ratio > 1.15 && ratio <= 1.4) return "feed";
  return null;
}
