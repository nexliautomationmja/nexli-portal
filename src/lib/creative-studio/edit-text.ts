import type { EditOverlays } from "@/remotion/types";

/**
 * Hand-editing one piece of on-screen text (client-safe, shared by the edit
 * card's live preview and the save route): which text, its length cap (the
 * same caps the layout clean-up uses), and get/set on the overlays.
 */
export type TextTarget =
  | { slot: "title" | "qualifier" | "cta" }
  | { slot: "sticker"; index: number }
  | { slot: "card"; index: number; field: "text" | "sub" }
  | { slot: "rung"; index: number; field: "pill" | "tag" };

export function textLimit(t: TextTarget): number {
  switch (t.slot) {
    case "title":
      return 48;
    case "qualifier":
      return 70;
    case "cta":
      return 60;
    case "sticker":
    case "card":
      return 90;
    case "rung":
      return t.field === "pill" ? 14 : 32;
  }
}

/** What each slot is for, for Claude's suggestions. */
export function slotBrief(t: TextTarget): string {
  switch (t.slot) {
    case "title":
      return "the title banner: 2–6 words, 36 characters or fewer, a distillation of the video's idea, never a quote of what she says";
    case "qualifier":
      return "the red qualifier band: who this is for, short and filtering (e.g. \"For CPA firms doing $750K+\")";
    case "cta":
      return "the CTA card at the end: a short directional line (an arrow is added), e.g. \"Book your call below\"";
    case "sticker":
      return "an Instagram-style white text sticker: 10 words or fewer, sentence case, sounds like a person typed it";
    case "card":
      return t.field === "sub"
        ? "the small second line under a VSL card: one short supporting line, never a repeat of the caption"
        : "a VSL left-column card: a sharp point or a number, a few words";
    case "rung":
      return t.field === "pill"
        ? "a ladder price/outcome pill: 10 characters or fewer, e.g. \"$250K\" or \"10 HRS/WK\""
        : "a ladder client-type tag: 3 words or fewer, e.g. \"SHOEBOX CLIENTS\"";
  }
}

export function getText(o: EditOverlays, t: TextTarget): string | null {
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta":
      return o[t.slot]?.text ?? null;
    case "sticker":
      return o.stickers[t.index]?.text ?? null;
    case "card": {
      const c = o.cards[t.index];
      return c ? (t.field === "sub" ? c.sub ?? "" : c.text) : null;
    }
    case "rung": {
      const r = o.rungs[t.index];
      return r ? r[t.field] : null;
    }
  }
}

/** The element's time window (to seek the preview and give Claude context). */
export function windowOf(o: EditOverlays, t: TextTarget): { start: number; end: number } | null {
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta":
      return o[t.slot] ?? null;
    case "sticker":
      return o.stickers[t.index] ?? null;
    case "card":
      return o.cards[t.index] ?? null;
    case "rung":
      return o.rungs[t.index] ?? null;
  }
}

/** A copy of the overlays with that text replaced (null if the target doesn't exist). */
export function setText(o: EditOverlays, t: TextTarget, text: string): EditOverlays | null {
  const v = text.slice(0, textLimit(t));
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta": {
      const x = o[t.slot];
      return x ? { ...o, [t.slot]: { ...x, text: v } } : null;
    }
    case "sticker":
      if (!o.stickers[t.index]) return null;
      return { ...o, stickers: o.stickers.map((s, i) => (i === t.index ? { ...s, text: v } : s)) };
    case "card":
      if (!o.cards[t.index]) return null;
      return {
        ...o,
        cards: o.cards.map((c, i) => (i === t.index ? (t.field === "sub" ? { ...c, sub: v || null } : { ...c, text: v }) : c)),
      };
    case "rung":
      if (!o.rungs[t.index]) return null;
      return { ...o, rungs: o.rungs.map((r, i) => (i === t.index ? { ...r, [t.field]: v } : r)) };
  }
}

export function parseTarget(v: unknown): TextTarget | null {
  const x = v as { slot?: unknown; index?: unknown; field?: unknown } | null;
  if (!x || typeof x.slot !== "string") return null;
  const index = typeof x.index === "number" && Number.isInteger(x.index) && x.index >= 0 ? x.index : -1;
  if (x.slot === "title" || x.slot === "qualifier" || x.slot === "cta") return { slot: x.slot };
  if (x.slot === "sticker" && index >= 0) return { slot: "sticker", index };
  if (x.slot === "card" && index >= 0 && (x.field === "text" || x.field === "sub")) return { slot: "card", index, field: x.field };
  if (x.slot === "rung" && index >= 0 && (x.field === "pill" || x.field === "tag")) return { slot: "rung", index, field: x.field };
  return null;
}

export const sameTarget = (a: TextTarget | null, b: TextTarget | null) => JSON.stringify(a) === JSON.stringify(b);
