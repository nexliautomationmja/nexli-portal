import Anthropic from "@anthropic-ai/sdk";
import { EDITING_RULES } from "@/lib/creative-studio/rules.generated";
import { RIG_LABEL } from "@/lib/creative-studio/prompts";
import type { CreativeFormat, CreativeRig, FramePosition } from "@/lib/creative-studio/tables";
import type { CaptionWord, EditOverlays, EditStyle, LadderRung, TimedText, VslCard } from "@/remotion/types";
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

Writing rules:
- Never restate the caption running underneath. A title or card uses words that are not being spoken in that moment; check the words list around each window. The title is a distillation, not a quote.
- Title: 2–6 words, 36 characters or fewer, normal case (the renderer sets ALL CAPS).
- Figures as digits ($9,997). Use only figures that appear in the words or the script — never invent numbers or results. No guarantees, no savior positioning, "investment" never "price". Write CPA, never C-P-A.
- Each element stays on screen at least 1.5 s (stickers and cards at least 2.5 s).
- Silence on screen is a legitimate choice. Don't pad.

notes: up to four plain sentences for the user — your judgment calls (where you put the qualifier and why, a word that looks misheard, anything to check before rendering).

swaps: caption-text corrections only. On a first layout return []. On a revision, when the user's note is about caption wording ("the caption says CALCULATING, it should be CALENDAR"), return {find, replace} with the caption tokens as they appear (ALL CAPS, multi-word allowed) and keep the layout as it is.

Revisions: you get the current layout and the user's note. Change only what the note asks for; return everything else exactly as it was.
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
  required: ["title", "qualifier", "cta", "rungs", "stickers", "cards", "swaps", "notes"],
  properties: {
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
  ].join("\n\n");
}

async function callClaude(content: string): Promise<RawLayout> {
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM,
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
  if (style === "pov") return []; // no captions run under stickers
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

/** Sequence items in one slot: sorted, never overlapping, none shorter than `min`. */
function sequence<T extends { start: number; end: number }>(items: T[], min: number): T[] {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1].start < sorted[i].end + 0.1) sorted[i] = { ...sorted[i], end: sorted[i + 1].start - 0.1 };
  }
  return sorted.filter((x) => x.end - x.start >= min);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function sanitizeOverlays(style: EditStyle, raw: RawLayout, durationS: number, positions: FramePosition[]): EditOverlays {
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
    return { ...empty, stickers: sequence(stickers, 1.5).slice(0, 6) };
  }
  if (style === "vsl") {
    const kinds = ["point", "stat", "qualifier", "cta"];
    const cards: VslCard[] = [];
    for (const c of raw.cards ?? []) {
      const t = timed(c, 90, 1.5);
      if (t && kinds.includes(c.kind)) cards.push({ ...t, kind: c.kind, sub: c.sub?.trim() ? c.sub.trim().slice(0, 90) : null });
    }
    return { ...empty, cards: sequence(cards, 1.5).slice(0, 12) };
  }

  // Ladder
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
  const qualifier = timed(raw.qualifier, 70);
  let cta = timed(raw.cta, 60);
  if (qualifier && cta && cta.start < qualifier.end + 0.1) {
    cta = cta.end - (qualifier.end + 0.1) >= 1 ? { ...cta, start: r2(qualifier.end + 0.1) } : null;
  }
  const order: Record<string, number> = { LEFT: 0, CENTER: 1, RIGHT: 2 };
  return { ...empty, title: timed(raw.title, 48), qualifier, cta, rungs: rungs.sort((a, b) => order[a.position] - order[b.position]) };
}

export interface LayoutResult {
  overlays: EditOverlays;
  swaps: { find: string; replace: string }[];
  notes: string;
}

/**
 * Lay out a style, then clean the times in code. A first layout that restates
 * the captions gets one retry; on a revision the user's ask wins and the
 * conflict is only flagged (rulebook: state it once, then build what was asked).
 */
async function layout(ctx: EditContext, prompt: string, enforce: boolean): Promise<LayoutResult> {
  let raw = await callClaude(prompt);
  let overlays = sanitizeOverlays(ctx.style, raw, ctx.durationS, ctx.positions);
  let problems = restatements(overlays, ctx.words, ctx.style);
  if (problems.length && enforce) {
    raw = await callClaude(`${prompt}\n\nYour previous layout broke the no-restating rule:\n- ${problems.join("\n- ")}\nReturn the complete layout again with those fixed.`);
    overlays = sanitizeOverlays(ctx.style, raw, ctx.durationS, ctx.positions);
    problems = restatements(overlays, ctx.words, ctx.style);
  }
  const notes = [(raw.notes ?? "").trim(), ...problems.map((p) => `Heads up: ${p}`)].filter(Boolean).join(" ");
  return {
    overlays,
    swaps: Array.isArray(raw.swaps) ? raw.swaps.filter((s) => s.find?.trim() && s.replace?.trim()).slice(0, 20) : [],
    notes,
  };
}

export function proposeLayout(ctx: EditContext): Promise<LayoutResult> {
  return layout(ctx, `${contextText(ctx)}\n\nLay out the graphics for this cut in the ${ctx.style} style.`, true);
}

export function reviseLayout(ctx: EditContext, current: EditOverlays, note: string): Promise<LayoutResult> {
  return layout(
    ctx,
    [
      contextText(ctx),
      `Current layout (JSON):\n${JSON.stringify(current)}`,
      `The user's requested change: ${note}`,
      "Return the complete layout with only that change made.",
    ].join("\n\n"),
    false
  );
}
