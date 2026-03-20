import jsPDF from "jspdf";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SignerInfo {
  name: string;
  role?: string | null;
  signatureData?: string | null;
  signedAt?: string | Date | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(dateStr: string | Date): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function generateEngagementPDF(params: {
  subject: string;
  content: string;
  signers: SignerInfo[];
  fromName: string;
  fromCompany: string;
  date?: string;
}): void {
  const { subject, content, signers, fromName, fromCompany, date } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  /* ------ colours ------ */
  const DARK = "#111111";
  const MUTED = "#666666";
  const LIGHT_MUTED = "#9CA3AF";
  const BLUE = "#2563EB";

  /* ================================================================ */
  /*  Helper: check if we need a new page                             */
  /* ================================================================ */
  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
  }

  /* ================================================================ */
  /*  1. HEADER BAR                                                    */
  /* ================================================================ */

  // Dark header bar
  doc.setFillColor("#0a0a0f");
  doc.rect(0, 0, pageWidth, 48, "F");

  // "NEXLI" text in header (since we can't embed the logo image easily)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor("#FFFFFF");
  doc.text("NEXLI", margin, 31);

  // "Engagement Letter" label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor("#666680");
  doc.text("ENGAGEMENT LETTER", pageWidth - margin, 31, { align: "right" });

  y = 72;

  /* ================================================================ */
  /*  2. DATE + META                                                   */
  /* ================================================================ */

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(date || fmtDate(new Date()), margin, y);

  y += 24;

  // Prepared For / Re grid
  const colLeft = margin;
  const colRight = margin + contentWidth / 2 + 20;

  // Find client name (first non-CPA signer)
  const clientSigner = signers.find(
    (s) => !s.role?.includes("Representative")
  );
  const clientName = clientSigner?.name || signers[signers.length - 1]?.name || "";

  // Prepared For
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_MUTED);
  doc.text("PREPARED FOR", colLeft, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text(clientName, colLeft, y + 14);

  // Re
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_MUTED);
  doc.text("RE", colRight, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  const subjectLines = doc.splitTextToSize(subject, contentWidth / 2 - 20);
  doc.text(subjectLines, colRight, y + 14);

  y += 14 + subjectLines.length * 14 + 16;

  // Divider
  doc.setDrawColor("#E5E7EB");
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  /* ================================================================ */
  /*  3. DOCUMENT BODY                                                 */
  /* ================================================================ */

  const paragraphs = content
    ? content.split(/\n\n+/).filter((p) => p.trim())
    : [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    const isHeading = /^\d{1,2}\.\s+[A-Z]/.test(trimmed);
    const isTitle =
      trimmed === trimmed.toUpperCase() &&
      trimmed.length < 80 &&
      trimmed.length > 3 &&
      !/^\d/.test(trimmed);

    if (isHeading) {
      checkPageBreak(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(DARK);
      const lines = doc.splitTextToSize(trimmed, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 15 + 8;
    } else if (isTitle) {
      checkPageBreak(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(DARK);
      doc.text(trimmed, pageWidth / 2, y, { align: "center" });
      y += 22;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor("#374151");
      const lines = doc.splitTextToSize(trimmed, contentWidth);
      checkPageBreak(lines.length * 14 + 10);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 10;
    }
  }

  /* ================================================================ */
  /*  4. SIGNATURE BLOCK                                               */
  /* ================================================================ */

  checkPageBreak(120);

  y += 10;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#374151");
  doc.text("Sincerely,", margin, y);
  y += 28;

  const sigWidth = signers.length > 1 ? contentWidth / 2 - 10 : contentWidth;

  signers.forEach((signer, i) => {
    const xBase =
      signers.length > 1
        ? margin + (i % 2) * (contentWidth / 2 + 10)
        : margin;

    // If second row needed
    if (signers.length > 2 && i === 2) {
      y += 80;
    }

    const sigY = signers.length > 1 && i % 2 === 1 ? y : y;

    // Signature text (script-style)
    if (signer.signatureData) {
      doc.setFont("times", "italic");
      doc.setFontSize(22);
      doc.setTextColor("#1e293b");
      const sigLines = doc.splitTextToSize(signer.signatureData, sigWidth);
      doc.text(sigLines, xBase, sigY);
    }

    // Signature line
    const lineY = sigY + 12;
    doc.setDrawColor("#374151");
    doc.setLineWidth(0.5);
    doc.line(xBase, lineY, xBase + Math.min(sigWidth, 180), lineY);

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    doc.text(signer.name, xBase, lineY + 14);

    // Role
    if (signer.role) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(MUTED);
      doc.text(signer.role, xBase, lineY + 26);
    }

    // Signed date
    if (signer.signedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(LIGHT_MUTED);
      doc.text(`Signed ${fmtDate(signer.signedAt)}`, xBase, lineY + (signer.role ? 37 : 26));
    }
  });

  /* ================================================================ */
  /*  5. FOOTER                                                        */
  /* ================================================================ */

  const footerY = pageHeight - 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_MUTED);
  doc.text("Powered by Nexli", pageWidth / 2, footerY, { align: "center" });

  // Add footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(LIGHT_MUTED);
    doc.text("Powered by Nexli", pageWidth / 2, footerY, { align: "center" });
  }

  /* ================================================================ */
  /*  6. DOWNLOAD                                                      */
  /* ================================================================ */

  const safeName = subject.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
  doc.save(`Engagement-${safeName}.pdf`);
}
