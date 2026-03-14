import { db } from "@/db";
import { notifications } from "@/db/schema";
import { sendEmailWithLog, emailWrapper } from "@/lib/email";

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

  // Send email to admin — await so Vercel doesn't kill it early
  try {
    await sendNotificationEmail({ type, title, message });
  } catch (err) {
    console.error("Notification email failed:", err);
  }

  return notif;
}

async function sendNotificationEmail(params: {
  type: NotificationType;
  title: string;
  message: string;
}) {
  const { type, title, message } = params;
  const { emoji, color } = TYPE_CONFIG[type];

  const html = emailWrapper(`
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
    <p style="margin:20px 0 0;color:#4a4a5a;font-size:10px;text-align:center;">
      <span style="color:${color};">${type.replace(/_/g, " ")}</span>
    </p>
  `);

  await sendEmailWithLog({
    to: ADMIN_EMAIL,
    subject: `${emoji} ${title}`,
    html,
    recipientName: "Nexli Admin",
    emailType: `notification_${type}`,
  });
}
