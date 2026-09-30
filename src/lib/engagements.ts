/**
 * Reusable engagement-letter creation.
 *
 * Extracted from POST /api/dashboard/engagements so the same flow (insert
 * engagement, auto-sign the sender as signer 0, create tokenized recipient
 * signers, email each recipient) can be driven by automation such as
 * Firm Foundation provisioning.
 */

import crypto from "crypto";
import { db } from "@/db";
import { engagements, engagementSigners } from "@/db/schema";
import { buildEngagementRequestEmail, sendEmailWithLog } from "@/lib/email";
import { generateSenderSignatureSvgDataUrl } from "@/lib/signature";
import { getPortalUrl } from "@/lib/foundation-config";

export interface EngagementRecipient {
  name: string;
  email: string;
}

export interface CreateEngagementInput {
  ownerId: string;
  senderName: string;
  senderEmail: string;
  senderCompanyName?: string | null;
  subject: string;
  content: string;
  templateId?: string | null;
  expiresInDays?: number;
  recipients: EngagementRecipient[];
  metadata?: Record<string, unknown> | null;
  requestIp?: string | null;
  /** Reserved for per-firm email branding; passed through to nothing yet. */
  branding?: Record<string, unknown> | null;
}

export interface CreatedSigner {
  name: string;
  email: string;
  engageUrl: string;
  token: string;
}

export interface CreateEngagementResult {
  engagement: typeof engagements.$inferSelect;
  signers: CreatedSigner[];
  emailErrors: string[];
}

export function getEngageUrl(token: string): string {
  return `${getPortalUrl()}/engage/${token}`;
}

/**
 * The client's Launch Pad. Deliberately the same signer token as the e-sign
 * link — getOnboardingBySignerToken ignores the engagement's signing-window
 * expiry, so this keeps working long after the letter is signed.
 */
export function getOnboardingUrl(token: string): string {
  return `${getPortalUrl()}/onboarding/${token}`;
}

export async function createEngagement(
  input: CreateEngagementInput
): Promise<CreateEngagementResult> {
  const {
    ownerId,
    senderName,
    senderEmail,
    senderCompanyName,
    subject,
    content,
    templateId,
    expiresInDays = 30,
    recipients,
    metadata,
    requestIp,
  } = input;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [engagement] = await db
    .insert(engagements)
    .values({
      ownerId,
      templateId: templateId || null,
      subject,
      content,
      status: "sent",
      sentAt: new Date(),
      expiresAt,
      metadata: metadata ?? null,
    })
    .returning();

  const emailErrors: string[] = [];
  const signers: CreatedSigner[] = [];
  const companyName = senderCompanyName || "";

  // Sender is signer 0 — auto-signed with a generated cursive signature so
  // the letter ships pre-signed; the recipient only needs to add theirs.
  const senderToken = crypto.randomBytes(32).toString("base64url");
  const senderSignatureSvg = generateSenderSignatureSvgDataUrl(senderName);

  await db.insert(engagementSigners).values({
    engagementId: engagement.id,
    name: senderName,
    email: senderEmail,
    token: senderToken,
    order: 0,
    status: "signed",
    sentAt: new Date(),
    signedAt: new Date(),
    signatureData: senderSignatureSvg,
    signatureIp: requestIp || "system",
    signatureUserAgent: "Auto-signed by sender on document creation",
    role: companyName
      ? `Authorized Representative, ${companyName}`
      : "Authorized Representative",
  });

  signers.push({
    name: senderName,
    email: senderEmail,
    engageUrl: getEngageUrl(senderToken),
    token: senderToken,
  });

  // Recipients are signers 1..n and each gets a "please sign" email.
  for (let i = 0; i < recipients.length; i++) {
    const { name, email } = recipients[i];
    const token = crypto.randomBytes(32).toString("base64url");
    const engageUrl = getEngageUrl(token);

    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name,
      email,
      token,
      order: i + 1,
      status: "sent",
      sentAt: new Date(),
    });

    signers.push({ name, email, engageUrl, token });

    try {
      const { subject: emailSubject, html } = buildEngagementRequestEmail({
        clientName: name,
        senderName,
        subject,
        engageUrl,
        expiresAt,
      });
      await sendEmailWithLog({
        to: email,
        subject: emailSubject,
        html,
        recipientName: name,
        emailType: "engagement_request",
        relatedId: engagement.id,
        sentBy: ownerId,
      });
    } catch (err) {
      console.error(`Failed to send engagement email to ${email}:`, err);
      emailErrors.push(
        `${email}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { engagement, signers, emailErrors };
}
