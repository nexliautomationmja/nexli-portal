import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OwnerBranding } from "@/lib/branding";
import {
  clientsOf,
  paymentSection,
  preparedFor,
  senderOf,
  senderTitle,
  signerState,
  stamp,
  type ExportSigner,
  type LetterExport,
} from "@/lib/engagement-export";

/**
 * An engagement letter as a PDF (browser only: images go through a canvas).
 * Same content as the letter on screen — letterhead, date, who it's for, the
 * full text, the payment section, every signature — plus a signing record
 * (sent / viewed / signed, with the IP the signature came from). Real text,
 * so it's searchable and stays small enough to email.
 */

const PAGE = { w: 612, h: 792 }; // US Letter, points
const M = 54; // side margins
const TOP = 60; // where text starts on pages after the first
const BOTTOM = PAGE.h - 54; // text stops here (the footer sits below)
const CONTENT_W = PAGE.w - M * 2;

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const RULE = "#e5e7eb";

// Characters the built-in PDF fonts can't draw (they'd garble the whole line) → plain ones.
const SWAP: Record<string, string> = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u21d2": "=>",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u2248": "~",
  "\u2260": "!=",
  "\u2212": "-",
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2015": "\u2014",
  "\u2713": "(yes)",
  "\u2714": "(yes)",
  "\u2717": "(no)",
  "\u2718": "(no)",
  "\u2605": "*",
  "\u2606": "*",
  "\u25aa": "\u2022",
  "\u25e6": "\u2022",
  "\u25cf": "\u2022",
  "\u25cb": "\u2022",
  "\u25a0": "\u2022",
  "\u25a1": "\u2022",
  "\u2023": "\u2022",
  "\u2043": "-",
  "\u2500": "-",
  "\u2028": "\n",
  "\u2029": "\n",
  "\u00ad": "",
  "\u200b": "",
  "\u200c": "",
  "\u200d": "",
  "\u2060": "",
  "\ufeff": "",
  "\u202f": " ",
  "\u2009": " ",
  "\u2002": " ",
  "\u2003": " ",
  "\u2007": " ",
  "\u0009": "    ",
};
const CP1252_EXTRA = new Set([0x20ac, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x17d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x17e, 0x178]);

/** Text the PDF's built-in fonts (Windows-1252) can draw: odd symbols swapped, accents kept, the rest stripped of marks or dropped. */
export function pdfSafe(input: string): string {
  let out = "";
  for (const ch of input.replace(/\r\n?/g, "\n")) {
    const c = ch.codePointAt(0)!;
    if (ch === "\n" || (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.has(c)) out += ch;
    else if (ch in SWAP) out += SWAP[ch];
    else if (c < 0x20 || (c >= 0x2190 && c <= 0x2bff) || (c >= 0xfe00 && c <= 0xfe0f) || c >= 0x1f000) out += ""; // emoji and symbols: left out
    else {
      const plain = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      out += plain && [...plain].every((p) => p.codePointAt(0)! < 0x7f) ? plain : "?";
    }
  }
  return out;
}

interface Picture {
  data: string;
  w: number;
  h: number;
}

/** An image (URL or data URL, PNG / JPEG / SVG) as a PNG data URL, or null when it can't be read. */
function picture(src: string | null | undefined, scale = 2, maxW = 1600): Promise<Picture | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    const done = (v: Picture | null) => resolve(v);
    const timer = setTimeout(() => done(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w0 = img.naturalWidth || img.width || 600;
        const h0 = img.naturalHeight || img.height || 180;
        const k = Math.min(scale, maxW / w0);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w0 * k));
        canvas.height = Math.max(1, Math.round(h0 * k));
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        done({ data: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height });
      } catch {
        done(null); // a logo from another site without CORS taints the canvas
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = src;
  });
}

/** A short paragraph in capitals ("2. FEES AND PAYMENT", the title lines) reads as a heading. */
const isHeading = (p: string) => {
  const lines = p.split("\n");
  return lines.length <= 3 && lines.every((l) => l.trim().length <= 90) && /[A-Z]/.test(p) && !/[a-z]/.test(p);
};

export interface EngagementPdfInput extends LetterExport {
  branding: OwnerBranding;
}

