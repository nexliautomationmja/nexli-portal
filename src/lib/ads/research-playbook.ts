/**
 * How Manus researches the Meta Ad Library for Nexli: a short prompt (Manus
 * caps prompt text at ~5,000 tokens; files don't count) plus the playbook as
 * a Markdown file. Look only, judge by longevity and versions (spend is never
 * public for US ads), replicate patterns — never competitors' words, names,
 * logos or footage — and hand back ready-to-make Creative Studio prompts.
 */

export const RESEARCH_PLAYBOOK_VERSION = "ads-research-playbook-v1";

export const RESEARCH_SEEDS = [
  "CPA marketing",
  "accounting firm marketing",
  "CPA lead generation",
  "clients for CPA firms",
  "tax firm marketing",
  "grow your accounting firm",
  "Facebook ads for accountants",
  "bookkeeping clients",
  "advisory clients CPA",
  "fractional CFO clients",
  "done for you client acquisition",
  "more tax clients",
] as const;

export const ADJACENT_SEEDS = ["financial advisor appointments", "law firm marketing agency", "professional services lead generation"] as const;

export const RESEARCH_AUTO_REPLY =
  "This request comes from an automated tool, so nobody can answer questions right now. Use your judgment and finish now with the ads you've found. Look only — never log in, fill in forms or message anyone.";

export function researchPromptText(opts: { today: string; stills: number; hasConnector: boolean; competitors: number }): string {
  return [
    "You are a senior direct-response creative strategist researching the Meta Ad Library for Nexli. Nexli sells the Digital Rainmaker System — done-for-you client acquisition (Meta ads, landing page, follow-up, booked strategy calls) — to owners of US CPA and accounting firms.",
    `Goal (${opts.today}): find the ads that work in this market — ads aimed at CPA / accounting firm owners and offers like Nexli's — and turn their patterns into creatives Nexli can make with its presenter Daniela, so it gets more booked calls.`,
    "Attached:",
    "- research-pack.json — Nexli's offer, its own top ads with results, what its last analysis found, competitors to always check, search keywords, and the previous research.",
    "- research-playbook.md — the method. Follow it.",
    opts.stills ? `- ${opts.stills} still${opts.stills > 1 ? "s" : ""} of Nexli's own top ads (ours-NN-<ad id>.jpg).` : null,
    opts.hasConnector ? "An Ad Library connector is available — use it to search; open ads on the public Ad Library site to confirm details and take screenshots." : "Use the public Ad Library website (facebook.com/ads/library) — it needs no login.",
    opts.competitors ? `Check all ${opts.competitors} competitors listed in competitors_to_check.` : null,
    "Hard rules:",
    "1. Look only. Never log in, sign up, fill in forms, message, like or follow anyone, and don't click through to lead forms. If a page asks you to log in, skip it and list it in searched.blocked.",
    "2. Record only what you actually saw. Leave a field null when it isn't shown.",
    "3. Spend and reach are never public for US ads — judge what works by how long an ad has run and how many versions exist.",
    "4. Replicate the pattern — angle, hook structure, format, offer framing — never the words, names, logos or footage. Daniela presents. No guarantees or promised results.",
    "5. Screenshot each ad you record: name the files ad-01.png, ad-02.png… in the same order as ads[], one per ad, and attach each as its own PNG (not a zip).",
    "6. Nobody can answer questions. Finish within about 45 minutes; partial results beat nothing.",
    "Deliver: fill every field of the structured output, and also attach the same JSON as ads-research.json plus the screenshots in your final message. Put the full written report in report_markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function researchPlaybookMarkdown(): string {
  return `# Nexli Ad Library research playbook (${RESEARCH_PLAYBOOK_VERSION})

## 1. Scope
- Anyone advertising to owners of US CPA or accounting firms: marketing agencies, lead-gen companies, coaches and consultants, software, associations and media.
- Offers like Nexli's: done-for-you client acquisition, appointment setting, "more clients" programs for accountants.
- Adjacent professional-services lead gen (financial advisors, law firms) only when an ad has run 90+ days — for patterns, not as competitors.

## 2. How to search (public site, no login)
- Keyword: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&media_type=all&q=<keyword>&search_type=keyword_unordered
- An advertiser's ads: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&view_all_page_id=<page id>&search_type=page
- Order: (1) everything in competitors_to_check, (2) re-check previous_research's long-runners (still running? new versions?), (3) seed_keywords, (4) phrases from Nexli's own top hooks in our_ads (to find creatives similar to Nexli's), (5) the page of every promising advertiser you find.

## 3. What to pick
- 15–30 active ads. Prefer ones running 30+ days and with 3+ versions ("This ad has multiple versions" / "N ads use this creative and text").
- At most 4 ads per advertiser. Mix formats; include at least 5 vertical 9:16 videos when they exist.
- Skip ads that clearly aren't aimed at accounting / CPA firm owners (unless rule 1's adjacent exception applies).

## 4. What to record (from the ad card)
- Library ID, advertiser and page link, "Started running on" date (YYYY-MM-DD), platforms shown, versions.
- Format: video_9x16 (vertical video), video_other, image, carousel.
- The hook: the first line of text, or the first words spoken or shown on screen.
- Angle, offer, call to action button, landing page domain, a short excerpt of the text.
- why_it_works: your read of why it's lasted — hook, proof, offer, format.

## 5. Screenshots
- One screenshot per recorded ad: the whole card (creative + copy). For a video, the first frame; for a carousel, the first card.
- Name them ad-01.png, ad-02.png… in the same order as ads[], and set screenshot_file to the name.

## 6. Compare with Nexli
- similar_to_our_ad_id: the id from our_ads an ad most resembles, if any.
- replicate_ours: Nexli's own ads worth making more of (winners, or close to a proven market pattern), with how to extend them.
- gaps: angles or formats that work elsewhere but nobody in this market uses well.

## 7. Briefs ("make these next")
- 4–8 briefs. Each has a creative_studio_prompt that is complete on its own (max 1,500 characters) and written for Nexli's Creative Studio:
  - who it's for (CPA / accounting firm owners), the pain, the angle, 2–3 hook lines, Daniela's scene, the offer framing, the call to action "Book a strategy call", what to borrow from the pattern, what to avoid.
- format "photo" (static ad with the headline on the image; count 3–6) or "video" (talking-head video; count 2–4).
- source: competitor (a long-running pattern), ours (more of a Nexli winner) or gap.
- Never use competitors' names, wording, logos or footage. No fake testimonials, invented numbers or guarantees. Follow Meta's personal-attributes policy: don't imply you know the viewer's finances.

## 8. Longevity
- Under 14 days: new. 14–29: testing. 30–89: proven. 90+: evergreen.

## 9. Time and safety
- About 45 minutes. Stop at 30 ads. If a page is blocked or wants a login, skip it and note it.

## 10. Report (report_markdown) order
Summary · What's working in the market · Gaps you can own · Competitors · Standout ads · Nexli's ads vs the market · Make these next.
`;
}
