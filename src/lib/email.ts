import { Resend } from "resend";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import {
  NEXLI_BRANDING,
  absoluteLogoUrl,
  type OwnerBranding,
} from "@/lib/branding";
import { NEXLI_LEGAL, NEXLI_POLICY_LINKS } from "@/lib/nexli-legal";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Nexli Portal <portal@documents.nexli.net>";

/** The bare verified sender address parsed out of FROM_EMAIL. */
const FROM_ADDRESS = (() => {
  const match = FROM_EMAIL.match(/<([^>]+)>/);
  return (match ? match[1] : FROM_EMAIL).trim();
})();

/**
 * Build the RFC 5322 From header. The address is always the verified sender;
 * only the display name changes per firm (e.g. "Smith CPA via Nexli Portal").
 */
function buildFrom(fromName?: string): string {
  const name = fromName?.trim();
  if (!name) return FROM_EMAIL;
  // Quote the display name so commas / punctuation in firm names are safe.
  const safe = name.replace(/["\\\r\n]/g, "");
  return `"${safe}" <${FROM_ADDRESS}>`;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Optional From display name; the address stays the verified sender. */
  fromName?: string;
  /** Where replies go. Only Nexli's own client emails set it (mail@nexli.net); never on a firm's white-label email. */
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, fromName, replyTo }: SendEmailParams) {
  const { data, error } = await getResend().emails.send({
    from: buildFrom(fromName),
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    console.error("Email send failed:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return { id: data?.id };
}

interface SendEmailWithLogParams extends SendEmailParams {
  recipientName?: string;
  emailType: string;
  relatedId?: string;
  sentBy?: string;
}

export async function sendEmailWithLog({
  to,
  subject,
  html,
  fromName,
  replyTo,
  recipientName,
  emailType,
  relatedId,
  sentBy,
}: SendEmailWithLogParams) {
  try {
    const result = await sendEmail({ to, subject, html, fromName, replyTo });
    await db.insert(emailLog).values({
      recipientEmail: to,
      recipientName,
      subject,
      emailType,
      relatedId,
      status: "sent",
      resendMessageId: result.id,
      sentBy,
    });
    return result;
  } catch (err) {
    await db
      .insert(emailLog)
      .values({
        recipientEmail: to,
        recipientName,
        subject,
        emailType,
        relatedId,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        sentBy,
      })
      .catch(() => {}); // Don't let log failure mask the real error
    throw err;
  }
}

// ── Shared email styles ──────────────────────────────────

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── The one email look ───────────────────────────────────
//
// Every portal email is dark, in every mail app, whether the phone is in light
// or dark mode. There is no light version: never add one, never use pure-white
// text, never ship a gradient-only button (Gmail drops inline gradients).
//
// The grays are the look Marcel signed off on (Nov 9 2026 screenshot of the
// engagement email), as pure neutral grays: everything inside the card has to
// be a true gray for the Gmail fix below to restore it exactly.
//
// Gmail fix. Gmail ignores "dark only", and its iPhone app inverts every color
// in dark mode, so this dark email came out light. Email can't switch that
// off, so the gmailStyle() rules (Gmail only: `u + .body` matches the div
// Gmail turns <body> into) undo it:
//  - Gmail never recolors background images, so the page, the button and a
//    black base under the card get one-color gradients (gb-page, gb-btn, gb-base).
//  - The card sits in two black layers, screen over difference (gb-s, gb-d).
//    Light mode: both stay black and change nothing. Dark mode: Gmail turns
//    them white, and the difference layer inverts the card back, text and all.
//  - Whatever Gmail does NOT invert (logo, emoji, button) would get flipped by
//    that layer, so it carries its own difference layer (gb-keep) to flip back;
//    the button also sits on a black base (gb-under) so it comes out exact.
//  - The flip-back is only exact for grays: colored text (gb-mono) and tinted
//    boxes (gb-box) turn gray in Gmail. Every other mail app keeps the colors.
// Wrap emoji in emailEmoji(), build buttons with emailButton(), and give
// colored text class="gb-mono" and tinted boxes class="gb-box".

export const EMAIL_COLORS = {
  /** Behind the card. */
  page: "#0a0a0f",
  card: "#121212",
  /** The thin dark ring inside the card's border, and the footer panel. */
  panel: "#0a0a0a",
  /** Boxes inside the card (subject, details, lists). */
  box: "#131313",
  border: "#1f1f1f",
  divider: "#1b1b1b",
  /** Secondary buttons and the survey's number tiles. */
  tile: "#1f1f1f",
  tileBorder: "#2b2b2b",
  /** Headings, names, values. */
  ink: "#b9b9b9",
  /** Paragraphs, list items, quotes. */
  body: "#b4b4b4",
  /** Small uppercase labels. */
  label: "#b5b5b5",
  /** Expiry lines, raw links, footer. */
  fine: "#b1b1b1",
  /** Links in body text (gray in Gmail). */
  link: "#8aa7f8",
  button: "#3662e3",
  buttonText: "#ffffff",
} as const;

const C = EMAIL_COLORS;

/** An emoji that keeps its colors through Gmail's dark-mode fix. */
export function emailEmoji(emoji: string): string {
  return `<span class="gb-keep">${emoji}</span>`;
}

/**
 * The call-to-action button: solid Nexli blue, or the firm's brand color.
 * `label` is HTML. The layers keep it exactly this color in Gmail's dark mode
 * and do nothing anywhere else.
 */
export function emailButton(
  href: string,
  label: string,
  branding?: OwnerBranding,
  size: "md" | "sm" = "md"
): string {
  const bg = branding?.brandColor || C.button;
  const pad = size === "sm" ? "12px 28px" : "14px 32px";
  const radius = size === "sm" ? 10 : 12;
  const font = size === "sm" ? 13 : 14;
  return `<span class="gb-under" style="display:inline-block;vertical-align:top;border-radius:${radius}px;"><a href="${href}" class="gb-keep gb-btn" style="display:block;background-color:${bg};color:${C.buttonText};text-decoration:none;padding:${pad};border-radius:${radius}px;font-size:${font}px;font-weight:700;line-height:20px;"><span class="gb-s" style="display:inline-block;"><span class="gb-d" style="display:inline-block;">${label}</span></span></a></span>`;
}

/** Gmail-only rules (see the Gmail fix above). Its own <style> block, so nothing else in the head can make Gmail drop it. */
function gmailStyle(buttonColor: string, barColor: string | null): string {
  return `
  <style>
    u + .body .gb-page { background-image: linear-gradient(${C.page}, ${C.page}) !important; }
    u + .body .gb-base { background-image: linear-gradient(#000000, #000000) !important; }
    u + .body .gb-s { background: #000000 !important; mix-blend-mode: screen !important; }
    u + .body .gb-d { background: #000000 !important; mix-blend-mode: difference !important; }
    u + .body .gb-under { background: #000000 !important; }
    u + .body .gb-keep { mix-blend-mode: difference !important; }
    u + .body .gb-btn { background-image: linear-gradient(${buttonColor}, ${buttonColor}) !important; }${
      barColor ? `\n    u + .body .gb-bar { background-image: linear-gradient(${barColor}, ${barColor}) !important; }` : ""
    }
    u + .body .gb-mono { color: ${C.ink} !important; }
    u + .body .gb-box { background-color: ${C.box} !important; border-color: ${C.border} !important; }
  </style>`;
}

/** A footer link, styled like the text around it. */
const footerLink = (href: string, label: string) =>
  `<a href="${href}" class="nxl-fine" style="color:${C.fine};text-decoration:underline;">${label}</a>`;

/**
 * Nexli's legal identity + nexli.net policies, under Nexli-branded emails only
 * (never a firm's white-label email). The phone and email are real links so
 * mail apps don't auto-link them in colors of their own.
 */
const NEXLI_LEGAL_FOOTER_ROW = `
            <tr><td align="center" style="padding-top:8px;">
              <p class="nxl-fine" style="margin:0;color:${C.fine};font-size:10px;line-height:1.6;">
                ${NEXLI_LEGAL.name} &bull; ${NEXLI_LEGAL.street}, ${NEXLI_LEGAL.cityLine} &bull; ${footerLink(`tel:${NEXLI_LEGAL.phoneE164}`, NEXLI_LEGAL.phoneDisplay)} &bull; ${footerLink(`mailto:${NEXLI_LEGAL.email}`, NEXLI_LEGAL.email)}<br />
                ${NEXLI_POLICY_LINKS.map((l) => footerLink(l.href, l.label)).join(" &middot; ")}
              </p>
            </td></tr>`;

/**
 * Shared HTML shell for every outbound email. Pass the firm's branding to
 * swap the logo, footer attribution and accent color; defaults to Nexli.
 */
export const emailWrapper = (
  content: string,
  branding: OwnerBranding = NEXLI_BRANDING
) => {
  const logoUrl = absoluteLogoUrl(branding.logoUrl);
  const logoAlt = escapeHtml(branding.displayName);
  const brand = branding.brandColor;
  const signInColor = brand || C.link;
  const accentBar = brand
    ? `<tr><td bgcolor="${brand}" class="gb-keep gb-bar" style="background-color:${brand};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>`
    : "";
  const footerLine = branding.isNexli
    ? "Sent securely by Nexli Portal &bull; Powered by Digital Rainmaker System"
    : `Sent securely by ${escapeHtml(branding.displayName)} via Nexli Portal`;

  // The doctype must come first: Gmail's `u + .body` rules depend on it.
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">${gmailStyle(brand || C.button, brand)}
  <!--[if mso]>
  <style>
    body, table, td, th, p, a, span, div { background-color: ${C.page} !important; color: ${C.ink} !important; }
  </style>
  <![endif]-->
  <style>
    :root { color-scheme: dark only !important; supported-color-schemes: dark only !important; }
    body, .body-bg { background-color: ${C.page} !important; }
    div[style*="margin: 16px 0"] { margin: 0 !important; }
    [data-ogsc] .nxl-fine { color: ${C.fine} !important; }
    [data-ogsc] .nxl-link { color: ${signInColor} !important; }
    [data-ogsb] body, [data-ogsb] .body-bg { background-color: ${C.page} !important; }
    [data-ogsb] .card-bg { background-color: ${C.card} !important; }
  </style>
</head>
<body class="body body-bg" style="margin:0;padding:0;background-color:${C.page};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${C.body};">
  <div class="body-bg gb-page" style="background-color:${C.page};color:${C.body};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" class="body-bg gb-page" style="background-color:${C.page};padding:40px 20px;">
    <tr><td align="center" bgcolor="${C.page}" class="gb-page" style="background-color:${C.page};">
      <div class="gb-base" style="max-width:560px;margin:0 auto;border-radius:16px;overflow:hidden;">
      <div class="gb-s"><div class="gb-d">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="2" bgcolor="${C.panel}" style="max-width:560px;background-color:${C.panel};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
        ${accentBar}
        <!-- Logo Header -->
        <tr><td bgcolor="${C.card}" class="card-bg" style="background-color:${C.card};padding:32px 32px 0;text-align:center;">
          <img class="gb-keep" src="${logoUrl}" alt="${logoAlt}" width="130" style="display:inline-block;max-height:56px;object-fit:contain;" />
        </td></tr>
        <!-- Content -->
        <tr><td bgcolor="${C.card}" class="card-bg" style="background-color:${C.card};padding:32px;color:${C.body};">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td bgcolor="${C.card}" class="card-bg" style="background-color:${C.card};padding:24px 32px 32px;border-top:1px solid ${C.divider};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel}" style="background-color:${C.panel};">
            <tr><td align="center" style="padding-bottom:12px;">
              <img class="gb-keep" src="${logoUrl}" alt="${logoAlt}" width="60" style="opacity:0.4;max-height:28px;object-fit:contain;" />
            </td></tr>
            <tr><td align="center">
              <p class="nxl-fine" style="margin:0;color:${C.fine};font-size:11px;">
                ${footerLine}
              </p>
            </td></tr>${branding.isNexli ? NEXLI_LEGAL_FOOTER_ROW : ""}
            <tr><td align="center" style="padding-top:12px;">
              <a href="${PORTAL_URL}/portal" class="nxl-link gb-mono" style="color:${signInColor};font-size:11px;text-decoration:none;opacity:0.6;">
                Sign in to your Client Portal
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      </div></div>
      </div>
    </td></tr>
  </table>
  </div>
</body>
</html>`;
};

// ── Upload Request Email ─────────────────────────────────

export function buildUploadRequestEmail(params: {
  clientName: string;
  senderName: string;
  uploadUrl: string;
  requiredDocs: string[];
  message?: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, senderName, uploadUrl, requiredDocs, message, expiresAt } =
    params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const docList =
    requiredDocs.length > 0
      ? `
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0 0 12px;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documents Needed</p>
      ${requiredDocs.map((d) => `<p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; ${d}</p>`).join("")}
    </div>`
      : "";

  const messageBlock = message
    ? `<div class="gb-box" style="margin:20px 0;padding:16px;background-color:#0f1528;border-left:3px solid #2563EB;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:${C.body};font-size:13px;font-style:italic;">"${message}"</p>
    </div>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Document Request</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName || "there"}, <strong style="color:${C.ink};">${senderName}</strong> has requested documents from you.
    </p>
    ${messageBlock}
    ${docList}
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(uploadUrl, "Upload Documents", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:${C.fine};font-size:10px;word-break:break-all;">
        ${uploadUrl}
      </p>
    </div>
  `, params.branding);

  return {
    subject: `${senderName} requested documents from you`,
    html,
  };
}

// ── Tax Organizer Request Email ───────────────────────────

export function buildTaxOrganizerEmail(params: {
  clientName: string;
  senderName: string;
  taxYear: string;
  returnType: string;
  organizerUrl: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, senderName, taxYear, returnType, organizerUrl, expiresAt } =
    params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const returnTypeLabels: Record<string, string> = {
    "1040": "Individual Tax Return (1040)",
    "1041": "Estate/Trust (1041)",
    "1065": "Partnership (1065)",
    "1120": "C-Corp (1120)",
    "1120S": "S-Corp (1120S)",
    "990": "Nonprofit (990)",
    other: "Tax Return",
  };

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Tax Organizer</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      ${clientName || "Hi there"}, <strong style="color:${C.ink};">${senderName}</strong> has sent you a tax organizer to complete.
    </p>
    <p style="margin:0 0 20px;color:${C.body};font-size:13px;line-height:1.6;">
      Please complete the following tax organizer to help us prepare your ${taxYear} ${returnTypeLabels[returnType] || returnType}. This questionnaire collects the information we need and will tell you exactly which documents to upload.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0 0 12px;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Details</p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; Tax Year: <strong style="color:${C.ink};">${taxYear}</strong></p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; Return Type: <strong style="color:${C.ink};">${returnTypeLabels[returnType] || returnType}</strong></p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; Expires: <strong style="color:${C.ink};">${expDate}</strong></p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(organizerUrl, "Complete Tax Organizer", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:${C.fine};font-size:10px;word-break:break-all;">
        Or copy this link: ${organizerUrl}
      </p>
    </div>
  `, params.branding);

  return {
    subject: `${senderName} sent your tax organizer for ${taxYear}`,
    html,
  };
}

// ── Tax Organizer Submission Confirmation Email ───────────

export function buildTaxOrganizerConfirmationEmail(params: {
  clientName: string;
  senderName: string;
  taxYear: string;
  returnType: string;
  recommendedDocs: string[];
  uploadedCount: number;
  uploadUrl: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const {
    clientName,
    senderName,
    taxYear,
    returnType,
    recommendedDocs,
    uploadedCount,
    uploadUrl,
    expiresAt,
  } = params;

  const returnTypeLabels: Record<string, string> = {
    "1040": "Individual Tax Return (1040)",
    "1041": "Estate/Trust (1041)",
    "1065": "Partnership (1065)",
    "1120": "C-Corp (1120)",
    "1120S": "S-Corp (1120S)",
  };

  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const uploadedNote =
    uploadedCount > 0
      ? `<p class="gb-mono" style="margin:0 0 16px;color:#10B981;font-size:13px;">${emailEmoji("&#x2705;")} You uploaded ${uploadedCount} document${uploadedCount === 1 ? "" : "s"} with your submission.</p>`
      : "";

  const docList =
    recommendedDocs.length > 0
      ? `
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0 0 12px;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documents Needed</p>
      ${recommendedDocs.map((d) => `<p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; ${d}</p>`).join("")}
    </div>`
      : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Tax Organizer Received</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Thank you, ${clientName || "there"}! Your ${taxYear} ${returnTypeLabels[returnType] || returnType} tax organizer has been submitted to <strong style="color:${C.ink};">${senderName}</strong>.
    </p>
    ${uploadedNote}
    ${recommendedDocs.length > 0 ? `<p style="margin:0 0 4px;color:${C.body};font-size:13px;line-height:1.6;">
      Based on your answers, please upload the following documents so we can begin preparing your return:
    </p>` : ""}
    ${docList}
    ${recommendedDocs.length > 0 ? `<div style="text-align:center;margin:28px 0;">
      ${emailButton(uploadUrl, "Upload Documents", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>` : `<p style="margin:24px 0 0;color:${C.fine};font-size:12px;text-align:center;">
      We&rsquo;ll be in touch if we need any additional information.
    </p>`}
  `, params.branding);

  return {
    subject: `Your ${taxYear} tax organizer has been received — documents needed`,
    html,
  };
}

// ── Tax Organizer Document Reminder Email ─────────────────

export function buildTaxOrganizerDocReminderEmail(params: {
  clientName: string;
  senderName: string;
  taxYear: string;
  recommendedDocs: string[];
  uploadUrl: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, senderName, taxYear, recommendedDocs, uploadUrl, expiresAt } =
    params;

  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const docList = `
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:#1f1a0d;border:1px solid #3d3010;border-radius:12px;">
      <p class="gb-mono" style="margin:0 0 12px;color:#F59E0B;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documents Still Needed</p>
      ${recommendedDocs.map((d) => `<p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; ${d}</p>`).join("")}
    </div>`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Document Reminder</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName || "there"}, <strong style="color:${C.ink};">${senderName}</strong> is still waiting on documents for your ${taxYear} tax return.
    </p>
    <p style="margin:0 0 4px;color:${C.body};font-size:13px;line-height:1.6;">
      Please upload the following documents as soon as possible so we can begin preparing your return:
    </p>
    ${docList}
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(uploadUrl, "Upload Documents", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `, params.branding);

  return {
    subject: `Reminder: Documents needed for your ${taxYear} tax return`,
    html,
  };
}

// ── E-Sign Request Email ─────────────────────────────────

export function buildEsignRequestEmail(params: {
  signerName: string;
  senderName: string;
  documentName: string;
  signUrl: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { signerName, senderName, documentName, signUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Signature Requested</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${signerName}, <strong style="color:${C.ink};">${senderName}</strong> has requested your signature on a document.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Document</p>
      <p style="margin:8px 0 0;color:${C.ink};font-size:15px;font-weight:600;">${documentName}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(signUrl, "Review & Sign", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `, params.branding);

  return {
    subject: `${senderName} needs your signature — ${documentName}`,
    html,
  };
}

// ── E-Sign Completed Email (to CPA) ─────────────────────

export function buildEsignCompletedEmail(params: {
  senderName: string;
  cpaEmail: string;
  signerName: string;
  documentName: string;
  signedAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { senderName, signerName, documentName, signedAt } = params;
  const signDate = signedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Document Signed</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${senderName}, <strong class="gb-mono" style="color:#10B981;">${signerName}</strong> has signed your document.
    </p>
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Document</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${documentName}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${signerName}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Date</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:${C.fine};font-size:12px;text-align:center;">
      View the signed document in your Nexli Portal dashboard.
    </p>
  `, params.branding);

  return {
    subject: `${signerName} signed "${documentName}"`,
    html,
  };
}

// ── Engagement Letter Request Email ──────────────────────

export function buildEngagementRequestEmail(params: {
  clientName: string;
  senderName: string;
  subject: string;
  engageUrl: string;
  expiresAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, senderName, subject, engageUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Engagement Letter</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName}, <strong style="color:${C.ink};">${senderName}</strong> has sent you an engagement letter for review and signature.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Subject</p>
      <p style="margin:8px 0 0;color:${C.ink};font-size:15px;font-weight:600;">${subject}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(engageUrl, "Review & Sign", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `, params.branding);

  return {
    subject: `${senderName} sent you an engagement letter — ${subject}`,
    html,
  };
}

// ── Engagement Signed Email (to CPA) ─────────────────────

export function buildEngagementSignedEmail(params: {
  senderName: string;
  clientName: string;
  subject: string;
  signedAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { senderName, clientName, subject, signedAt } = params;
  const signDate = signedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Engagement Letter Signed</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${senderName}, <strong class="gb-mono" style="color:#10B981;">${clientName}</strong> has signed your engagement letter.
    </p>
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Subject</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${clientName}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Date</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:${C.fine};font-size:12px;text-align:center;">
      View the signed engagement in your Nexli Portal dashboard.
    </p>
  `, params.branding);

  return {
    subject: `${clientName} signed your engagement letter — "${subject}"`,
    html,
  };
}

// ── Onboarding Launch Pad Welcome Email ──────────────────

/** "Friday, October 10" from a YYYY-MM-DD string (UTC, so the day never shifts). */
function formatDueDateLong(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Oct 10" from a YYYY-MM-DD string. */
function formatDueDateShort(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Weekday name ("Friday") from a YYYY-MM-DD string. */
function weekdayOf(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function buildOnboardingWelcomeEmail(params: {
  clientName: string;
  senderName: string;
  onboardingUrl: string;
  /** YYYY-MM-DD deadline for the client's items; omitted on legacy records. */
  clientDueAt?: string | null;
}): { subject: string; html: string } {
  const { clientName, senderName, onboardingUrl, clientDueAt } = params;
  const dueLine = clientDueAt
    ? `<p class="gb-mono" style="margin:12px 0 0;color:#F59E0B;font-size:13px;font-weight:700;">Please have everything in by ${formatDueDateLong(clientDueAt)} so we can start building right away.</p>`
    : "";

  const html = emailWrapper(`
    <div style="text-align:center;margin-bottom:16px;">
      <span style="font-size:36px;">${emailEmoji("&#x1F680;")}</span>
    </div>
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;text-align:center;">Your Launch Pad is Live</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;text-align:center;line-height:1.6;">
      Welcome aboard, ${clientName}! ${senderName} has already started your
      build. Your personal Launch Pad shows live progress, timelines, and the
      few quick items we need from you.
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(onboardingUrl, "Open Your Launch Pad")}
    </div>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <p style="margin:0 0 12px;color:${C.label};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">What we need from you</p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">${emailEmoji("&#x1F4B3;")} How you get paid — your payment processor, and which invoice amounts go by card, ACH or wire</p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">${emailEmoji("&#x1F310;")} Domain &amp; DNS login (GoDaddy, Namecheap, etc.)</p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">${emailEmoji("&#x1F4E3;")} Your Facebook ad account ID — or tell us you don't have one and we'll set it up</p>
      <p style="margin:4px 0;color:${C.body};font-size:13px;">${emailEmoji("&#x1FAAA;")} Driver's license front &amp; back (phone number verification)</p>
      ${dueLine}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        Bookmark this link &bull; It updates in real time &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:${C.fine};font-size:10px;word-break:break-all;">
        ${onboardingUrl}
      </p>
    </div>
  `);

  return {
    subject: `🚀 Your Launch Pad is live — watch your build in real time`,
    html,
  };
}

// ── Onboarding Due-Date Reminder Email ───────────────────

export function buildOnboardingDueReminderEmail(params: {
  clientName: string;
  senderName: string;
  /** YYYY-MM-DD */
  dueDate: string;
  /** Whole days until due; 0 = due today; negative = overdue. */
  daysLeft: number;
  outstandingItems: string[];
  onboardingUrl: string;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, senderName, dueDate, daysLeft, outstandingItems, onboardingUrl } =
    params;
  const overdue = daysLeft < 0;
  const count = outstandingItems.length;
  const plural = count === 1 ? "item" : "items";
  const longDate = formatDueDateLong(dueDate);

  const timing = overdue
    ? `were due <strong style="color:${C.ink};">${longDate}</strong> — ${
        -daysLeft === 1 ? "1 day" : `${-daysLeft} days`
      } ago`
    : daysLeft === 0
      ? `are due <strong style="color:${C.ink};">today</strong> (${longDate})`
      : `are due <strong style="color:${C.ink};">${longDate}</strong> — ${
          daysLeft === 1 ? "1 day" : `${daysLeft} days`
        } left`;

  const subject = overdue
    ? `Overdue: onboarding ${plural} ${count === 1 ? "was" : "were"} due ${formatDueDateShort(dueDate)}`
    : daysLeft === 0
      ? `Reminder: ${count} onboarding ${plural} due today`
      : `Reminder: ${count} onboarding ${plural} due ${weekdayOf(dueDate)}`;

  const itemList = `
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:${overdue ? "#1f0d12" : "#1f1a0d"};border:1px solid ${overdue ? "#3d1020" : "#3d3010"};border-radius:12px;">
      <p class="gb-mono" style="margin:0 0 12px;color:${overdue ? "#F43F5E" : "#F59E0B"};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${overdue ? "Overdue" : "Still Needed"}</p>
      ${outstandingItems.map((item) => `<p style="margin:4px 0;color:${C.body};font-size:13px;">&#x2022; ${escapeHtml(item)}</p>`).join("")}
    </div>`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">${overdue ? "Your onboarding items are overdue" : "Quick reminder from your Launch Pad"}</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(clientName || "there")}, <strong style="color:${C.ink};">${escapeHtml(senderName)}</strong> still needs ${count} ${plural} from you to keep your build on schedule. Your items ${timing}.
    </p>
    ${itemList}
    <p style="margin:0 0 4px;color:${C.body};font-size:13px;line-height:1.6;">
      ${overdue
        ? "We can&rsquo;t move forward on the pieces that depend on these — please send them over as soon as you can and we&rsquo;ll pick right back up."
        : "Everything takes just a few minutes and goes straight to your Nexli team through your Launch Pad."}
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(onboardingUrl, "Open Your Launch Pad", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        Your link updates in real time &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:${C.fine};font-size:10px;word-break:break-all;">
        ${onboardingUrl}
      </p>
    </div>
  `, params.branding);

  return { subject, html };
}

// ══════════════════════════════════════════════════════════
// ══  INVOICE EMAILS  ═════════════════════════════════════
// ══════════════════════════════════════════════════════════

// ── Invoice Email (to Client) ────────────────────────────

export function buildInvoiceEmail(params: {
  clientName: string;
  senderName: string;
  invoiceNumber: string;
  total: string;
  dueDate: Date;
  invoiceUrl: string;
  branding?: OwnerBranding;
  /** Paid by bank transfer into Nexli's Mercury account: no Stripe wording; details stay on the page (never in email). */
  bankTransfer?: boolean;
}): { subject: string; html: string } {
  const { clientName, senderName, invoiceNumber, total, dueDate, invoiceUrl } =
    params;
  const dueDateStr = dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Invoice from ${senderName}</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName}, you have a new invoice ready for payment.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Amount Due</td>
          <td style="color:${C.ink};font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Due Date</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${dueDateStr}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(invoiceUrl, params.bankTransfer ? "View Invoice &amp; Bank Details" : "View &amp; Pay Invoice", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        ${params.bankTransfer ? "Pay by bank transfer (ACH or wire) &bull; Account details are on the invoice page" : "No account required &bull; Secure payment via Stripe"}
      </p>
    </div>
  `, params.branding);

  return {
    subject: `Invoice ${invoiceNumber} from ${senderName} — ${total} due ${dueDateStr}`,
    html,
  };
}

// ── Invoice Paid Email (to CPA) ──────────────────────────

export function buildInvoicePaidEmail(params: {
  senderName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  paidAt: Date;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { senderName, clientName, invoiceNumber, total, paidAt } = params;
  const paidDate = paidAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Invoice Paid</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${senderName}, <strong class="gb-mono" style="color:#10B981;">${clientName}</strong> has paid invoice ${invoiceNumber}.
    </p>
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Amount</td>
          <td class="gb-mono" style="color:#10B981;font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Paid by</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${clientName}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Date</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${paidDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:${C.fine};font-size:12px;text-align:center;">
      View invoice details in your Nexli Portal dashboard.
    </p>
  `, params.branding);

  return {
    subject: `${clientName} paid invoice ${invoiceNumber} — ${total}`,
    html,
  };
}

// ── Invoice Reminder Email (to Client) ───────────────────

export function buildInvoiceReminderEmail(params: {
  clientName: string;
  senderName: string;
  invoiceNumber: string;
  total: string;
  dueDate: Date;
  isOverdue: boolean;
  invoiceUrl: string;
  branding?: OwnerBranding;
  /** Paid by bank transfer into Nexli's Mercury account: no Stripe wording; details stay on the page (never in email). */
  bankTransfer?: boolean;
}): { subject: string; html: string } {
  const {
    clientName,
    senderName,
    invoiceNumber,
    total,
    dueDate,
    isOverdue,
    invoiceUrl,
  } = params;
  const dueDateStr = dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const heading = isOverdue ? "Invoice Overdue" : "Invoice Reminder";
  const message = isOverdue
    ? `Your invoice ${invoiceNumber} from ${senderName} was due on ${dueDateStr} and is now overdue.`
    : `This is a reminder that invoice ${invoiceNumber} from ${senderName} is due on ${dueDateStr}.`;
  const urgencyColor = isOverdue ? "#EF4444" : "#F59E0B";
  const urgencyBg = isOverdue ? "#1f0f0f" : "#1f1a0d";
  const urgencyBorder = isOverdue ? "#3d1616" : "#3d3010";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">${heading}</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName}, ${message}
    </p>
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Amount Due</td>
          <td class="gb-mono" style="color:${urgencyColor};font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">${isOverdue ? "Was Due" : "Due Date"}</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${dueDateStr}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(invoiceUrl, params.bankTransfer ? "View Invoice &amp; Bank Details" : "View &amp; Pay Invoice", params.branding)}
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:${C.fine};font-size:11px;">
        ${params.bankTransfer ? "Pay by bank transfer (ACH or wire) &bull; Account details are on the invoice page" : "No account required &bull; Secure payment via Stripe"}
      </p>
    </div>
  `, params.branding);

  const subjectLine = isOverdue
    ? `Overdue: Invoice ${invoiceNumber} — ${total} was due ${dueDateStr}`
    : `Reminder: Invoice ${invoiceNumber} — ${total} due ${dueDateStr}`;

  return { subject: subjectLine, html };
}

// ── Portal Magic Link Email ─────────────────────────────

export function buildMagicLinkEmail(params: {
  clientName: string;
  magicLinkUrl: string;
  expiresInMinutes: number;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, magicLinkUrl, expiresInMinutes } = params;
  const brand = params.branding ?? NEXLI_BRANDING;
  const portalLabel = brand.isNexli
    ? "Nexli Portal"
    : `${escapeHtml(brand.displayName)} client portal`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Sign in to ${portalLabel}</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName}, click the button below to access your client portal.
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(magicLinkUrl, "Sign In to Portal", params.branding)}
    </div>
    <div style="margin:20px 0;padding:16px;background-color:${C.box};border:1px solid ${C.border};border-radius:12px;text-align:center;">
      <p style="margin:0;color:${C.label};font-size:12px;">
        This link expires in ${expiresInMinutes} minutes.<br/>
        If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    </div>
  `, params.branding);

  return {
    subject: brand.isNexli
      ? "Sign in to your Nexli Portal"
      : `Sign in to your ${brand.displayName} client portal`,
    html,
  };
}

// ── Payment Receipt Email (to Client) ────────────────────

export function buildPaymentReceiptEmail(params: {
  clientName: string;
  senderName: string;
  invoiceNumber: string;
  amountPaid: string;
  totalInvoice: string;
  remainingBalance: string | null;
  paidAt: Date;
  portalUrl: string;
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const {
    clientName,
    senderName,
    invoiceNumber,
    amountPaid,
    totalInvoice,
    remainingBalance,
    paidAt,
    portalUrl,
  } = params;
  const paidDate = paidAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const isPartial = remainingBalance !== null;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">Payment Receipt</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;">
      Hi ${clientName}, your payment to <strong style="color:${C.ink};">${senderName}</strong> has been received. Thank you!
    </p>
    <div class="gb-box" style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Amount Paid</td>
          <td class="gb-mono" style="color:#10B981;font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${amountPaid}</td>
        </tr>
        ${isPartial ? `
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Invoice Total</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${totalInvoice}</td>
        </tr>
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Remaining Balance</td>
          <td class="gb-mono" style="color:#F59E0B;font-size:13px;font-weight:700;text-align:right;padding:4px 0;">${remainingBalance}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="color:${C.label};font-size:11px;padding:4px 0;">Date</td>
          <td style="color:${C.ink};font-size:13px;text-align:right;padding:4px 0;">${paidDate}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      ${emailButton(`${portalUrl}/portal`, "View in Client Portal", params.branding)}
    </div>
    <p style="margin:0;color:${C.fine};font-size:12px;text-align:center;">
      Keep this email as your payment confirmation.
    </p>
  `, params.branding);

  const subject = isPartial
    ? `Payment received — ${amountPaid} toward invoice ${invoiceNumber}`
    : `Payment receipt — Invoice ${invoiceNumber} paid in full`;

  return { subject, html };
}

/**
 * Digital Rainmaker autopay: the monthly charge failed (or the bank / card
 * needs the client to confirm it). Links to Stripe's hosted invoice page,
 * where the client can update the payment method or pay now. Stripe keeps
 * retrying automatically (Smart Retries) in the meantime.
 */
export function buildAutopayFailedEmail(params: {
  clientName: string;
  amount: string;
  /** Stripe hosted_invoice_url — update payment / pay now. */
  payUrl: string | null;
  /** "failed" = the charge was declined; "action_required" = needs confirmation. */
  reason: "failed" | "action_required";
  branding?: OwnerBranding;
}): { subject: string; html: string } {
  const { clientName, amount, payUrl, reason } = params;
  const lead =
    reason === "action_required"
      ? `Your bank or card issuer needs you to confirm this month's Digital Rainmaker autopay payment of <strong style="color:${C.ink};">${amount}</strong> before it can go through.`
      : `We weren't able to collect this month's Digital Rainmaker autopay payment of <strong style="color:${C.ink};">${amount}</strong>. We'll retry automatically over the next few days.`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;">${
      reason === "action_required" ? "Please confirm your payment" : "Your autopay payment didn't go through"
    }</h1>
    <p style="margin:0 0 24px;color:${C.body};font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(clientName)}, ${lead}
    </p>
    ${
      payUrl
        ? `<div style="text-align:center;margin:28px 0;">
      ${emailButton(payUrl, "Update payment / pay now", params.branding)}
    </div>`
        : ""
    }
    <p style="margin:0;color:${C.fine};font-size:12px;text-align:center;line-height:1.6;">
      Questions? Just reply to this email.
    </p>
  `, params.branding);

  const subject =
    reason === "action_required"
      ? `Action needed — confirm your ${amount} autopay payment`
      : `Autopay payment of ${amount} didn't go through`;

  return { subject, html };
}
