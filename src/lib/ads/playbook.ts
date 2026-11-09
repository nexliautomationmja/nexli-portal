/**
 * How Manus analyzes Nexli's ad account: a short prompt (Manus caps prompt
 * text at ~5,000 tokens, files don't count) plus the playbook as a Markdown
 * file. The playbook is the method — what to look at, in what order, the
 * minimum-data and learning-phase rules, and what a good next step looks like.
 */

export const PLAYBOOK_VERSION = "ads-playbook-v2";

export const ADS_AUTO_REPLY =
  "This request comes from an automated tool, so nobody can answer questions right now. Use your best judgment from the data pack and the playbook and finish the analysis now. Advise only — don't change anything in any account.";

export function promptText(opts: { trigger: "weekly" | "manual"; throughDate: string; hasConnector: boolean; stills: number }): string {
  return [
    "You are a senior Meta ads strategist reviewing Nexli's ad account. Nexli sells the Digital Rainmaker System — paid-ads client acquisition — to owners of US CPA firms. The goal of the ads is the lowest cost per booked strategy call with qualified CPA firm owners, while keeping volume up.",
    `This is the ${opts.trigger === "weekly" ? "weekly" : "on-demand"} analysis, with data through ${opts.throughDate} (the ad account's own timezone).`,
    "Attached:",
    "- ads-data-pack.json — the whole account: 7/30/90-day windows vs the previous period, every campaign, ad set and ad (with last-7-days vs the 14 days before for fatigue), placements, audience, tracking health, signals, goals, the history of earlier analyses and what Marcel did with their steps, and market_research (the latest Meta Ad Library research: proven competitor patterns and creative briefs) when there is one. It is the source of truth. Leads, booked calls and clients come from GoHighLevel; delivery and spend from Meta.",
    "- playbook.md — the method to follow. Follow it.",
    opts.stills ? `- ${opts.stills} still image${opts.stills > 1 ? "s" : ""} of the top creatives (named creative-N-<ad id>.jpg).` : null,
    opts.hasConnector
      ? "The Meta Ads Manager connector is available read-only if you need detail the pack doesn't have. Where it disagrees with the pack, trust the pack and say so in data_notes."
      : null,
    "Hard rules:",
    "1. Advise only. Never change, pause, create or buy anything, and never contact anyone. Marcel makes every change himself in Ads Manager.",
    "2. Every number you state must come from the pack (copy its display strings) or from a labelled connector read. Never invent numbers, results or benchmarks for this account; if something isn't in the data, say so.",
    "3. Respect the minimum-data and learning-phase rules in the playbook. \"Too early — wait N days, then check X\" is a perfectly good answer.",
    "4. One change per ad set at a time, so results can be read.",
    "5. Name exact entities with their ids from the pack, and exact settings and values.",
    "6. Nobody can answer questions. Use your judgment and finish.",
    "Deliver: fill every field of the structured output, and also attach the same JSON as ads-analysis.json in your final message. Put the full written report in report_markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function playbookMarkdown(): string {
  return `# Nexli ads analysis playbook (${PLAYBOOK_VERSION})

## 1. The business
- Nexli sells the Digital Rainmaker System to owners and partners of US CPA / accounting firms: a $32,000 setup plus a monthly fee (see business_model in the pack). One new client is worth roughly the average_deal_value_usd in the pack.
- The ads' job: booked strategy calls with qualified firm owners. Cost per booked call is the headline metric; cost per lead and click metrics only matter as far as they lead to booked calls and clients.
- goals in the pack holds Marcel's targets (or an assumption from the account's history — say which) and his notes. Read the notes first; they explain recent changes.

## 2. Sources of truth
- GoHighLevel (ghl_leads, booked_calls, won) beats Meta's own lead count (meta_leads). A big gap between them is a tracking finding, not a performance finding.
- Leads are credited to an ad by utm_content = the ad's name or id. Ads with lead_attribution "shared_name" share a name; treat their per-ad lead counts as estimates.
- Booked calls are counted by when the lead came in, so the last 2–3 days always look light.

## 3. Analysis order
1. **Tracking first.** Check the tracking list and signals: unattributed leads, missing utm_content, Meta vs GHL gap, landing-page view rate, pixel freshness, GHL scan cap. If tracking is broken, say so first and lower data_confidence — every other conclusion depends on it.
2. **Account trend.** last_7d / last_30d / last_90d against their previous windows: spend, leads, booked calls, cost per booked call, CTR, CPM, frequency. Consider seasonality: CPMs rise in Q4 (October–December, Black Friday), and January–April is tax season, when CPA firm owners are busiest and may book fewer calls.
3. **Funnel bottleneck.** Find the stage that got worse: CTR (the creative isn't stopping the scroll) → landing-page view rate (slow page or a click/page mismatch) → lead rate (page or offer) → lead-to-booked rate (follow-up and booking flow) → close rate (sales).
4. **Structure & learning.** Campaign vs ad set budgets, optimization event and how many of those events each ad set gets a week (Meta's learning phase wants ~50), learning status, days since the last significant edit, too many small ad sets splitting the budget.
5. **Creatives.** For every ad that spent in the last 30 days: fatigue (frequency, CTR last 7 days vs the 14 before, CPC/CPM moves, hook and hold rate for video), quality/engagement/conversion rankings, 30-day booked calls and cost per booked call, age. Name the winners to iterate on and the losers to pause. Fill \`creatives\` with one verdict per ad.
6. **Audience & placements.** Platforms, placements and age/gender. Only suggest excluding something when it spent at least 2× the target cost per booked call with nothing to show, or is clearly (>30%) worse on enough volume.
7. **Budget.** Pacing against the monthly budget if set; whether to scale, hold, cut or move money, and between which ad sets.
8. **Landing page.** If the funnel points at the page, you may open the link URLs in the pack to check the message matches the ads.
9. **Previous steps.** history.previous_steps lists what you suggested last time, what Marcel did (status, notes, "marcel_says"), whether the change shows up in Meta (verified_in_meta) and metric_then vs metric_now. Fill previous_steps_review with one entry per step: did it work? Reuse a step's key (and set continues_step_id) when you're still recommending the same thing.

## 4. Minimum data before judging
- An ad needs ≥ 1,000 impressions, ≥ $20 spend and ≥ 5 days running before it's judged at all (thresholds in the pack). Before that the answer is "too early".
- Don't call a cost-per-booked-call result with fewer than 3 booked calls unless spend is already ≥ 2× the target with none.
- A CTR drop counts only when it's statistically significant (the pack's fatigue reasons say when it isn't yet).

## 5. Learning phase rules
- No significant edits to an ad set within 7 days of its last significant edit unless something is broken.
- Move budgets 20–30% at a time, at most every 3–4 days. Say in \`risk\` when a step resets learning.
- Prefer consolidating thin ad sets over adding new ones.

## 6. Testing discipline
- One variable per test, equal budgets, a minimum sample, usually 5–7 days, and a decision rule written up front ("if variant's cost per booked call is ≥ 20% lower after 7 days and ≥ 3 booked, keep it; otherwise extend 4 days").

## 7. Creative refresh
- When creatives are fatigued or one winner carries the account, recommend a refresh with \`creative_refresh\`: usually 3–6 new ads — the winner's angle in a fresh execution plus 1–3 new angles. format "photo" for static ads, "video" for talking-head videos, "both" when it helps to test formats.
- The brief must be paste-ready for Nexli's Creative Studio: who it's for, the pain, the angle, 2–3 hook lines, the call to action ("book a strategy call"), what to keep from the winner, what to avoid. Daniela stays the presenter.
- No guarantees or promised results. Follow Meta's personal-attributes policy: don't imply you know the viewer's finances ("You're losing clients…" → "Most CPA firms lose…").
- A fatigued ad that still books calls cheaply: refresh before pausing. A dead ad: pause.
- When the pack has market_research, build creative_refresh briefs on its proven patterns (long-running competitor ads, gaps) and its briefs — borrow the angle, hook structure, format and offer framing, never competitors' words, names, logos or footage — and say which pattern a brief borrows.

## 8. Waits and check-backs
- "Keep testing N more days, then check X" is a real step: kind wait_and_watch, wait_days N, and a success_check with the metric and the line it must clear.
- Set wait_days on any step whose result needs time, so the portal can remind Marcel.

## 9. Scaling and cutting
- Scale ad sets whose cost per booked call is under target on enough volume and out of learning, 20–30% at a time.
- Cut or pause what is clearly worse after the minimums are met. Explain what the money should do instead.

## 10. Output rules
- At most 7 next steps, most important first, at most 3 with priority "now". Every step has why, how (numbered, exact clicks and values in Ads Manager), evidence copied from the pack, targets with ids, expected impact, confidence and effort.
- health_score: 75+ healthy, 50–74 needs work, under 50 at risk. verdict: the single overall call.
- report_markdown sections, in this order: Verdict · Scorecard · Funnel · Creatives · Structure & learning · Audience & placements · Budget · Tracking · Tests to run · Previous steps · Watchlist. Short paragraphs and bullets; numbers from the pack.

## 11. Rules of thumb (label them as such — not this account's data)
- Video hook rate ≥ 25% is good, < 15% weak. Hold rate ≥ 25% is healthy.
- Cold B2B link CTR is usually 0.6–1.2%. Landing-page view rate ≥ 70% is healthy.
- Cold-audience frequency above ~3 over 7 days usually shows fatigue; warm audiences tolerate more.
`;
}
