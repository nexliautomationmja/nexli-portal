import { NEXLI_IDENTITY_LINE, NEXLI_POLICY_LINKS, nexliLetterKind, nexliPaymentDisclosure } from "@/lib/nexli-legal";

/**
 * An engagement letter as something to keep or send: the plain text (Copy)
 * and the parts the PDF shares with the on-screen letter, so all three say
 * the same thing. The PDF itself is in engagement-pdf.ts (jsPDF, loaded only
 * when it's made).
 */

export interface ExportSigner {
  name: string;
  email: string;
  order: number;
  role: string | null;
  status: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  signatureData: string | null;
  signatureIp?: string | null;
}

export interface LetterExport {
  subject: string;
  content: string;
  /** The date at the top of the letter (when it was sent, else today). */
  date: string;
  fromName: string;
  fromCompany: string;
  signers: ExportSigner[];
}

/** A firm's letter: what the payment section says (Nexli's own letters use nexliPaymentDisclosure). */
export function firmPaymentDisclosure(company: string): string {
  return `Payments for services rendered under this engagement are processed through Stripe, Inc., a third-party payment processor. By executing this agreement, you acknowledge and agree that ${company} is not responsible for any payment holds, account freezes, processing delays, or disputes imposed by Stripe or your financial institution. To minimize processing issues, we recommend maintaining a complete and accurate business profile with your payment provider. All payment data is handled directly by Stripe in accordance with their security and privacy policies; ${company} does not store your full payment credentials.`;
}

export const FIRM_PLATFORM_LINE = "This document is delivered through the Nexli Portal platform. The platform provider is not a party to this agreement.";

/** The payment section under the letter: its heading, text and the small print. */
export function paymentSection(content: string, company: string): { heading: string; text: string; small: string; links: { label: string; href: string }[] } {
  const kind = nexliLetterKind(content);
  if (kind) {
    return { heading: "How Payments Work", text: nexliPaymentDisclosure(kind), small: NEXLI_IDENTITY_LINE, links: [...NEXLI_POLICY_LINKS] };
  }
  return { heading: "Payment Processing Disclosure", text: firmPaymentDisclosure(company), small: FIRM_PLATFORM_LINE, links: [] };
}

/** The date at the top of the letter. */
export function letterDate(sentAt: string | null | undefined): string {
  const d = sentAt ? new Date(sentAt) : new Date();
  return (isNaN(d.getTime()) ? new Date() : d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Nov 12, 2026, 3:04 PM" (empty when there's no date). */
export function stamp(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Nov 12, 2026" (empty when there's no date). */
export function shortDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The client signers (the sender, order 0, signs automatically). */
export const clientsOf = (signers: ExportSigner[]) => signers.filter((s) => s.order > 0).sort((a, b) => a.order - b.order);
export const senderOf = (signers: ExportSigner[]) => signers.find((s) => s.order === 0) ?? null;

/** Who the letter is for: the clients' names. */
export function preparedFor(signers: ExportSigner[]): string {
  return clientsOf(signers)
    .map((s) => s.name.trim())
    .filter(Boolean)
    .join(", ");
}

/** "Engagement Letter – Jordan Sample.pdf": safe in Mail, Files and on Windows. */
export function letterFileName(letter: Pick<LetterExport, "subject" | "signers">): string {
  const who = clientsOf(letter.signers)[0]?.name.trim() || letter.subject.trim() || "Engagement Letter";
  const clean = who
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `Engagement Letter - ${clean || "Client"}.pdf`;
}

/** What a signer's line under the letter says ("Signed Nov 12, 2026" / "Declined" / "Awaiting signature"). */
export function signerState(s: ExportSigner): string {
  if (s.signedAt) return `Signed ${shortDate(s.signedAt)}`;
  if (s.declinedAt || s.status === "declined") return `Declined${s.declinedAt ? ` ${shortDate(s.declinedAt)}` : ""}`;
  if (s.status === "expired") return "Not signed (voided or expired)";
  return "Awaiting signature";
}

/** The service provider's title under their signature. */
export function senderTitle(sender: ExportSigner | null, company: string): string {
  return sender?.role || (company ? `Authorized Representative, ${company}` : "Authorized Representative");
}

/** The whole letter as plain text — what Copy puts on the clipboard. */
export function letterText(letter: LetterExport): string {
  const company = letter.fromCompany || letter.fromName;
  const pay = paymentSection(letter.content, company);
  const sender = senderOf(letter.signers);
  const lines: string[] = [
    "ENGAGEMENT LETTER",
    letter.date,
    "",
    `Prepared for: ${preparedFor(letter.signers) || "—"}`,
    `Re: ${letter.subject || "—"}`,
    "",
    letter.content.replace(/\r\n?/g, "\n").trim(),
    "",
    pay.heading.toUpperCase(),
    pay.text,
    pay.small,
    ...(pay.links.length ? [pay.links.map((l) => `${l.label}: ${l.href}`).join(" · ")] : []),
    "",
    "Sincerely,",
    "",
    "SERVICE PROVIDER",
    letter.fromName || company || "—",
    senderTitle(sender, letter.fromCompany),
    ...(sender?.signedAt ? [`Signed ${shortDate(sender.signedAt)}`] : []),
  ];
  for (const s of clientsOf(letter.signers)) {
    lines.push("", "CLIENT", s.name || "—", s.email, signerState(s));
  }
  return lines.join("\n");
}
