// Readability (Oct 2026 review): Syne's stylised numerals read oddly, so
// figures use Plus Jakarta Sans with lining, evenly spaced digits, and the
// long-form contract text uses it too. Syne stays on word headings only.
export const READ_FONT: React.CSSProperties = {
  fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
};
export const NUM_FONT: React.CSSProperties = {
  fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
  fontVariantNumeric: "lining-nums tabular-nums",
  letterSpacing: "-0.01em",
};
