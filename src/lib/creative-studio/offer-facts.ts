// Pure and client-safe: imported by the script writer's addendum, the scorer and the score card's rewrite notes.

/** Nexli's offer as it is today (Nov 19 2026), as the writer and the scorer read it. Keep in step with section 9 of kling-framework.md. */
export const OFFER_FACTS = `- $10,000 a month, with no setup fee.
- The ad budget is separate: at least $5,000 a month, paid by the firm straight to Meta on its own card. It never passes through Nexli.
- 10% performance pay on top of the monthly fee. Name it ("plus 10% performance pay, walked through on the call") and never explain it: no calculation, no example, and never call it a share of the firm's revenue.
- A signed six-month agreement, counted from signing, that renews six months at a time.`;

/**
 * Who Nexli sells to (Nov 19 2026, Marcel: "firms doing 1 million to 5
 * million plus", in the ads and all of the copy). It replaced "750K to 1
 * million a year". Keep in step with §3a and §9 of kling-framework.md.
 */
export const AUDIENCE = {
  /** Spoken by Daniela: plain digits and "million", the way §6 found Kling reads amounts best. */
  spoken: "1 million to 5 million plus a year",
  /** The framework's qualifier line, word for word. */
  qualifier: "This is for C-P-A firms doing 1 million to 5 million plus a year, who know they can 10x their business.",
  /** Written copy (ad text, on-screen text, prompts). */
  written: "$1M–$5M+ a year",
  /** Tight spaces (a 30-character description, an on-screen band). */
  short: "$1M–$5M+",
} as const;
