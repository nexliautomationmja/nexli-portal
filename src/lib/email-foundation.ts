/**
 * Firm Foundation emails. These are sent BY NEXLI to the firm owner (not by
 * the firm to its clients), so they use the default Nexli wrapper with no
 * per-firm branding.
 */

import { emailWrapper } from "@/lib/email";
import { getPortalUrl } from "@/lib/foundation-config";

const buttonStyle = `display:inline-block;background-color:#2563EB;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:700;`;

const secondaryButtonStyle = `display:inline-block;background-color:#1e1e2a;color:#ffffff;text-decoration:none;padding:12px 28px;border:1px solid #2a2a3a;border-radius:12px;font-size:13px;font-weight:700;`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const FOUNDATION_SENDER_NAME = "Nexli";

// ── Welcome email (set password + what happens next) ─────

export function buildWelcomeEmail(params: {
  firstName?: string | null;
  firmName: string;
  setupUrl: string;
  agreementUrl?: string | null;
  dashboardUrl: string;
  liveInDays: number;
  setupExpiresAt?: Date | null;
  /** Product name in the heading; defaults to "Firm Foundation". */
  productName?: string;
  /**
   * Nexli client portal (magic-link login) where the firm owner is Nexli's
   * client. Defaults to `${getPortalUrl()}/portal`.
   */
  portalUrl?: string;
}): { subject: string; html: string } {
  const {
    firstName,
    firmName,
    setupUrl,
    agreementUrl,
    dashboardUrl,
    liveInDays,
    setupExpiresAt,
    productName = "Firm Foundation",
    portalUrl = `${getPortalUrl()}/portal`,
  } = params;
  const product = escapeHtml(productName);

  const greeting = firstName ? `Hi ${escapeHtml(firstName)}` : "Hi there";
  const firm = escapeHtml(firmName);
  const expiryNote = setupExpiresAt
    ? `This link expires ${setupExpiresAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}.`
    : "";

  const agreementBlock = agreementUrl
    ? `
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <p style="margin:0 0 8px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Service Agreement</p>
      <p style="margin:0 0 14px;color:#b3b3c0;font-size:13px;line-height:1.6;">
        We&rsquo;ve also sent your Firm Foundation Service Agreement for e-signature. It takes about two minutes and we can&rsquo;t begin your build until it&rsquo;s signed.
      </p>
      <div style="text-align:center;">
        <a href="${agreementUrl}" style="${secondaryButtonStyle}">Review &amp; Sign Agreement</a>
      </div>
    </div>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Welcome to ${product}</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      ${greeting}, your subscription for <strong style="color:#fff;">${firm}</strong> is active. Let&rsquo;s get your portal set up.
    </p>
    <div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <p style="margin:0 0 12px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">What happens next</p>
      <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; <strong style="color:#fff;">Set your password</strong> using the button below.</p>
      <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; <strong style="color:#fff;">Sign your service agreement</strong> (sent in a separate email).</p>
      <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; <strong style="color:#fff;">Upload your logo and content</strong> in the dashboard so we can start your build.</p>
      <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; <strong style="color:#fff;">Go live within ${liveInDays} days</strong> of us receiving your assets.</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${setupUrl}" style="${buttonStyle}">Set Your Password</a>
    </div>
    ${agreementBlock}
    <div style="margin:24px 0 20px;">
      <p style="margin:0 0 6px;color:#fff;font-size:15px;font-weight:800;">Your two logins</p>
      <p style="margin:0 0 14px;color:#9999a8;font-size:13px;line-height:1.6;">
        You&rsquo;ll use two separate sign-ins with Nexli. Keep this email handy.
      </p>
      <div style="margin:0 0 12px;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
        <p style="margin:0 0 6px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">1 &middot; Your firm dashboard</p>
        <p style="margin:0 0 10px;color:#b3b3c0;font-size:13px;line-height:1.6;">
          Set your password with the button above, then sign in any time at
          <a href="${dashboardUrl}" class="nxl-link" style="color:#2563EB;text-decoration:none;">${escapeHtml(dashboardUrl)}</a>.
          This is where you run <strong style="color:#fff;">${firm}</strong>:
        </p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Your branded client portal</p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Engagement letters and e-signatures</p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Invoices and payments</p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Document collection</p>
      </div>
      <div style="padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
        <p style="margin:0 0 6px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">2 &middot; Your Nexli client portal</p>
        <p style="margin:0 0 10px;color:#b3b3c0;font-size:13px;line-height:1.6;">
          Go to <a href="${portalUrl}" class="nxl-link" style="color:#2563EB;text-decoration:none;">${escapeHtml(portalUrl)}</a>,
          enter this email address and we&rsquo;ll send you a one-click sign-in link. No password needed. This is where you are <em>our</em> client:
        </p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Your ${product} project status and website preview</p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Your service agreement</p>
        <p style="margin:4px 0;color:#ccccda;font-size:13px;">&#x2022; Messages and files from the Nexli team</p>
      </div>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        ${expiryNote} Once set, sign in any time at <a href="${dashboardUrl}" class="nxl-link" style="color:#2563EB;text-decoration:none;">${escapeHtml(dashboardUrl)}</a>
      </p>
      <p style="margin:8px 0 0;color:#333340;font-size:10px;word-break:break-all;">
        ${setupUrl}
      </p>
    </div>
  `);

  return {
    subject: `Welcome to ${productName} — set up your ${firmName} portal`,
    html,
  };
}

// ── Agreement reminder (resend of the signing link) ─────

