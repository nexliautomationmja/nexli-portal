import Anthropic from "@anthropic-ai/sdk";
import { EDITING_RULES } from "@/lib/creative-studio/rules.generated";
import { RIG_LABEL } from "@/lib/creative-studio/prompts";
import type { CreativeFormat, CreativeRig, FramePosition } from "@/lib/creative-studio/tables";
import type { CaptionWord, EditOverlays, EditStyle, LadderRung, TimedText, VslCard, Zoom } from "@/remotion/types";
import { normalizeWord } from "@/lib/creative-studio/words";

/**
 * Claude lays out the on-screen graphics for one finished cut, following
 * Marcel's editing rulebook verbatim. The Remotion compositions are fixed
 * (one per style), so Claude only decides what each slot says and when it is
 * on screen; the portal then clamps and sequences the times in code.
 */

const MODEL = "claude-opus-5-5";

// Appended after the verbatim rulebook: how it maps onto the portal's fixed compositions.
const EDIT_ADDENDUM = `
---

# Working inside the Nexli portal (Creative Studio → Edit)

You lay out the graphics for one finished cut. The portal has already done rulebook steps 1–4 (constant-frame-rate cut with processed audio, word timings, the words file) and renders with fixed Remotion compositions, one per style, with the geometry already measured. You decide only WHAT each slot says and WHEN it is on screen. All times are seconds on the cut's timeline (0 = first frame). Captions are automatic (3-word chunks from the words file) in every style except POV.

Fill only the slots of the chosen style; return null / [] for every other slot.
- solo — title only: one persistent title banner, normally from 0 to the end of the video. No qualifier, CTA, rungs, stickers or cards.
- pov — stickers only: Instagram-style white text stickers, one on screen at a time, 1–4 in total, each 10 words or fewer, written the way a person types a sticker (sentence case). No captions run in this style.
- ladder — title (opens the video), one rung per person (position must be one of the positions listed; pill = the price or outcome, 10 characters or fewer, e.g. "$250K" or "10 HRS/WK"; tag = the client type, 3 words or fewer, e.g. "SHOEBOX CLIENTS"; a rung pops in when that person starts speaking and normally stays to the end), the red qualifier band early (inside the first quarter of the video, 2.5–5 s), and the CTA in the last 2–4 s. The qualifier and the CTA share one slot: never overlap them.
- vsl — cards only, one left-column slot, sequenced so two cards are never on screen at once. kind: point (a sharper distillation of an idea), stat (a number she makes the case with), qualifier (who it's for, placed early, around 0:10, not where she says it), cta (at the end: a short directional line like "Pick a time below"; the renderer adds the arrow; sub null). About 3–8 cards for a 3–5 minute VSL, fewer for a shorter one. Long unadorned stretches are the point.
- custom — "your way": the user describes the edit in their own words (the instruction). Every slot is available: title, qualifier, cta, rungs (vertical, 2–3 people only), stickers, cards, plus captions on/off and zooms (punch-ins on the plate: {start, end, scale 1.05–1.3}, at least 0.8 s each, on the moments the instruction names or, if it asks for zooms generally, on the strongest beats — never more than one every 4 s). Build exactly what the instruction asks for and nothing it doesn't. Where the instruction conflicts with the rulebook, the user's instruction wins: build it and say so once in notes.

captions: true when captions run. Default true for solo, vsl, ladder and custom; false for pov. Only set it false in custom when the user asks for no captions.
zooms: [] unless the style is custom.

Writing rules:
- Never restate the caption running underneath. A title or card uses words that are not being spoken in that moment; check the words list around each window. The title is a distillation, not a quote.
- Title: 2–6 words, 36 characters or fewer, normal case (the renderer sets ALL CAPS).
- Figures as digits ($9,997). Use only figures that appear in the words or the script — never invent numbers or results. No guarantees, no savior positioning, "investment" never "price". Write CPA, never C-P-A.
- Each element stays on screen at least 1.5 s (stickers and cards at least 2.5 s).
- Silence on screen is a legitimate choice. Don't pad.

notes: up to four plain sentences for the user — your judgment calls (where you put the qualifier and why, a word that looks misheard, anything to check before rendering).

swaps: caption-text corrections only. On a first layout return []. On a revision, when the user's note is about caption wording ("the caption says CALCULATING, it should be CALENDAR"), return {find, replace} with the caption tokens as they appear (ALL CAPS, multi-word allowed) and keep the layout as it is.

Where things sit on screen is set by the user tapping on the preview (the "layout" field you may see in the current layout; you can't change it). If a note only asks to move something, keep the layout as it is and say in notes to use Move on the preview.

Revisions: you get the current layout and the user's note. Change only what the note asks for; return everything else exactly as it was — including the times. Times the user set by hand (a sticker or the qualifier on for the whole video, overlapping on purpose) are deliberate: keep them unless the note is about timing. If the note asks for something the current style has no slot for (zooms, captions off, a sticker in a ladder, a title in POV…), do it anyway with the slot it needs — the portal then switches the edit to the custom composition, which renders every slot.
`;

