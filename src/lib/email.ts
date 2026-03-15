import { Resend } from "resend";
import { db } from "@/db";
import { emailLog } from "@/db/schema";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Nexli Portal <portal@documents.nexli.net>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
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
  recipientName,
  emailType,
  relatedId,
  sentBy,
}: SendEmailWithLogParams) {
  try {
    const result = await sendEmail({ to, subject, html });
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
const LOGO_URL = `${PORTAL_URL}/logos/nexli-logo-white-wordmark@2x.png`;

export const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <!--[if mso]>
  <style>
    body, table, td, th, p, a, span, div { background-color: #0a0a0f !important; color: #ffffff !important; }
  </style>
  <![endif]-->
  <style>
    :root { color-scheme: dark only !important; supported-color-schemes: dark only !important; }
    body, .body-bg, .body-bg table { background-color: #0a0a0f !important; }
    .card-bg { background-color: #111118 !important; }
    .card-border { border-color: #1e1e2a !important; }
    .footer-border { border-color: #1a1a24 !important; }
    .nxl-white { color: #ffffff !important; }
    .nxl-gray { color: #9999a8 !important; }
    .nxl-muted { color: #4a4a5a !important; }
    .nxl-footer { color: #666675 !important; }
    .nxl-green { color: #10B981 !important; }
    .nxl-link { color: #2563EB !important; }
    .nxl-label { color: #808090 !important; }
    u + .body-bg { background-color: #0a0a0f !important; }
    div[style*="margin: 16px 0"] { margin: 0 !important; }
    [data-ogsc] body, [data-ogsc] .body-bg { background-color: #0a0a0f !important; }
    [data-ogsc] .card-bg { background-color: #111118 !important; }
    [data-ogsc] .nxl-white { color: #ffffff !important; }
    [data-ogsc] .nxl-gray { color: #9999a8 !important; }
    [data-ogsc] .nxl-muted { color: #4a4a5a !important; }
    [data-ogsc] .nxl-green { color: #10B981 !important; }
    [data-ogsc] .nxl-label { color: #808090 !important; }
    [data-ogsb] body, [data-ogsb] .body-bg { background-color: #0a0a0f !important; }
    [data-ogsb] .card-bg { background-color: #111118 !important; }
    @media (prefers-color-scheme: light) {
      body, .body-bg, u + .body-bg { background-color: #0a0a0f !important; }
      .card-bg { background-color: #111118 !important; }
      .nxl-white { color: #ffffff !important; }
      .nxl-gray { color: #9999a8 !important; }
      .nxl-muted { color: #4a4a5a !important; }
      .nxl-footer { color: #666675 !important; }
      .nxl-green { color: #10B981 !important; }
      .nxl-link { color: #2563EB !important; }
      .nxl-label { color: #808090 !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .body-bg { background-color: #0a0a0f !important; }
      .card-bg { background-color: #111118 !important; }
    }
  </style>
</head>
<body class="body-bg" style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
  <div class="body-bg" style="background-color:#0a0a0f;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0f" class="body-bg" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr><td align="center" bgcolor="#0a0a0f" style="background-color:#0a0a0f;">
      <table width="100%" class="card-bg" bgcolor="#111118" style="max-width:560px;background-color:#111118;border:1px solid #1e1e2a;border-radius:16px;overflow:hidden;">
        <!-- Logo Header -->
        <tr><td bgcolor="#111118" style="background-color:#111118;padding:32px 32px 0;text-align:center;">
          <img src="${LOGO_URL}" alt="Nexli" width="130" style="display:inline-block;" />
        </td></tr>
        <!-- Content -->
        <tr><td bgcolor="#111118" style="background-color:#111118;padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td bgcolor="#111118" class="footer-border" style="background-color:#111118;padding:0 32px 32px;border-top:1px solid #1a1a24;padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:12px;">
              <img src="${LOGO_URL}" alt="Nexli" width="60" style="opacity:0.4;" />
            </td></tr>
            <tr><td align="center">
              <p class="nxl-muted" style="margin:0;color:#4a4a5a;font-size:11px;">
                Sent securely by Nexli Portal &bull; Powered by Digital Rainmaker System
              </p>
            </td></tr>
            <tr><td align="center" style="padding-top:12px;">
              <a href="${PORTAL_URL}/portal" class="nxl-link" style="color:#2563EB;font-size:11px;text-decoration:none;opacity:0.6;">
                Sign in to your Client Portal
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </div>
</body>
</html>`;

const buttonStyle = `display:inline-block;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:700;`;

// ── Upload Request Email ─────────────────────────────────

export function buildUploadRequestEmail(params: {
  clientName: string;
  senderName: string;
  uploadUrl: string;
  requiredDocs: string[];
  message?: string;
  expiresAt: Date;
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
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <p style="margin:0 0 12px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documents Needed</p>
      ${requiredDocs.map((d) => `<p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; ${d}</p>`).join("")}
    </div>`
      : "";

  const messageBlock = message
    ? `<div style="margin:20px 0;padding:16px;background-color:#0f1528;border-left:3px solid #2563EB;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:#b3b3c0;font-size:13px;font-style:italic;">"${message}"</p>
    </div>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Document Request</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName || "there"}, <strong style="color:#fff;">${senderName}</strong> has requested documents from you.
    </p>
    ${messageBlock}
    ${docList}
    <div style="text-align:center;margin:28px 0;">
      <a href="${uploadUrl}" style="${buttonStyle}">Upload Documents</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:#333340;font-size:10px;word-break:break-all;">
        ${uploadUrl}
      </p>
    </div>
  `);

  return {
    subject: `${senderName} requested documents from you`,
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
}): { subject: string; html: string } {
  const { signerName, senderName, documentName, signUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Signature Requested</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${signerName}, <strong style="color:#fff;">${senderName}</strong> has requested your signature on a document.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <p style="margin:0;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Document</p>
      <p style="margin:8px 0 0;color:#fff;font-size:15px;font-weight:600;">${documentName}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${signUrl}" style="${buttonStyle}">Review & Sign</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `);

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
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Document Signed</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${senderName}, <strong style="color:#10B981;">${signerName}</strong> has signed your document.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Document</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${documentName}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signerName}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:#666675;font-size:12px;text-align:center;">
      View the signed document in your Nexli Portal dashboard.
    </p>
  `);

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
}): { subject: string; html: string } {
  const { clientName, senderName, subject, engageUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Engagement Letter</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName}, <strong style="color:#fff;">${senderName}</strong> has sent you an engagement letter for review and signature.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <p style="margin:0;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Subject</p>
      <p style="margin:8px 0 0;color:#fff;font-size:15px;font-weight:600;">${subject}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${engageUrl}" style="${buttonStyle}">Review & Sign</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `);

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
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Engagement Letter Signed</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${senderName}, <strong style="color:#10B981;">${clientName}</strong> has signed your engagement letter.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Subject</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${clientName}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:#666675;font-size:12px;text-align:center;">
      View the signed engagement in your Nexli Portal dashboard.
    </p>
  `);

  return {
    subject: `${clientName} signed your engagement letter — "${subject}"`,
    html,
  };
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
}): { subject: string; html: string } {
  const { clientName, senderName, invoiceNumber, total, dueDate, invoiceUrl } =
    params;
  const dueDateStr = dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Invoice from ${senderName}</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName}, you have a new invoice ready for payment.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Amount Due</td>
          <td style="color:#fff;font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Due Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${dueDateStr}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${invoiceUrl}" style="${buttonStyle}">View &amp; Pay Invoice</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        No account required &bull; Secure payment via Helcim
      </p>
    </div>
  `);

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
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Invoice Paid</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${senderName}, <strong style="color:#10B981;">${clientName}</strong> has paid invoice ${invoiceNumber}.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Amount</td>
          <td style="color:#10B981;font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Paid by</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${clientName}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${paidDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:#666675;font-size:12px;text-align:center;">
      View invoice details in your Nexli Portal dashboard.
    </p>
  `);

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
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">${heading}</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName}, ${message}
    </p>
    <div style="margin:20px 0;padding:16px;background-color:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Amount Due</td>
          <td style="color:${urgencyColor};font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${total}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">${isOverdue ? "Was Due" : "Due Date"}</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${dueDateStr}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${invoiceUrl}" style="${buttonStyle}">View &amp; Pay Invoice</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        No account required &bull; Secure payment via Helcim
      </p>
    </div>
  `);

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
}): { subject: string; html: string } {
  const { clientName, magicLinkUrl, expiresInMinutes } = params;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Sign in to Nexli Portal</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName}, click the button below to access your client portal.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${magicLinkUrl}" style="${buttonStyle}">Sign In to Portal</a>
    </div>
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;text-align:center;">
      <p style="margin:0;color:#808090;font-size:12px;">
        This link expires in ${expiresInMinutes} minutes.<br/>
        If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    </div>
  `);

  return {
    subject: "Sign in to your Nexli Portal",
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
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Payment Receipt</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      Hi ${clientName}, your payment to <strong style="color:#fff;">${senderName}</strong> has been received. Thank you!
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#0c1a16;border:1px solid #133326;border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Invoice</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Amount Paid</td>
          <td style="color:#10B981;font-size:18px;font-weight:800;text-align:right;padding:4px 0;">${amountPaid}</td>
        </tr>
        ${isPartial ? `
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Invoice Total</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${totalInvoice}</td>
        </tr>
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Remaining Balance</td>
          <td style="color:#F59E0B;font-size:13px;font-weight:700;text-align:right;padding:4px 0;">${remainingBalance}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="color:#808090;font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${paidDate}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${portalUrl}/portal" style="${buttonStyle}">View in Client Portal</a>
    </div>
    <p style="margin:0;color:#666675;font-size:12px;text-align:center;">
      Keep this email as your payment confirmation.
    </p>
  `);

  const subject = isPartial
    ? `Payment received — ${amountPaid} toward invoice ${invoiceNumber}`
    : `Payment receipt — Invoice ${invoiceNumber} paid in full`;

  return { subject, html };
}
