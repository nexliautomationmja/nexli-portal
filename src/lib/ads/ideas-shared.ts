/**
 * "Create new creatives" shapes shared by the page and the server (pure,
 * client-safe): a video idea, a set of them, and the "on deck" list of
 * Creative Studio videos made from them.
 */

export const IDEAS_MAX = 5;

export interface CreativeIdea {
  title: string;
  /** "AI presenter · pain-led" — the creative type it belongs to. */
  typeLabel: string;
  /** The first spoken line. */
  hook: string;
  /** What happens in the video, in 2–3 sentences. */
  concept: string;
  /** The brief Creative Studio's script writer gets. */
  direction: string;
  /** The opening frame, for Manus. */
  shot: string;
  /** Evidence from Marcel's own results ("" = none). */
  whyOurs: string;
  /** Evidence from the Ad Library research ("" = none). */
  whyMarket: string;
  basedOn: { adId: string; name: string }[];
  marketRefs: { advertiser: string; url: string | null }[];
}

export interface IdeaBacking {
  /** "12 ads · best type: AI presenter · pain-led at $190 per booked call". */
  ours: string;
  /** "Ad Library research from Nov 12 (8 long-running ads)" or null when there's none from the last 60 days. */
  market: string | null;
}

export interface IdeaSetView {
  id: string;
  count: number;
  note: string;
  ideas: CreativeIdea[];
  backing: IdeaBacking | null;
  batchId: string | null;
  projectIds: (string | null)[];
  createdAt: string;
}

export type DeckStage = "ready" | "clips" | "rendering" | "script" | "starting";

export interface DeckItem {
  projectId: string;
  setId: string;
  title: string;
  typeLabel: string;
  stage: DeckStage;
  createdAt: string;
  liveAt: string | null;
}

export const DECK_STAGE: Record<DeckStage, string> = {
  ready: "Ready to upload",
  clips: "Clips done — finish the edit",
  rendering: "Rendering on Kling",
  script: "Script to review",
  starting: "Getting started",
};