const SYSTEM = `${EDITING_RULES}\n${EDIT_ADDENDUM}`;

const STR = { type: "string" } as const;
const NUM = { type: "number" } as const;
const TIMED = {
  type: "object",
  additionalProperties: false,
  required: ["text", "start", "end"],
  properties: { text: STR, start: NUM, end: NUM },
} as const;
const TIMED_OR_NULL = { anyOf: [TIMED, { type: "null" }] } as const;

const LAYOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "qualifier", "cta", "rungs", "stickers", "cards", "captions", "zooms", "swaps", "notes"],
  properties: {
    captions: { type: "boolean" },
    zooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["start", "end", "scale"],
        properties: { start: NUM, end: NUM, scale: NUM },
      },
    },
    title: TIMED_OR_NULL,
    qualifier: TIMED_OR_NULL,
    cta: TIMED_OR_NULL,
    rungs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "pill", "tag", "start", "end"],
        properties: {
          position: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
          pill: STR,
          tag: STR,
          start: NUM,
          end: NUM,
        },
      },
    },
    stickers: { type: "array", items: TIMED },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text", "sub", "start", "end"],
        properties: {
          kind: { type: "string", enum: ["point", "stat", "qualifier", "cta"] },
          text: STR,
          sub: { type: ["string", "null"] },
          start: NUM,
          end: NUM,
        },
      },
    },
    swaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["find", "replace"],
        properties: { find: STR, replace: STR },
      },
    },
    notes: STR,
  },
} as const;

interface RawLayout {
  title: TimedText | null;
  qualifier: TimedText | null;
  cta: TimedText | null;
  rungs: Omit<LadderRung, "nudgeX">[];
  stickers: TimedText[];
  cards: (VslCard & { sub: string | null })[];
  captions: boolean;
  zooms: Zoom[];
  swaps: { find: string; replace: string }[];
  notes: string;
}

export interface EditContext {
  style: EditStyle;
  format: CreativeFormat;
  rig: CreativeRig;
  durationS: number;
  direction: string;
  positions: FramePosition[];
  /** Script lines, with their window on the cut when known (auto-cut). */
  lines: { number: number; section: string; speaker: string | null; line: string; start: number | null; end: number | null }[];
  words: CaptionWord[];
  /** "Your way": how the user wants it edited, in their words. */
  instruction?: string;
  /** A client studio's firm brief (studios.ts firmBrief); empty for Nexli. */
  firm?: string;
}

const t2 = (n: number) => n.toFixed(2);