/** The letter as a PDF file (Blob). */
export async function engagementPdf(input: EngagementPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const company = input.fromCompany || input.fromName;
  const clients = clientsOf(input.signers);
  const sender = senderOf(input.signers);
  const sigs = [sender, ...clients].filter((s): s is ExportSigner => Boolean(s));
  const [logo, ...sigPics] = await Promise.all([picture(input.branding.logoUrl, 1, 1200), ...sigs.map((s) => picture(s.signatureData))]);
  const sigPic = new Map(sigs.map((s, i) => [s, sigPics[i]]));

  doc.setProperties({ title: pdfSafe(input.subject || "Engagement Letter"), subject: "Engagement Letter", author: pdfSafe(company), creator: "Nexli Portal" });

  let y = 0;
  const label = (text: string, x: number, at: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(FAINT);
    doc.setCharSpace(0.8);
    doc.text(pdfSafe(text.toUpperCase()), x, at);
    doc.setCharSpace(0);
  };
  const room = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  // ── Letterhead (first page) ──
  const bandH = 66;
  doc.setFillColor("#0a0a0f");
  doc.rect(0, 0, PAGE.w, bandH, "F");
  if (input.branding.brandColor) {
    doc.setFillColor(input.branding.brandColor);
    doc.rect(0, 0, PAGE.w, 4, "F");
  }
  if (logo) {
    let h = 24;
    let w = (logo.w / logo.h) * h;
    if (w > 200) {
      w = 200;
      h = (logo.h / logo.w) * w;
    }
    doc.addImage(logo.data, "PNG", M, (bandH - h) / 2 + 2, w, h);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor("#ffffff");
    doc.text(pdfSafe(input.branding.displayName), M, bandH / 2 + 7);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor("#6b6b70");
  doc.setCharSpace(1);
  doc.text("ENGAGEMENT LETTER", PAGE.w - M, bandH / 2 + 5, { align: "right" });
  doc.setCharSpace(0);

  // ── Date, prepared for, re ──
  y = bandH + 34;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(pdfSafe(input.date), M, y);
  y += 26;
  const colW = (CONTENT_W - 24) / 2;
  label("Prepared for", M, y);
  label("Re", M + colW + 24, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  const forLines: string[] = doc.splitTextToSize(pdfSafe(preparedFor(input.signers) || "—"), colW);
  const reLines: string[] = doc.splitTextToSize(pdfSafe(input.subject || "—"), colW);
  doc.text(forLines, M, y, { lineHeightFactor: 1.35 });
  doc.text(reLines, M + colW + 24, y, { lineHeightFactor: 1.35 });
  y += Math.max(forLines.length, reLines.length) * 10.5 * 1.35 + 14;
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.75);
  doc.line(M, y, PAGE.w - M, y);
  y += 26;

  // ── The letter ──
  const size = 10.5;
  const lead = 15.5;
  const paragraphs = pdfSafe(input.content)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+$/, ""))
    .filter((p) => p.trim());
  paragraphs.forEach((para, i) => {
    const heading = isHeading(para.trim());
    if (i > 0) y += heading ? 12 : 8;
    doc.setFont("times", heading ? "bold" : "normal");
    doc.setFontSize(heading ? 11 : size);
    doc.setTextColor(heading ? INK : BODY);
    const lines: string[] = para.split("\n").flatMap((l) => (l.trim() ? (doc.splitTextToSize(l, CONTENT_W) as string[]) : [""]));
    // A heading never sits alone at the bottom of a page.
    if (heading) room(lead * 3);
    for (const line of lines) {
      room(lead);
      y += lead;
      doc.text(line, M, y - 4);
    }
  });

  // ── Payment section ──
  const pay = paymentSection(input.content, company);
  y += 22;
  room(60);
  doc.setDrawColor(RULE);
  doc.line(M, y, PAGE.w - M, y);
  y += 20;
  label(pay.heading, M, y);
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED);
  for (const line of doc.splitTextToSize(pdfSafe(pay.text), CONTENT_W) as string[]) {
    room(13.5);
    y += 13.5;
    doc.text(line, M, y - 3);
  }
  y += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(FAINT);
  for (const line of doc.splitTextToSize(pdfSafe(pay.small), CONTENT_W) as string[]) {
    room(12);
    y += 12;
    doc.text(line, M, y - 3);
  }
  if (pay.links.length) {
    room(12);
    y += 12;
    let x = M;
    pay.links.forEach((l, i) => {
      if (i > 0) {
        doc.text(" · ", x, y - 3);
        x += doc.getTextWidth(" · ");
      }
      doc.textWithLink(l.label, x, y - 3, { url: l.href });
      x += doc.getTextWidth(l.label);
    });
  }

  // ── Signatures: the service provider, then every client ──
  y += 26;
  room(30 + 112);
  doc.setFont("times", "normal");
  doc.setFontSize(size);
  doc.setTextColor(BODY);
  doc.text("Sincerely,", M, y);
  y += 22;
  const cellW = (CONTENT_W - 32) / 2;
  const cellH = 112;
  sigs.forEach((s, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) y += cellH;
    if (col === 0) room(cellH);
    const x = M + col * (cellW + 32);
    const isSender = s === sender;
    label(isSender ? "Service provider" : "Client", x, y);
    const lineY = y + 54;
    const pic = sigPic.get(s);
    if (pic && s.signatureData) {
      const maxH = 42;
      let w = (pic.w / pic.h) * maxH;
      let h = maxH;
      if (w > cellW) {
        w = cellW;
        h = (pic.h / pic.w) * cellW;
      }
      doc.addImage(pic.data, "PNG", x, lineY - 4 - h, w, h);
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(FAINT);
      doc.text(s.status === "declined" ? "Declined" : "Awaiting signature", x, lineY - 6);
    }
    doc.setDrawColor(BODY);
    doc.setLineWidth(0.75);
    doc.line(x, lineY, x + cellW, lineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(pdfSafe(isSender ? input.fromName || company || "—" : s.name || "—"), x, lineY + 15, { maxWidth: cellW });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    doc.text(pdfSafe(isSender ? senderTitle(sender, input.fromCompany) : s.email), x, lineY + 28, { maxWidth: cellW });
    if (s.signedAt || s.declinedAt) {
      doc.setFontSize(8);
      doc.setTextColor(FAINT);
      doc.text(pdfSafe(signerState(s)), x, lineY + 40);
    }
  });
  y += cellH;

  // ── Signing record ──
  if (clients.length) {
    y += 10;
    room(90);
    label("Signing record", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: PAGE.h - BOTTOM },
      head: [["Signer", "Status", "Sent", "Viewed", "Signed", "IP address"]],
      body: [sender, ...clients]
        .filter((s): s is ExportSigner => Boolean(s))
        .map((s) => [
          pdfSafe(`${s === sender ? input.fromName || company : s.name}\n${s.email}`),
          s === sender || s.signedAt ? "Signed" : s.declinedAt ? `Declined\n${stamp(s.declinedAt)}` : s.status === "expired" ? "Voided / expired" : s.viewedAt ? "Viewed" : "Sent",
          stamp(s.sentAt) || "—",
          stamp(s.viewedAt) || "—",
          stamp(s.signedAt) || "—",
          s === sender ? "—" : s.signatureIp?.split(",")[0]?.trim() || "—",
        ]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 7.5, textColor: BODY, cellPadding: { top: 5, bottom: 5, left: 5, right: 5 }, overflow: "linebreak", valign: "top" },
      headStyles: { fontStyle: "bold", textColor: MUTED, fillColor: "#f9fafb", fontSize: 7 },
      columnStyles: { 0: { cellWidth: 112 }, 1: { cellWidth: 60 }, 5: { cellWidth: 62 } },
      didDrawCell: (d) => {
        if (d.section === "body" && d.column.index === 0) {
          doc.setDrawColor(RULE);
          doc.setLineWidth(0.5);
          doc.line(M, d.cell.y + d.cell.height, PAGE.w - M, d.cell.y + d.cell.height);
        }
      },
    });
  }

  // ── Every page: a small header after the first, and the footer ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(FAINT);
    if (p > 1) {
      const head = doc.splitTextToSize(pdfSafe(input.subject || "Engagement Letter"), CONTENT_W - 110)[0] as string;
      doc.text(head, M, 34);
      doc.text("Engagement Letter", PAGE.w - M, 34, { align: "right" });
    }
    doc.text(pdfSafe(company || input.branding.displayName), M, PAGE.h - 28);
    doc.text(`Page ${p} of ${pages}`, PAGE.w - M, PAGE.h - 28, { align: "right" });
  }

  return doc.output("blob");
}
