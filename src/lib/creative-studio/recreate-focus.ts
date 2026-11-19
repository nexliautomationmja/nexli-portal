import { RUBRIC } from "@/lib/ads/grader-shared";
import { CHECKS } from "@/lib/creative-studio/script-score-shared";
import { OFFER_FACTS } from "@/lib/creative-studio/offer-facts";
export { OFFER_FACTS };

/**
 * Recreating a video in Nexli's own studio (Nov 19 2026, Marcel): "now that I
 * have the new offer … when it's recreating, it needs to recreate based off
 * of that … a highly engaging video based off of the scoring system … and
 * nailing all the points through the video."
 *
 * Added to the script writer's system prompt after the reference rules, only
 * for a video to recreate in Nexli's studio (client firms sell their own
 * offer, and the grader's points are Nexli's). Every other request is
 * unchanged. The offer facts themselves stay in the framework (section 9);
 * this tells the writer to re-pitch an older offer and to write to the
 * Ad Grader's points, with his own hook results as evidence.
 */

/** The writer's addendum. `evidence` is his hook results (null when they couldn't be read). */
export function recreateFocus(evidence: string | null): string {
  // The exact checklist the script is scored on (script-score-shared.ts), so the writer aims at what is measured.
  const points = RUBRIC.map(
    (r) => `- **${r.label} (${r.weight} points):**\n${CHECKS.filter((c) => c.point === r.key).map((c) => `  - ${c.label} (${c.points})`).join("\n")}`
  ).join("\n");
  return `
---

# Recreating for Nexli's current offer

The reference may be one of Nexli's own earlier videos or VSLs, or someone else's. Either way, the new script sells Nexli's offer as it is today, the "Current Nexli offer facts" in section 9:
${OFFER_FACTS}

Where the reference states an older offer, replace it with the facts above, never repeat it: no setup fee of any amount, no $9,997 or $4,997, no ad budget folded into the fee, no annual plan, no month to month, no first-month ad bonus or ad credits. The system itself hasn't changed: what Nexli builds and runs (sections 3b and 8) is the same, so keep its walkthrough and positioning lines.

## Written to score
Before anyone spends on it, this script is scored out of 100 on a fixed checklist: the grader's seven points, each split into checks worth fixed points. Most are measured straight from your words (clip 1's length, a number in clips 1–2, the qualifier line, the fee stated, no old offer, line lengths, clip count, the ask in the last 3 clips, no stock phrases, no 6-word run copied from the reference). Write so every check passes:
${points}

The most points sit in the hook: put your best line first.

## Length
A VSL keeps the framework's VSL size (30–50 clips) even when the reference runs longer: keep the reference's beats in their order and condense them.

## Notes
In \`notes\`, after the sentence on the shape you copied, add one short line per point above saying how the script earns it.
${
  evidence
    ? `
## His hook results (evidence)
What has held attention in his own ads and the long-running ads in his niche. Use it to choose the hook: open the way the best-holding ones open, in fresh words.

${evidence}`
    : ""
}`;
}

// ── His hook results, cached per instance ───────────────

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; text: string | null }>();

/**
 * The evidence the Hook Tester uses (his judged ads by 3-second hold and the
 * long-running ads in his niche), as text. Cached for 15 minutes so a
 * script, its score and its improvement don't each wait for it; null when
 * Meta isn't connected or it takes longer than 20 seconds. Never throws.
 */
export async function recreateEvidence(ownerId: string): Promise<string | null> {
  const hit = cache.get(ownerId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  let text: string | null = null;
  try {
    const [{ metaAdAccountId }, { ensureAdsTables }, { hookEvidence }] = await Promise.all([import("@/lib/meta-ads"), import("@/lib/ads/tables"), import("@/lib/ads/grader")]);
    const accountId = metaAdAccountId();
    if (accountId) {
      await ensureAdsTables();
      const found = await Promise.race([hookEvidence(ownerId, accountId), new Promise<null>((r) => setTimeout(() => r(null), 20_000))]);
      text = found?.text?.trim() || null;
    }
  } catch (err) {
    console.error("[creative-studio] recreate evidence failed:", err instanceof Error ? err.message : err);
  }
  cache.set(ownerId, { at: Date.now(), text });
  return text;
}
