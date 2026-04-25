/**
 * Sender signature helpers.
 *
 * The sender (the CPA / firm owner) has their signature auto-attached when
 * an engagement letter or e-sign request is created. We render their typed
 * name as an SVG in a cursive script font and store it as a data URL, so
 * the same `signatureData` column the client signature uses can hold it
 * with no schema changes.
 *
 * SVG-as-image cannot load Google Fonts (no @font-face), so we fall back to
 * the universally-available "Brush Script MT" / "Snell Roundhand" / cursive
 * font stack. Visually similar to Dancing Script and works in all browsers.
 */

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Generate a base64-encoded SVG data URL of `name` rendered in a cursive
 * script font. Output dimensions match the client signature canvas (600x180)
 * so it slots into the same UI blocks.
 */
export function generateSenderSignatureSvgDataUrl(name: string): string {
  const trimmed = name.trim() || "—";
  const escaped = escapeXml(trimmed);

  // Auto-shrink font for long names so they fit in 600px width
  const length = trimmed.length;
  let fontSize = 84;
  if (length > 12) fontSize = 72;
  if (length > 18) fontSize = 60;
  if (length > 26) fontSize = 48;
  if (length > 36) fontSize = 38;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180"><text x="300" y="105" font-family="'Brush Script MT','Snell Roundhand','Lucida Handwriting','Apple Chancery',cursive" font-size="${fontSize}" font-style="italic" font-weight="500" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${escaped}</text></svg>`;

  // Use Buffer when available (server), btoa fallback for browser callers.
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : (typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(svg))) : "");

  return `data:image/svg+xml;base64,${base64}`;
}
