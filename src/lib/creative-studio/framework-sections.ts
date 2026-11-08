/**
 * Rulebook surgery for client studios (pure, no imports). Nexli's Kling
 * framework has two sections that are about Nexli's own business — §8, the
 * walkthrough of Nexli's system, and §9, Nexli's offer facts. A client firm's
 * scripts and copy must never borrow them, so they're cut out of the prompt
 * rather than just overruled.
 */

export const NEXLI_ONLY_SECTIONS = ["## 8. The system walkthrough", "## 9. Current Nexli offer facts"] as const;

/** The text with the section starting at `heading` (up to the next "## " heading) removed. */
export function withoutSection(text: string, heading: string): string {
  const i = text.indexOf(heading);
  if (i < 0) return text;
  const j = text.indexOf("\n## ", i + heading.length);
  return j < 0 ? text.slice(0, i).trimEnd() + "\n" : text.slice(0, i) + text.slice(j + 1);
}

/** The framework as a client firm's studio uses it: no Nexli walkthrough, no Nexli offer facts. */
export function withoutNexliSections(text: string): string {
  return NEXLI_ONLY_SECTIONS.reduce(withoutSection, text);
}
