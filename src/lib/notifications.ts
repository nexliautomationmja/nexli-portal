import { db } from "@/db";
import { notifications } from "@/db/schema";
import { sendEmailWithLog } from "@/lib/email";

export type NotificationType =
  | "invoice_paid"
  | "document_uploaded"
  | "engagement_signed"
  | "esign_completed"
  | "new_lead"
  | "portal_login"
  | "document_viewed";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const ADMIN_EMAIL = "mail@nexli.net";
const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

const TYPE_CONFIG: Record<
  NotificationType,
  { emoji: string; color: string }
> = {
  invoice_paid: { emoji: "\u{1F4B0}", color: "#10B981" },
  document_uploaded: { emoji: "\u{1F4C4}", color: "#2563EB" },
  engagement_signed: { emoji: "\u270D\uFE0F", color: "#10B981" },
  esign_completed: { emoji: "\u2705", color: "#10B981" },
  new_lead: { emoji: "\u{1F514}", color: "#8B5CF6" },
  portal_login: { emoji: "\u{1F511}", color: "#06B6D4" },
  document_viewed: { emoji: "\u{1F441}", color: "#F59E0B" },
};

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: CreateNotificationParams) {
  const [notif] = await db
    .insert(notifications)
    .values({ userId, type, title, message, metadata: metadata || null, read: false })
    .returning();

  // Fire-and-forget email to admin
  sendNotificationEmail({ type, title, message }).catch((err) =>
    console.error("Notification email failed:", err)
  );

  return notif;
}

async function sendNotificationEmail(params: {
  type: NotificationType;
  title: string;
  message: string;
}) {
  const { type, title, message } = params;
  const { emoji, color } = TYPE_CONFIG[type];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background-color:#111118;border:1px solid #1e1e2a;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <img src="${PORTAL_URL}/logos/nexli-logo-white-wordmark@2x.png" alt="Nexli" width="100" style="display:inline-block;opacity:0.5;" />
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <div style="text-align:center;margin-bottom:20px;">
            <span style="font-size:32px;">${emoji}</span>
          </div>
          <h1 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:700;text-align:center;">
            ${title}
          </h1>
          <p style="margin:0 0 24px;color:#9999a8;font-size:14px;text-align:center;line-height:1.5;">
            ${message}
          </p>
          <div style="text-align:center;">
            <a href="${PORTAL_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:700;">
              Open Dashboard
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #1a1a24;">
          <p style="margin:0;color:#4a4a5a;font-size:10px;text-align:center;">
            Nexli Portal Notification &bull; <span style="color:${color};">${type.replace(/_/g, " ")}</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmailWithLog({
    to: ADMIN_EMAIL,
    subject: `${emoji} ${title}`,
    html,
    recipientName: "Nexli Admin",
    emailType: `notification_${type}`,
  });
}