function contextText(c: EditContext): string {
  const people = c.positions.length
    ? c.positions.map((p) => `${p.position}: ${p.shortName} (${p.who})`).join("\n")
    : "One presenter (Daniela).";
  const lines = c.lines
    .map((l) => {
      const when = l.start !== null && l.end !== null ? ` ${t2(l.start)}–${t2(l.end)}s` : "";
      return `${l.number}. [${l.section}${l.speaker ? ` · ${l.speaker}` : ""}]${when} ${l.line}`;
    })
    .join("\n");
  const words = c.words.map((w) => `[${t2(w.start)}]${w.word}`).join(" ");
  return [
    `Style: ${c.style}`,
    `Format: ${c.format === "vsl_16x9" ? "landscape VSL 1920×1080" : "vertical ad 1080×1920"} · rig: ${RIG_LABEL[c.rig]}`,
    `Duration: ${t2(c.durationS)} s`,
    `What the video is about (the user's words): ${c.direction || "(not given)"}`,
    `People in the frame:\n${people}`,
    `Script${c.lines.some((l) => l.start !== null) ? " (with each clip's window on the cut)" : " (the cut was uploaded, so windows are unknown — use the words)"}:\n${lines || "(no script)"}`,
    `Caption words (start time, ALL CAPS):\n${words}`,
    c.instruction ? `How the user wants it edited, in their words:\n${c.instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callClaude(content: string, firm = ""): Promise<RawLayout> {
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 16_000,
    system: `${SYSTEM}${firm}`,
    messages: [{ role: "user", content }],
    output_config: { effort: "high", format: { type: "json_schema", schema: LAYOUT_SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];
  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to lay out this edit. Try rewording the note.");
  if (message.stop_reason === "max_tokens") throw new Error("The layout came back cut off. Please try again.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as RawLayout;
  } catch {
    throw new Error("Claude returned an unreadable layout. Please try again.");
  }
}

// ---------- Checks and clean-up (code, not judgment) ----------

const tokens = (s: string) => s.split(/\s+/).map((w) => normalizeWord(w).replace(/[^A-Z0-9$%']/g, "")).filter(Boolean);

/** True when `text` (3+ words) appears word for word in the captions inside [from, to]. */
function quotesCaption(text: string, words: CaptionWord[], from: number, to: number): boolean {
  const t = tokens(text);
  if (t.length < 3) return false;
  const run = words.filter((w) => w.end >= from && w.start <= to).map((w) => w.word.replace(/[^A-Z0-9$%']/g, ""));
  for (let i = 0; i + t.length <= run.length; i++) if (t.every((x, k) => run[i + k] === x)) return true;
  return false;
}

function restatements(o: EditOverlays, words: CaptionWord[], style: EditStyle): string[] {
  if (style === "pov" || o.captions === false) return []; // no captions run under them
  const out: string[] = [];
  const check = (label: string, x: TimedText | null) => {
    if (x && quotesCaption(x.text, words, x.start - 1, x.end + 1)) out.push(`${label} "${x.text}" repeats the caption running under it.`);
  };
  if (o.title && quotesCaption(o.title.text, words, 0, Number.MAX_VALUE)) out.push(`The title "${o.title.text}" quotes the script; distill it instead.`);
  check("The qualifier", o.qualifier);
  check("The CTA", o.cta);
  o.cards.forEach((c, i) => check(`Card ${i + 1}`, c));
  return out;
}

/**
 * Sequence items in one slot: sorted, never overlapping, none shorter than
 * `min`. With keep=true (revisions) times are left as they are, so a
 * "whole video" the user set by hand survives a later written change.
 */
function sequence<T extends { start: number; end: number }>(items: T[], min: number, keep = false): T[] {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1 && !keep; i++) {
    if (sorted[i + 1].start < sorted[i].end + 0.1) sorted[i] = { ...sorted[i], end: sorted[i + 1].start - 0.1 };
  }
  return sorted.filter((x) => x.end - x.start >= min);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function sanitizeOverlays(style: EditStyle, raw: RawLayout, durationS: number, positions: FramePosition[], keepTimes = false): EditOverlays {
  const D = durationS;
  const clampT = (t: number) => r2(Math.min(D, Math.max(0, Number.isFinite(t) ? t : 0)));
  const timed = (x: TimedText | null | undefined, max = 80, min = 1): TimedText | null => {
    if (!x || !x.text?.trim()) return null;
    const out = { text: x.text.trim().slice(0, max), start: clampT(x.start), end: clampT(x.end) };
    return out.end - out.start >= min ? out : null;
  };
  const empty: EditOverlays = { title: null, qualifier: null, cta: null, rungs: [], stickers: [], cards: [] };

  if (style === "solo") return { ...empty, title: timed(raw.title, 48) };
  if (style === "pov") {
    const stickers = (raw.stickers ?? []).map((s) => timed(s, 90, 1.5)).filter((s): s is TimedText => Boolean(s));
    return { ...empty, stickers: sequence(stickers, 1.5, keepTimes).slice(0, 6) };
  }
  if (style === "vsl") return { ...empty, cards: vslCards(raw, timed, keepTimes) };

  const order: Record<string, number> = { LEFT: 0, CENTER: 1, RIGHT: 2 };
  const allowed = new Set(positions.length ? positions.map((p) => p.position) : ["LEFT", "CENTER", "RIGHT"]);
  const seen = new Set<string>();
  const rungs: LadderRung[] = [];
  for (const r of raw.rungs ?? []) {
    if (!allowed.has(r.position) || seen.has(r.position) || !r.pill?.trim()) continue;
    seen.add(r.position);
    const start = clampT(r.start);
    const end = clampT(r.end) > start + 1 ? clampT(r.end) : D;
    rungs.push({ position: r.position, pill: r.pill.trim().slice(0, 14), tag: (r.tag ?? "").trim().slice(0, 32), start, end });
  }
  rungs.sort((a, b) => order[a.position] - order[b.position]);
  // The qualifier and the CTA share one slot: sequence them.
  const qualifier = timed(raw.qualifier, 70);
  let cta = timed(raw.cta, 60);
  if (qualifier && cta && cta.start < qualifier.end + 0.1 && !keepTimes) {
    cta = cta.end - (qualifier.end + 0.1) >= 1 ? { ...cta, start: r2(qualifier.end + 0.1) } : null;
  }

  if (style === "ladder") return { ...empty, title: timed(raw.title, 48), qualifier, cta, rungs };

  // Custom: every slot, captions on/off, zooms.
  const stickers = (raw.stickers ?? []).map((x) => timed(x, 90, 1.5)).filter((x): x is TimedText => Boolean(x));
  const zooms = sequence(
    (raw.zooms ?? []).map((z) => ({
      start: clampT(z.start),
      end: clampT(z.end),
      scale: r2(Math.min(1.3, Math.max(1.05, Number.isFinite(z.scale) ? z.scale : 1.15))),
    })),
    0.5
  ).slice(0, 40);
  return {
    title: timed(raw.title, 48),
    qualifier,
    cta,
    rungs: positions.length >= 2 ? rungs : [],
    stickers: sequence(stickers, 1.5, keepTimes).slice(0, 8),
    cards: vslCards(raw, timed, keepTimes),
    captions: raw.captions !== false,
    zooms,
  };
}

function vslCards(
  raw: RawLayout,
  timed: (x: TimedText | null | undefined, max?: number, min?: number) => TimedText | null,
  keepTimes = false
): VslCard[] {
  const kinds = ["point", "stat", "qualifier", "cta"];
  const cards: VslCard[] = [];
  for (const c of raw.cards ?? []) {
    const t = timed(c, 90, 1.5);
    if (t && kinds.includes(c.kind)) cards.push({ ...t, kind: c.kind, sub: c.sub?.trim() ? c.sub.trim().slice(0, 90) : null });
  }
  return sequence(cards, 1.5, keepTimes).slice(0, 12);
}

const SLOTS: Record<EditStyle, (keyof EditOverlays)[]> = {
  solo: ["title"],
  pov: ["stickers"],
  vsl: ["cards"],
  ladder: ["title", "qualifier", "cta", "rungs"],
  custom: ["title", "qualifier", "cta", "rungs", "stickers", "cards"],
};

/** True when a revision used something the style can't render (→ switch to the custom composition). */
function outsideStyle(style: EditStyle, raw: RawLayout): boolean {
  if (style === "custom") return false;
  const used: Record<string, boolean> = {
    title: Boolean(raw.title?.text?.trim()),
    qualifier: Boolean(raw.qualifier?.text?.trim()),
    cta: Boolean(raw.cta?.text?.trim()),
    rungs: (raw.rungs ?? []).length > 0,
    stickers: (raw.stickers ?? []).length > 0,
    cards: (raw.cards ?? []).length > 0,
  };
  const extraSlot = Object.entries(used).some(([k, v]) => v && !SLOTS[style].includes(k as keyof EditOverlays));
  return extraSlot || (raw.zooms ?? []).length > 0 || raw.captions !== (style !== "pov");
}

export interface LayoutResult {
  /** The style it ended up in (a revision can move a fixed style to custom). */
  style: EditStyle;
  overlays: EditOverlays;
  swaps: { find: string; replace: string }[];
  notes: string;
}

/**
 * Lay out a style, then clean the times in code. A first rulebook layout that
 * restates the captions gets one retry; on a revision or a described ("your
 * way") edit the user's ask wins and the conflict is only flagged (rulebook:
 * state it once, then build what was asked).
 */
async function layout(ctx: EditContext, prompt: string, revision: boolean): Promise<LayoutResult> {
  const enforce = !revision && ctx.style !== "custom";
  let raw = await callClaude(prompt, ctx.firm);
  let style: EditStyle = revision && outsideStyle(ctx.style, raw) ? "custom" : ctx.style;
  let overlays = sanitizeOverlays(style, raw, ctx.durationS, ctx.positions, revision);
  let problems = restatements(overlays, ctx.words, style);
  if (problems.length && enforce) {
    raw = await callClaude(
      `${prompt}\n\nYour previous layout broke the no-restating rule:\n- ${problems.join("\n- ")}\nReturn the complete layout again with those fixed.`,
      ctx.firm
    );
    style = ctx.style;
    overlays = sanitizeOverlays(style, raw, ctx.durationS, ctx.positions);
    problems = restatements(overlays, ctx.words, style);
  }
  const switched = style !== ctx.style ? " Switched to “Your way” so the edit can include that." : "";
  const notes = [(raw.notes ?? "").trim(), ...problems.map((p) => `Heads up: ${p}`)].filter(Boolean).join(" ") + switched;
  return {
    style,
    overlays,
    swaps: Array.isArray(raw.swaps) ? raw.swaps.filter((x) => x.find?.trim() && x.replace?.trim()).slice(0, 20) : [],
    notes: notes.trim(),
  };
}

export function proposeLayout(ctx: EditContext): Promise<LayoutResult> {
  const ask =
    ctx.style === "custom"
      ? "Build this edit the way the user described it, using the custom style."
      : `Lay out the graphics for this cut in the ${ctx.style} style.${ctx.instruction ? " Follow the user's instruction within this style." : ""}`;
  return layout(ctx, `${contextText(ctx)}\n\n${ask}`, false);
}

export function reviseLayout(ctx: EditContext, current: EditOverlays, note: string): Promise<LayoutResult> {
  const effective = { ...current, captions: current.captions ?? ctx.style !== "pov", zooms: current.zooms ?? [] };
  return layout(
    ctx,
    [
      contextText(ctx),
      `Current style: ${ctx.style}`,
      `Current layout (JSON):\n${JSON.stringify(effective)}`,
      `The user's requested change: ${note}`,
      "Return the complete layout with only that change made.",
    ].join("\n\n"),
    true
  );
}

