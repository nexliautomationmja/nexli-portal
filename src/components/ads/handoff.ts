import { studioHref } from "@/components/creative-studio/client";

/**
 * Creative Studio hand-offs from the Ads tab: the refresh brief Manus wrote
 * (or a winner's variation) opens Photo Ads or the Videos batch composer with
 * the brief and count already filled in.
 */
/** `from` labels the hand-off in Creative Studio ("ads" = the analysis, "ads-research" = Ad Library research). */
export function photosHref(studioKey: string, brief: string, count: number, stepId?: string, from: "ads" | "ads-research" = "ads") {
  const q = new URLSearchParams({ brief: brief.slice(0, 1800), count: String(Math.max(1, Math.min(20, Math.round(count)))), from });
  if (stepId) q.set("step", stepId);
  return `${studioHref(studioKey, "photos")}?${q}`;
}

export function videosHref(studioKey: string, brief: string, count: number, from: "ads" | "ads-research" = "ads") {
  const q = new URLSearchParams({ brief: brief.slice(0, 1800), count: String(Math.max(1, Math.min(10, Math.round(count)))), format: "ad_9x16", from });
  return `${studioHref(studioKey, "videos")}?${q}`;
}

/** A refresh brief as one paste-ready block: the brief, then the angles, keep and avoid. */
export function fullBrief(r: { brief: string; angles: string[]; keep: string | null; avoid: string | null }) {
  return [
    r.brief,
    r.angles.length ? `Angles to test:\n${r.angles.map((a) => `- ${a}`).join("\n")}` : null,
    r.keep ? `Keep: ${r.keep}` : null,
    r.avoid ? `Avoid: ${r.avoid}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
