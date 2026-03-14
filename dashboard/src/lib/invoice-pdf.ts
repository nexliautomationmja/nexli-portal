import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function fmtCurrency(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100;
  const symbols: Record<string, string> = {
    usd: "$",
    cad: "CA$",
    gbp: "\u00A3",
    eur: "\u20AC",
    aud: "A$",
  };
  return `${symbols[currency] || "$"}${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtQty(raw: number): string {
  const val = raw / 100;
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "#16a34a";
    case "overdue":
      return "#dc2626";
    case "draft":
      return "#9ca3af";
    default:
      return "#2563EB";
  }
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

export function generateInvoicePDF(params: {
  invoiceNumber: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string | null;
  fromName: string;
  fromCompany?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  terms?: string | null;
}): void {
  const {
    invoiceNumber,
    status,
    currency,
    issueDate,
    dueDate,
    clientName,
    clientEmail,
    clientCompany,
    fromName,
    fromCompany,
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total,
    amountPaid,
    balanceDue,
    notes,
    terms,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  /* ------ colours ------ */
  const DARK = "#111111";
  const MUTED = "#666666";
  const BLUE = "#2563EB";
  const LIGHT_BG = "#F9FAFB";

  /* ================================================================ */
  /*  1. HEADER                                                       */
  /* ================================================================ */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(DARK);
  doc.text("INVOICE", margin, y);

  /* Status badge */
  const badge = statusLabel(status);
  doc.setFontSize(11);
  const badgeWidth = doc.getTextWidth(badge) + 16;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = y - 14;
  doc.setFillColor(statusColor(status));
  doc.roundedRect(badgeX, badgeY, badgeWidth, 20, 4, 4, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.text(badge, badgeX + 8, badgeY + 14);

  y += 8;

  /* Invoice number */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`# ${invoiceNumber}`, margin, y + 14);

  y += 38;

  /* ================================================================ */
  /*  2. FROM / BILL TO (side by side)                                */
  /* ================================================================ */

  const colLeft = margin;
  const colRight = margin + contentWidth / 2 + 20;

  /* -- From -- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("FROM", colLeft, y);

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text(fromName, colLeft, y);

  if (fromCompany) {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(fromCompany, colLeft, y);
  }

  /* -- Bill To (starts at same baseline as FROM heading) -- */
  let yRight = y - (fromCompany ? 28 : 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("BILL TO", colRight, yRight);

  yRight += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text(clientName, colRight, yRight);

  if (clientCompany) {
    yRight += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(clientCompany, colRight, yRight);
  }

  yRight += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(clientEmail, colRight, yRight);

  y = Math.max(y, yRight) + 30;

  /* ================================================================ */
  /*  3. DATES                                                        */
  /* ================================================================ */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("ISSUE DATE", colLeft, y);
  doc.text("DUE DATE", colLeft + 160, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(DARK);
  doc.text(fmtDate(issueDate), colLeft, y);
  doc.text(fmtDate(dueDate), colLeft + 160, y);

  y += 30;

  /* ================================================================ */
  /*  4. LINE ITEMS TABLE                                             */
  /* ================================================================ */

  const tableBody = lineItems.map((item) => [
    item.description,
    fmtQty(item.quantity),
    fmtCurrency(item.unitPrice, currency),
    fmtCurrency(item.amount, currency),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: LIGHT_BG,
      textColor: MUTED,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
    },
    bodyStyles: {
      textColor: DARK,
      fontSize: 10,
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    alternateRowStyles: {
      fillColor: "#FFFFFF",
    },
    didDrawPage: () => {
      /* no-op, keeps reference intact */
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 20;

  /* ================================================================ */
  /*  5. TOTALS                                                       */
  /* ================================================================ */

  const totalsX = pageWidth - margin - 200;
  const totalsValX = pageWidth - margin;
  const lineSpacing = 20;

  function drawTotalRow(
    label: string,
    value: string,
    options?: { bold?: boolean; color?: string; size?: number }
  ) {
    const { bold = false, color = DARK, size = 10 } = options || {};
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(MUTED);
    doc.text(label, totalsX, y);
    doc.setTextColor(color);
    doc.text(value, totalsValX, y, { align: "right" });
    y += lineSpacing;
  }

  /* Divider line */
  doc.setDrawColor("#E5E7EB");
  doc.setLineWidth(0.5);
  doc.line(totalsX, y - 10, totalsValX, y - 10);
  y += 4;

  drawTotalRow("Subtotal", fmtCurrency(subtotal, currency));

  if (taxRate > 0) {
    const taxPct = (taxRate / 100).toFixed(2) + "%";
    drawTotalRow(`Tax (${taxPct})`, fmtCurrency(taxAmount, currency));
  }

  /* Divider */
  doc.setDrawColor("#E5E7EB");
  doc.line(totalsX, y - 10, totalsValX, y - 10);
  y += 4;

  drawTotalRow("Total", fmtCurrency(total, currency), {
    bold: true,
    size: 12,
  });

  if (amountPaid > 0) {
    drawTotalRow("Amount Paid", fmtCurrency(amountPaid, currency), {
      color: "#16a34a",
    });
  }

  /* Balance due - prominent */
  doc.setDrawColor(BLUE);
  doc.setLineWidth(1);
  doc.line(totalsX, y - 10, totalsValX, y - 10);
  y += 6;

  drawTotalRow("Balance Due", fmtCurrency(balanceDue, currency), {
    bold: true,
    color: BLUE,
    size: 13,
  });

  y += 10;

  /* ================================================================ */
  /*  6. NOTES & TERMS                                                */
  /* ================================================================ */

  if (notes) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("NOTES", margin, y);

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    const noteLines = doc.splitTextToSize(notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 14 + 10;
  }

  if (terms) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("TERMS", margin, y);

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    const termLines = doc.splitTextToSize(terms, contentWidth);
    doc.text(termLines, margin, y);
    y += termLines.length * 14 + 10;
  }

  /* ================================================================ */
  /*  7. FOOTER                                                       */
  /* ================================================================ */

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#9CA3AF");
  doc.text("Powered by Nexli", pageWidth / 2, footerY, { align: "center" });

  /* ================================================================ */
  /*  8. DOWNLOAD                                                     */
  /* ================================================================ */

  doc.save(`Invoice-${invoiceNumber}.pdf`);
}
