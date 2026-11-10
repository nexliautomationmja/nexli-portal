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
export type MovableSlot = "title" | "qualifier" | "cta" | "captions" | "stickers" | "cards" | "pip";

export type EditLayout = Partial<Record<MovableSlot, Anchor>>;

/** How the captions look. Absence of a field = the rulebook's captions. */
export interface CaptionStyle {
  /** Words per caption line (rulebook: 3). */
  perLine?: 1 | 2 | 3 | 4;
  /** Size multiplier on the rig's caption size. */
  scale?: number;
  /** caps = ALL CAPS (rulebook), title = Title Case, lower = lowercase; acronyms and figures stay as they are. */
  case?: "caps" | "title" | "lower";
  /** The active word's colour (rulebook: the brand gradient). none = no karaoke highlight. */
  highlight?: "gradient" | "green" | "yellow" | "none";
  /** A dark box behind the words instead of the scrim. */
  box?: boolean;
  font?: "outfit" | "jakarta";
}

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
  /** Hand-set caption look. Absence = the rulebook's captions. */
  captionStyle?: CaptionStyle;
}

/** A reaction video: one part of the video in the corner that plays, placed on the cut. */
export interface PipWindow {
  /** When it plays, on the cut's timeline. */
  start: number;
  end: number;
  /** The part of the video (seconds on its own timeline): it plays from `from` and holds on `to` if the window runs longer. */
  from: number;
  to: number;
}

export type PipSize = "s" | "m" | "l";

/**
 * A reaction video: the video the presenter reacts to, in the top-right
 * corner. It plays with its own sound inside its windows (her track goes
 * quiet, her captions pause and its own words are captioned) and is paused
 * on a frame everywhere else. Absence = no corner video (every other edit).
 */
export interface PipTrack {
  /** The light copy of the video (signed when the edit is previewed or rendered). */
  src: string;
  /** Width ÷ height. */
  aspect: number;
  /** In order, never overlapping. */
  windows: PipWindow[];
  /** Absence = m. */
  size?: PipSize;
  /** Caption its own words while it plays. Absence = on. */
  captions?: boolean;
  /** Its words on the cut's timeline (inside the windows only). */
  words?: CaptionWord[];
}

// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type EditProps = {
  style: EditStyle;
  format: EditFormat;
  videoUrl: string;
  durationS: number;
  words: CaptionWord[];
  overlays: EditOverlays;
  /** A reaction video's corner video. Absence = every rig renders exactly as before. */
  pip?: PipTrack;
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
