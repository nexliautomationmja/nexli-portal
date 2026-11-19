import { ICON_KINDS, ICON_MOTIONS, type BoxColors, type EditOverlays, type IconFx, type TimedText } from "@/remotion/types";
import { AUDIENCE } from "@/lib/creative-studio/offer-facts";

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

/** The title banner's cap: two lines at the default size (Marcel wanted 58+). */
export const TITLE_MAX = 60;

export function textLimit(t: TextTarget): number {
  switch (t.slot) {
    case "title":
      return TITLE_MAX;
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
      return "the title banner: a distillation of the video's idea, never a quote of what she says; short reads fastest (2–6 words), but up to 60 characters is fine when the user's version is longer";
    case "qualifier":
      return `the red qualifier band: who this is for, short and filtering (e.g. "For CPA firms doing ${AUDIENCE.short}")`;
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

/** A copy of the overlays with the element's time window replaced (null if it doesn't exist). */
export function setWindow(o: EditOverlays, t: TextTarget, start: number, end: number): EditOverlays | null {
  const w = { start, end };
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta": {
      const x = o[t.slot];
      return x ? { ...o, [t.slot]: { ...x, ...w } } : null;
    }
    case "sticker":
      if (!o.stickers[t.index]) return null;
      return { ...o, stickers: o.stickers.map((s, i) => (i === t.index ? { ...s, ...w } : s)) };
    case "card":
      if (!o.cards[t.index]) return null;
      return { ...o, cards: o.cards.map((c, i) => (i === t.index ? { ...c, ...w } : c)) };
    case "rung":
      if (!o.rungs[t.index]) return null;
      return { ...o, rungs: o.rungs.map((r, i) => (i === t.index ? { ...r, ...w } : r)) };
  }
}

/**
 * Other elements sharing this one's spot while it's on screen — stickers with
 * stickers, cards with cards, the qualifier with the CTA (unless one of them
 * was moved by hand to its own spot).
 */
export function slotClashes(o: EditOverlays, t: TextTarget, start: number, end: number): { label: string; start: number; end: number }[] {
  const overlaps = (x: { start: number; end: number }) => x.start < end && x.end > start;
  const out: { label: string; start: number; end: number }[] = [];
  if (t.slot === "sticker") o.stickers.forEach((s, i) => i !== t.index && overlaps(s) && out.push({ label: `Sticker ${i + 1}`, ...s }));
  if (t.slot === "card") o.cards.forEach((c, i) => i !== t.index && overlaps(c) && out.push({ label: `Card ${i + 1}`, ...c }));
  const q = o.layout?.qualifier;
  const c = o.layout?.cta;
  const sameSpot = JSON.stringify(q) === JSON.stringify(c);
  if (sameSpot && t.slot === "qualifier" && o.cta && overlaps(o.cta)) out.push({ label: "The CTA", ...o.cta });
  if (sameSpot && t.slot === "cta" && o.qualifier && overlaps(o.qualifier)) out.push({ label: "The qualifier", ...o.qualifier });
  return out;
}

// ---------- Hand-picked colours (✎ → Colors) ----------

