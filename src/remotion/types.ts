/**
 * Props for the Nexli edit compositions. Shared by the portal (live preview
 * with @remotion/player, building props on the server) and Remotion Lambda
 * (rendering). Relative imports only in src/remotion — the Remotion bundler
 * doesn't know the "@/" alias.
 *
 * All times are seconds on the final cut's timeline.
 */
export type EditStyle = "solo" | "pov" | "vsl" | "ladder" | "custom";
export type EditFormat = "ad_9x16" | "vsl_16x9";

export interface CaptionWord {
  /** ALL CAPS, trailing punctuation stripped, money/compounds merged (see words.ts). */
  word: string;
  start: number;
  end: number;
}

export interface TimedText {
  text: string;
  start: number;
  end: number;
}

export interface LadderRung {
  position: "LEFT" | "CENTER" | "RIGHT";
  /** Price / outcome pill, e.g. "$250K". */
  pill: string;
  /** Client-type tag, e.g. "SHOEBOX CLIENTS". */
  tag: string;
  start: number;
  end: number;
  /** Optional horizontal nudge in px (absence = the default slot). */
  nudgeX?: number;
}

export interface VslCard extends TimedText {
  kind: "point" | "stat" | "qualifier" | "cta";
  /** Optional second line (never a repeat of the caption). */
  sub?: string | null;
}

/** Custom style: a punch-in on the plate (scale eases in, holds, eases out). */
export interface Zoom {
  start: number;
  end: number;
  /** 1.05–1.3 */
  scale: number;
}

/** A spot on the frame as fractions of width and height — where the element's centre sits. */
export interface Anchor {
  x: number;
  y: number;
}

/** What can be moved by tapping on the preview (ladder rungs stay over their person). */
export type MovableSlot = "title" | "qualifier" | "cta" | "captions" | "stickers" | "cards";

export type EditLayout = Partial<Record<MovableSlot, Anchor>>;

export interface EditOverlays {
  /** Solo + ladder: the one title banner (a distillation, never a quote of the caption). */
  title: TimedText | null;
  /** Ladder (and VSL early): the red qualifier band. */
  qualifier: TimedText | null;
  /** Ladder: the CTA in the bottom chrome slot, sequenced after the qualifier. */
  cta: TimedText | null;
  /** Ladder: one rung per person. */
  rungs: LadderRung[];
  /** POV: Instagram-style white stickers. */
  stickers: TimedText[];
  /** VSL: left-column cards, one slot, sequenced. */
  cards: VslCard[];
  /** Custom only — absence means the style's default (captions on, except POV). */
  captions?: boolean;
  /** Custom only — absence means no zooms. */
  zooms?: Zoom[];
  /** Hand-placed positions. Absence of a slot = the rig's measured default geometry. */
  layout?: EditLayout;
}

// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type EditProps = {
  style: EditStyle;
  format: EditFormat;
  videoUrl: string;
  durationS: number;
  words: CaptionWord[];
  overlays: EditOverlays;
};

export const FPS = 60;

export const EMPTY_OVERLAYS: EditOverlays = {
  title: null,
  qualifier: null,
  cta: null,
  rungs: [],
  stickers: [],
  cards: [],
};

export const COMPOSITION_ID: Record<EditStyle, string> = {
  solo: "NexliSolo",
  pov: "NexliPov",
  vsl: "NexliVsl",
  ladder: "NexliLadder",
  custom: "NexliCustom",
};