// ---------- Hand-edited text: Claude's versions of what the user typed ----------

function rulebookSection(start: string, end: string): string {
  const i = EDITING_RULES.indexOf(start);
  if (i < 0) return "";
  const j = EDITING_RULES.indexOf(end, i);
  return EDITING_RULES.slice(i, j > i ? j : undefined).trim();
}

const SUGGEST_NEXLI = "a short Nexli video ad (Nexli runs client acquisition for CPA firms)";
const SUGGEST_SYSTEM = `You help write one piece of on-screen text for a short Nexli video ad (Nexli runs client acquisition for CPA firms). The user typed their own version; you offer alternatives that keep their idea.

${rulebookSection("## Creative rules", "## Brand")}

Copy rules: no guarantees of results, no savior positioning, no unverifiable claims; "investment" never "price"; write CPA and IRS (never C-P-A / I-R-S); figures as digits; use only numbers that appear in the user's text, the script or the captions.

Return exactly three options. Each keeps the user's meaning and fits the slot's length; make them genuinely different (for example one punchier, one more specific, one from a different angle). Never repeat the words she is saying under it. Write in normal case (the renderer sets ALL CAPS where the style uses it), except stickers, which stay in sentence case.

aboutYours: one short plain sentence if the user's own version breaks a rule above (repeats the caption under it, too long for the slot, a guarantee…), otherwise an empty string.`;

const SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["options", "aboutYours"],
  properties: { options: { type: "array", items: { type: "string" } }, aboutYours: { type: "string" } },
} as const;

export async function suggestText(args: {
  slot: string;
  limit: number;
  typed: string;
  window: { start: number; end: number } | null;
  words: CaptionWord[];
  onScreen: string[];
  direction: string;
  script: string[];
  /** A client studio: the firm's name and brief; absent for Nexli. */
  firm?: { name: string; brief: string };
}): Promise<{ options: string[]; aboutYours: string }> {
  const w = args.window;
  const spoken = w
    ? args.words
        .filter((x) => x.end >= w.start - 1 && x.start <= w.end + 1)
        .map((x) => x.word)
        .join(" ")
    : "";
  const content = [
    `What the video is about: ${args.direction || "(not given)"}`,
    `Script: ${args.script.join(" ") || "(none)"}`,
    `The slot: ${args.slot}. Hard limit ${args.limit} characters.`,
    w ? `On screen ${t2(w.start)}–${t2(w.end)}s. What she says around then (captions): ${spoken || "(nothing)"}` : "",
    args.onScreen.length ? `Other on-screen text in this edit:\n${args.onScreen.join("\n")}` : "",
    `The user typed: ${args.typed}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 1500,
    system: args.firm
      ? SUGGEST_SYSTEM.replace(SUGGEST_NEXLI, () => `a short video ad for ${args.firm!.name}, one of Nexli's client firms`) + args.firm.brief
      : SUGGEST_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SUGGEST_SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.create>[0];
  const message = (await client.beta.messages.create(params)) as Anthropic.Beta.BetaMessage;
  if (message.stop_reason === "refusal") throw new Error("Claude couldn't suggest versions for that. Try rewording it.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let raw: { options?: string[]; aboutYours?: string };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Claude returned unreadable versions. Please try again.");
  }
  const typed = args.typed.trim().toLowerCase();
  const seen = new Set<string>([typed]);
  const options: string[] = [];
  for (const o of raw.options ?? []) {
    const v = o.replace(/C-P-A/g, "CPA").replace(/I-R-S/g, "IRS").trim().slice(0, args.limit);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      options.push(v);
    }
  }
  return { options: options.slice(0, 3), aboutYours: (raw.aboutYours ?? "").trim() };
}
