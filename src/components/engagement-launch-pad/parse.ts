// ─── Parsing the plain-text engagement letter ──────────────
// Splits the stored letter into its preamble and numbered sections without
// changing a single word: every paragraph renders verbatim, only the
// presentation around it differs.

import { SETUP_SCOPE } from "@/lib/drs-pricing";

export function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const SMALL_WORDS = new Set(["of", "and", "the", "a", "an", "to", "in", "for", "on", "or"]);

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export const HEADING_RE = /^(\d+)\. ([A-Z0-9 ,&'’\-\/()]+)$/gm;
export const CLAUSE_RE = /^([a-z])\) /;
export const AMOUNT_RE = /\$[\d,]+\.\d{2}/;
/** DRS Section 1 sub-group headings ("Platform Build", "Automations", …). */
export const GROUP_TITLES = new Set(SETUP_SCOPE.map((g) => g.title));

export interface Section {
  num: number;
  heading: string; // exact heading text, e.g. "SCOPE OF SERVICES"
  title: string; // title case
  paragraphs: string[];
}

export interface ParsedLetter {
  preamble: string[];
  sections: Section[];
}

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function parseLetter(text: string): ParsedLetter {
  const matches = [...text.matchAll(HEADING_RE)];
  const preamble = splitParagraphs(matches.length ? text.slice(0, matches[0].index) : text);
  const sections = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    return {
      num: Number(m[1]),
      heading: m[2].trim(),
      title: titleCase(m[2].trim()),
      paragraphs: splitParagraphs(text.slice(start, end)),
    };
  });
  return { preamble, sections };
}

/** The number of the section with this exact heading, or null when absent. */
export function findSectionNum(sections: Section[], heading: string): number | null {
  return sections.find((s) => s.heading === heading)?.num ?? null;
}

export interface Clause {
  letter: string;
  label: string | null; // text before the first " — " or ":" (when short)
  sep: string; // the separator exactly as written
  rest: string;
}

/** Splits "a) Label: rest" / "a) Label — rest" without changing any wording. */
export function parseClause(p: string): Clause | null {
  const m = p.match(CLAUSE_RE);
  if (!m) return null;
  const body = p.slice(m[0].length);
  const dash = body.indexOf(" — ");
  const colon = body.indexOf(":");
  const candidates = [dash, colon].filter((n) => n > 0);
  const at = candidates.length ? Math.min(...candidates) : -1;
  // Only treat it as a label when it's a short lead-in, not a long sentence.
  if (at > 0 && at <= 60) {
    const sep = at === dash ? " — " : ":";
    return { letter: m[1], label: body.slice(0, at), sep, rest: body.slice(at + sep.length) };
  }
  return { letter: m[1], label: null, sep: "", rest: body };
}