/** "#abc", "abc123", " #ABC123 " → "#AABBCC"/"#ABC123"; anything else → null. */
export function cleanHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toUpperCase()}`;
}

/** Only real #RRGGBB values; an empty result = the rulebook's colours. */
export function cleanColors(v: unknown): BoxColors {
  const x = (v ?? {}) as { bg?: unknown; text?: unknown };
  const bg = cleanHex(x.bg);
  const text = cleanHex(x.text);
  return { ...(bg ? { bg } : {}), ...(text ? { text } : {}) };
}

const hasColors = (c: BoxColors | undefined): c is BoxColors => Boolean(c && (c.bg || c.text));

/** The element's hand-picked colours ({} = the rulebook's). A card's second line shares its card's colours. */
export function getColors(o: EditOverlays, t: TextTarget): BoxColors {
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta":
      return o[t.slot]?.colors ?? {};
    case "sticker":
      return o.stickers[t.index]?.colors ?? {};
    case "card":
      return o.cards[t.index]?.colors ?? {};
    case "rung": {
      const r = o.rungs[t.index];
      return (t.field === "pill" ? r?.pillColors : r?.tagColors) ?? {};
    }
  }
}

/** Set (or with {} clear) a field's colours on one element, leaving no empty `colors` behind. */
function paint<T extends object, K extends string>(x: T, key: K, c: BoxColors): T {
  const { [key]: _old, ...rest } = x as T & Record<K, unknown>;
  void _old;
  return (hasColors(c) ? { ...rest, [key]: c } : rest) as T;
}

/** A copy of the overlays with that element's colours replaced (null if it doesn't exist). */
export function setColors(o: EditOverlays, t: TextTarget, colors: BoxColors): EditOverlays | null {
  const c = cleanColors(colors);
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta": {
      const x = o[t.slot];
      return x ? { ...o, [t.slot]: paint(x, "colors", c) } : null;
    }
    case "sticker":
      if (!o.stickers[t.index]) return null;
      return { ...o, stickers: o.stickers.map((s, i) => (i === t.index ? paint(s, "colors", c) : s)) };
    case "card":
      if (!o.cards[t.index]) return null;
      return { ...o, cards: o.cards.map((x, i) => (i === t.index ? paint(x, "colors", c) : x)) };
    case "rung":
      if (!o.rungs[t.index]) return null;
      return { ...o, rungs: o.rungs.map((r, i) => (i === t.index ? paint(r, t.field === "pill" ? "pillColors" : "tagColors", c) : r)) };
  }
}

/**
 * The rulebook's colours for an element (what the pickers show before a
 * colour is picked). Mirrors src/remotion/components/Overlays.tsx; the red
 * qualifier gradient is shown as its first stop.
 */
export function defaultColors(o: EditOverlays, t: TextTarget): Required<BoxColors> {
  const NAVY = "#0A0E1E";
  const WHITE = "#FFFFFF";
  const RED = "#DC2626";
  const GREEN = "#22C55E";
  switch (t.slot) {
    case "title":
      return { bg: WHITE, text: NAVY };
    case "qualifier":
      return { bg: RED, text: WHITE };
    case "cta":
      return { bg: NAVY, text: WHITE };
    case "sticker":
      return { bg: WHITE, text: "#000000" };
    case "card": {
      const kind = o.cards[t.index]?.kind;
      return { bg: kind === "qualifier" ? RED : NAVY, text: kind === "stat" ? GREEN : WHITE };
    }
    case "rung":
      return t.field === "pill" ? { bg: NAVY, text: GREEN } : { bg: WHITE, text: NAVY };
  }
}

/** Hand-picked colours and icons off the overlays (what Claude sees stays exactly as before they existed). */
export function withoutDecor(o: EditOverlays): EditOverlays {
  const strip = <T extends object>(x: T): T => {
    const { colors: _c, pillColors: _p, tagColors: _t, fx: _f, ...rest } = x as T & { colors?: unknown; pillColors?: unknown; tagColors?: unknown; fx?: unknown };
    void _c;
    void _p;
    void _t;
    void _f;
    return rest as T;
  };
  return {
    ...o,
    title: o.title && strip(o.title),
    qualifier: o.qualifier && strip(o.qualifier),
    cta: o.cta && strip(o.cta),
    stickers: o.stickers.map(strip),
    cards: o.cards.map(strip),
    rungs: o.rungs.map(strip),
  };
}

/** The hand-picked look of a text box: its colours and its icons. */
type Decor = Pick<TimedText, "colors" | "fx">;
const decorOf = (x: Decor | null | undefined): Decor | null =>
  x && (hasColors(x.colors) || x.fx) ? { ...(hasColors(x.colors) ? { colors: x.colors } : {}), ...(x.fx ? { fx: x.fx } : {}) } : null;

/**
 * Keep hand-picked colours and icons through a new layout from Claude (which
 * never returns them). The title, qualifier and CTA keep theirs while they
 * exist; a sticker or card keeps its look when its words come back
 * unchanged, or — on a written change (`byIndex`) — when the list kept its
 * length (its words were reworded in place); ladder rungs follow their person.
 */
export function carryDecor(prev: EditOverlays, next: EditOverlays, byIndex: boolean): EditOverlays {
  let out = next;
  for (const slot of ["title", "qualifier", "cta"] as const) {
    const was = decorOf(prev[slot]);
    const now = out[slot];
    if (was && now) out = { ...out, [slot]: { ...now, ...was } };
  }
  const key = (x: TimedText) => x.text.trim().toLowerCase();
  const list = <T extends TimedText>(before: T[], after: T[]): T[] =>
    after.map((x, i) => {
      const same = before.find((b) => decorOf(b) && key(b) === key(x));
      // In place: the one that was here, only if its own words are gone (reworded, not moved).
      const here = byIndex && before.length === after.length && before[i] && !after.some((a) => key(a) === key(before[i])) ? before[i] : null;
      const was = decorOf(same) ?? decorOf(here);
      return was ? { ...x, ...was } : x;
    });
  out = { ...out, stickers: list(prev.stickers, out.stickers), cards: list(prev.cards, out.cards) };
  out = {
    ...out,
    rungs: out.rungs.map((r) => {
      const was = prev.rungs.find((b) => b.position === r.position);
      return {
        ...r,
        ...(hasColors(was?.pillColors) ? { pillColors: was.pillColors } : {}),
        ...(hasColors(was?.tagColors) ? { tagColors: was.tagColors } : {}),
      };
    }),
  };
  return out;
}

// ---------- Animated icons (✎ → Animated icons) ----------

/** A known icon and motion, or null (= no icons). */
export function cleanFx(v: unknown): IconFx | null {
  const x = v as { icon?: unknown; motion?: unknown } | null;
  if (!x) return null;
  const icon = ICON_KINDS.find((k) => k === x.icon);
  const motion = ICON_MOTIONS.find((m) => m === x.motion) ?? "around";
  return icon ? { icon, motion } : null;
}

/** Ladder pills and tags carry no icons; a card's second line shares its card's. */
export const canHaveFx = (t: TextTarget) => t.slot !== "rung";

export function getFx(o: EditOverlays, t: TextTarget): IconFx | null {
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta":
      return o[t.slot]?.fx ?? null;
    case "sticker":
      return o.stickers[t.index]?.fx ?? null;
    case "card":
      return o.cards[t.index]?.fx ?? null;
    case "rung":
      return null;
  }
}

/** A copy of the overlays with that element's icons replaced (null = none; null back if it doesn't exist). */
export function setFx(o: EditOverlays, t: TextTarget, fx: IconFx | null): EditOverlays | null {
  const put = <T extends TimedText>(x: T): T => {
    const { fx: _old, ...rest } = x;
    void _old;
    return (fx ? { ...rest, fx } : rest) as T;
  };
  switch (t.slot) {
    case "title":
    case "qualifier":
    case "cta": {
      const x = o[t.slot];
      return x ? { ...o, [t.slot]: put(x) } : null;
    }
    case "sticker":
      if (!o.stickers[t.index]) return null;
      return { ...o, stickers: o.stickers.map((s, i) => (i === t.index ? put(s) : s)) };
    case "card":
      if (!o.cards[t.index]) return null;
      return { ...o, cards: o.cards.map((x, i) => (i === t.index ? put(x) : x)) };
    case "rung":
      return null;
  }
}