export function buildAgreementReminderEmail(params: {
  firstName?: string | null;
  firmName: string;
  engageUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const { firstName, firmName, engageUrl, expiresAt } = params;
  const greeting = firstName ? `Hi ${escapeHtml(firstName)}` : "Hi there";
  const expDate = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">Your Service Agreement Is Waiting</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;">
      ${greeting}, the Firm Foundation Service Agreement for <strong style="color:#fff;">${escapeHtml(firmName)}</strong> still needs your signature. We can&rsquo;t begin your website and portal build until it&rsquo;s signed.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${engageUrl}" style="${buttonStyle}">Review &amp; Sign</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        This link expires ${expDate} &bull; No account required
      </p>
      <p style="margin:8px 0 0;color:#333340;font-size:10px;word-break:break-all;">
        ${engageUrl}
      </p>
    </div>
  `);

  return {
    subject: `Reminder: sign your Firm Foundation Service Agreement — ${firmName}`,
    html,
  };
}

// ── Weekly customer-success emails (DRS clients) ─────────

function formatWeekOf(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Monday pulse check. Five 1-click score buttons each land on the survey page
 * with that score pre-selected; the client can still adjust before submitting.
 */
export function buildWeeklySurveyEmail(params: {
  clientName?: string | null;
  weekStart: string;
  /** `${portalUrl}/survey/${token}` — no query string. */
  surveyUrl: string;
}): { subject: string; html: string } {
  const { clientName, weekStart, surveyUrl } = params;
  const firstName = (clientName || "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${escapeHtml(firstName)}` : "Hi there";

  const scoreButton = (n: number) =>
    `<td align="center" style="padding:0 4px;">
      <a href="${surveyUrl}?s=${n}" style="display:block;width:44px;height:44px;line-height:44px;border-radius:12px;background-color:#1e1e2a;border:1px solid #2a2a3a;color:#ffffff;font-size:18px;font-weight:800;text-decoration:none;text-align:center;">${n}</a>
    </td>`;

  const html = emailWrapper(`
    <p style="margin:0 0 6px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Week of ${formatWeekOf(weekStart)}</p>
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">60-second pulse check</h1>
    <p style="margin:0 0 24px;color:#9999a8;font-size:14px;line-height:1.6;">
      ${greeting}, Marcel here. One quick question so we catch anything early: <strong style="color:#fff;">how confident are you in the results you&rsquo;re seeing this week?</strong>
    </p>
    <div style="margin:20px 0;padding:20px 16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>${[1, 2, 3, 4, 5].map(scoreButton).join("")}</tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:10px;">
        <tr>
          <td style="color:#808090;font-size:11px;text-align:left;">Not at all</td>
          <td style="color:#808090;font-size:11px;text-align:right;">Very</td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 20px;color:#9999a8;font-size:13px;line-height:1.6;text-align:center;">
      Tap a number and you&rsquo;re nearly done &mdash; two more taps on the next page. I read every one of these personally.
    </p>
    <div style="text-align:center;margin:20px 0 28px;">
      <a href="${surveyUrl}" style="${secondaryButtonStyle}">Open the survey</a>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        Your answers go straight to Marcel. Link is private to you.
      </p>
      <p style="margin:8px 0 0;color:#333340;font-size:10px;word-break:break-all;">
        ${surveyUrl}
      </p>
    </div>
  `);

  return {
    subject: "Quick pulse check — how's this week going?",
    html,
  };
}

/**
 * The weekly "here's what we did on your account" note. Body is plain text;
 * blank lines become paragraphs.
 */
export function buildWeeklyUpdateEmail(params: {
  clientName?: string | null;
  weekStart: string;
  headline?: string | null;
  body: string;
  adSpendCents?: number | null;
  dashboardUrl: string;
  /** This week's unanswered survey link, if any. */
  surveyUrl?: string | null;
}): { subject: string; html: string } {
  const { clientName, weekStart, headline, body, adSpendCents, dashboardUrl, surveyUrl } = params;
  const firstName = (clientName || "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${escapeHtml(firstName)}` : "Hi there";
  const weekLabel = `Week of ${formatWeekOf(weekStart)}`;
  const title = headline?.trim() ? escapeHtml(headline.trim()) : "This week on your account";

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;color:#ccccda;font-size:14px;line-height:1.7;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const adSpendBlock =
    adSpendCents != null && adSpendCents > 0
      ? `<div style="margin:20px 0;padding:14px 16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
          <p style="margin:0;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Ad budget deployed this week</p>
          <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:800;">$${Math.round(adSpendCents / 100).toLocaleString("en-US")}</p>
        </div>`
      : "";

  const surveyBlock = surveyUrl
    ? `<div style="margin:20px 0;padding:16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;text-align:center;">
        <p style="margin:0 0 10px;color:#b3b3c0;font-size:13px;line-height:1.6;">How are we doing? It takes less than a minute.</p>
        <a href="${surveyUrl}" style="${secondaryButtonStyle}">Take this week&rsquo;s 60-second pulse check</a>
      </div>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 6px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${weekLabel} &middot; From your Nexli team</p>
    <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">${title}</h1>
    <p style="margin:0 0 20px;color:#9999a8;font-size:14px;">${greeting}, here&rsquo;s what we worked on for you this week.</p>
    <div style="margin:0 0 8px;">${paragraphs}</div>
    ${adSpendBlock}
    <div style="text-align:center;margin:28px 0;">
      <a href="${dashboardUrl}" style="${buttonStyle}">Open your dashboard</a>
    </div>
    ${surveyBlock}
    <div style="text-align:center;">
      <p style="margin:0;color:#4a4a5a;font-size:11px;">
        Questions? Just reply to this email &mdash; it goes straight to Marcel.
      </p>
    </div>
  `);

  return {
    subject: headline?.trim()
      ? `Your weekly update: ${headline.trim()}`
      : `Your weekly update from Nexli — ${weekLabel}`,
    html,
  };
}
