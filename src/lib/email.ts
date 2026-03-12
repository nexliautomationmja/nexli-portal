import { Resend } from "resend";

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

// ── Shared email styles ──────────────────────────────────

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
const LOGO_URL = `${PORTAL_URL}/logos/nexli-logo-white-wordmark@2x.png`;

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">
        <!-- Logo Header -->
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <img src="${LOGO_URL}" alt="Nexli" width="130" style="display:inline-block;" />
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:0 32px 32px;border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:12px;">
              <img src="${LOGO_URL}" alt="Nexli" width="60" style="opacity:0.4;" />
            </td></tr>
            <tr><td align="center">
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;">
                Sent securely by Nexli Portal &bull; Powered by Digital Rainmaker System
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buttonStyle = `display:inline-block;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:700;`;

// ── Upload Request Email ─────────────────────────────────

export function buildUploadRequestEmail(params: {
  clientName: string;
  cpaName: string;
  uploadUrl: string;
  requiredDocs: string[];
  message?: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const { clientName, cpaName, uploadUrl, requiredDocs, message, expiresAt } =
    params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const docList =
    requiredDocs.length > 0
      ? `
    <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
      <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documents Needed</p>
      ${requiredDocs.map((d) => `<p style="margin:4px 0;color:rgba(255,255,255,0.8);font-size:13px;">&#x2022; ${d}</p>`).join("")}
    </div>`
      : "";

  const messageBlock = message
    ? `<div style="margin:20px 0;padding:16px;background:rgba(37,99,235,0.08);border-left:3px solid #2563EB;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;font-style:italic;">"${message}"</p>
    </div>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Document Request</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;">
      Hi ${clientName || "there"}, <strong style="color:#fff;">${cpaName}</strong> has requested documents from you.
    </p>
    ${messageBlock}
    ${docList}
    <div style="text-align:center;margin:28px 0;">
      <a href="${uploadUrl}" style="${buttonStyle}">Upload Documents</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.2);font-size:10px;word-break:break-all;">
        ${uploadUrl}
      </p>
    </div>
  `);

  return {
    subject: `${cpaName} requested documents from you`,
    html,
  };
}

// ── E-Sign Request Email ─────────────────────────────────

export function buildEsignRequestEmail(params: {
  signerName: string;
  cpaName: string;
  documentName: string;
  signUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const { signerName, cpaName, documentName, signUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Signature Requested</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;">
      Hi ${signerName}, <strong style="color:#fff;">${cpaName}</strong> has requested your signature on a document.
    </p>
    <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Document</p>
      <p style="margin:8px 0 0;color:#fff;font-size:15px;font-weight:600;">${documentName}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${signUrl}" style="${buttonStyle}">Review & Sign</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `);

  return {
    subject: `${cpaName} needs your signature — ${documentName}`,
    html,
  };
}

// ── E-Sign Completed Email (to CPA) ─────────────────────

export function buildEsignCompletedEmail(params: {
  cpaName: string;
  cpaEmail: string;
  signerName: string;
  documentName: string;
  signedAt: Date;
}): { subject: string; html: string } {
  const { cpaName, signerName, documentName, signedAt } = params;
  const signDate = signedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Document Signed</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;">
      Hi ${cpaName}, <strong style="color:#10B981;">${signerName}</strong> has signed your document.
    </p>
    <div style="margin:20px 0;padding:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Document</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${documentName}</td>
        </tr>
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signerName}</td>
        </tr>
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">
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
  cpaName: string;
  subject: string;
  engageUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const { clientName, cpaName, subject, engageUrl, expiresAt } = params;
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Engagement Letter</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;">
      Hi ${clientName}, <strong style="color:#fff;">${cpaName}</strong> has sent you an engagement letter for review and signature.
    </p>
    <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Subject</p>
      <p style="margin:8px 0 0;color:#fff;font-size:15px;font-weight:600;">${subject}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${engageUrl}" style="${buttonStyle}">Review & Sign</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
    </div>
  `);

  return {
    subject: `${cpaName} sent you an engagement letter — ${subject}`,
    html,
  };
}

// ── Engagement Signed Email (to CPA) ─────────────────────

export function buildEngagementSignedEmail(params: {
  cpaName: string;
  clientName: string;
  subject: string;
  signedAt: Date;
}): { subject: string; html: string } {
  const { cpaName, clientName, subject, signedAt } = params;
  const signDate = signedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Engagement Letter Signed</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;">
      Hi ${cpaName}, <strong style="color:#10B981;">${clientName}</strong> has signed your engagement letter.
    </p>
    <div style="margin:20px 0;padding:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Subject</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Signed by</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${clientName}</td>
        </tr>
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:11px;padding:4px 0;">Date</td>
          <td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">${signDate}</td>
        </tr>
      </table>
    </div>
    <p style="margin:24px 0 0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">
      View the signed engagement in your Nexli Portal dashboard.
    </p>
  `);

  return {
    subject: `${clientName} signed your engagement letter — "${subject}"`,
    html,
  };
}
