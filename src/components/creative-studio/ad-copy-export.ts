/**
 * Exports for a batch of Meta ad copy (up to 20 creatives): a CSV with one row
 * per creative (opens cleanly in Sheets / Excel, emojis included) and a
 * readable plain-text version for the clipboard.
 */
export interface ExportRow {
  filename: string;
  copy: { primaryTexts: string[]; headlines: string[]; description: string; cta: string } | null;
}

export const MAX_CREATIVES = 20;
const VERSIONS = 4;

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function copyCsv(rows: ExportRow[]): string {
  const header = [
    "Creative",
    ...Array.from({ length: VERSIONS }, (_, i) => `Primary text ${i + 1}`),
    ...Array.from({ length: VERSIONS }, (_, i) => `Headline ${i + 1}`),
    "Description",
    "Button",
  ];
  const lines = rows.map((r) =>
    [
      r.filename,
      ...Array.from({ length: VERSIONS }, (_, i) => r.copy?.primaryTexts[i] ?? ""),
      ...Array.from({ length: VERSIONS }, (_, i) => r.copy?.headlines[i] ?? ""),
      r.copy?.description ?? "",
      r.copy?.cta ?? "",
    ]
      .map(cell)
      .join(",")
  );
  // BOM so Excel reads UTF-8 (emojis); CRLF rows per RFC 4180.
  return `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`;
}

export function copyAllText(rows: ExportRow[]): string {
  return rows
    .map((r, n) => {
      if (!r.copy) return `━━ ${n + 1}. ${r.filename} ━━\n(no copy yet)`;
      const texts = r.copy.primaryTexts.map((t, i) => `— Primary text ${i + 1} —\n${t}`).join("\n\n");
      const heads = r.copy.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
      return `━━ ${n + 1}. ${r.filename} ━━\n\n${texts}\n\nHeadlines:\n${heads}\n\nDescription: ${r.copy.description}\nButton: ${r.copy.cta}`;
    })
    .join("\n\n\n");
}

/** Keep the files the tool accepts, up to the cap (counting what's already queued). */
export function acceptFiles(files: File[], already: number, accept: string[]): { ok: File[]; dropped: number; wrongType: number } {
  const right = files.filter((f) => accept.includes(f.type));
  const room = Math.max(0, MAX_CREATIVES - already);
  return { ok: right.slice(0, room), dropped: Math.max(0, right.length - room), wrongType: files.length - right.length };
}
