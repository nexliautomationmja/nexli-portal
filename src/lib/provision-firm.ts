/**
 * Firm Foundation provisioning.
 *
 * Called by POST /api/internal/provision (from the marketing app's Stripe
 * webhook) and by the admin "Create firm" form. Every step is idempotent on
 * its own stamp column so the caller can safely retry:
 *
 *   a. user            — found by email / stripeCustomerId, else inserted
 *   b. templates       — CPA starter templates inserted only when missing
 *   c. agreement       — users.foundationAgreementEngagementId
 *   d. agreement email — users.foundationAgreementSentAt
 *   e. welcome email   — users.welcomeEmailSentAt
 *   g. website         — firm_sites row imported from a pre-purchase preview
 *                        (only when `previewConfig` is supplied and no row exists)
 *   f. provisionedAt   — set once a–e are all clean
 *
 * No step throws past itself; failures are collected in `errors` and the
 * corresponding step is marked 'failed'.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementSigners, firmSites, users } from "@/db/schema";
import { buildEngagementRequestEmail, sendEmailWithLog } from "@/lib/email";
import {
  buildAgreementReminderEmail,
  buildWelcomeEmail,
} from "@/lib/email-foundation";
import { createEngagement, getEngageUrl, getOnboardingUrl } from "@/lib/engagements";
import { initOnboarding } from "@/lib/onboarding";
import { buildFoundationAgreementContent } from "@/lib/foundation-agreement";
import {
  FOUNDATION_AGREEMENT_TEMPLATE_NAME,
  FOUNDATION_LIVE_IN_DAYS,
  FOUNDATION_TIER,
  NEXLI_ADMIN_EMAIL,
  getPortalUrl,
} from "@/lib/foundation-config";
import { seedCpaTemplates } from "@/lib/cpa-engagement-templates";
import { createPasswordSetupToken } from "@/lib/password-setup";
import { ensureUniqueSlug, getFirmSiteByOwner } from "@/lib/firm-sites";
import { slugify } from "@/lib/firm-site-generator";
import {
  validateFirmSiteConfig,
  type FirmSiteConfig,
} from "@/lib/firm-sites/types";

// ── Types ─────────────────────────────────────────────────

export type ProvisionSource =
  | "stripe-webhook"
  | "thank-you"
  | "admin"
  | "invoice-paid";

export interface ProvisionInput {
  email: string;
  firstName?: string;
  lastName?: string;
  firmName: string;
  phone?: string;
  websiteUrl?: string;
  bookingUrl?: string;
  /** The internal API only accepts 'foundation'; admin may also create 'drs'. */
  tier: "foundation" | "drs";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: string; // ISO
  subscriptionStartedAt?: string; // ISO
  sendAgreement?: boolean;
  sendWelcome?: boolean;
  source?: ProvisionSource;
  /**
   * Token of the marketing app's pre-purchase `site_previews` row the buyer
   * saw before checkout. Informational — recorded in generationNotes.
   */
  previewToken?: string;
  /**
   * The preview's FirmSiteConfig. When present and the firm has no
   * `firm_sites` row yet, a DRAFT site is created from it (generatedBy
   * 'preview') so the admin can edit/publish instead of regenerating.
   */
  previewConfig?: FirmSiteConfig;
}

export interface ProvisionSteps {
  user: "created" | "updated";
  templates: "seeded" | "exists" | "failed";
  agreement: "created" | "exists" | "failed" | "skipped";
  agreementEmail: "sent" | "already" | "failed" | "skipped";
  welcomeEmail: "sent" | "already" | "failed" | "skipped";
  /** Website draft imported from the pre-purchase preview. */
  site: "created" | "exists" | "failed" | "skipped";
}

export interface ProvisionResult {
  ok: boolean;
  userId: string;
  created: boolean;
  steps: ProvisionSteps;
  errors: string[];
  /** The client's Launch Pad, once the agreement (and so the token) exists. */
  onboardingUrl?: string;
}

type UserRow = typeof users.$inferSelect;

// ── Helpers ───────────────────────────────────────────────

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function parseIso(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ownerNameFrom(input: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();
}

/**
 * Constant-time check of the internal API secret header.
 */
export function checkProvisionSecret(
  headerValue: string | null
): "ok" | "unauthorized" | "unconfigured" {
  const expected = process.env.PROVISION_SECRET;
  if (!expected) return "unconfigured";
  if (!headerValue) return "unauthorized";
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "unauthorized";
  return crypto.timingSafeEqual(a, b) ? "ok" : "unauthorized";
}

async function loadUserById(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

async function loadAdmin(): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(sql`lower(${users.email})`, NEXLI_ADMIN_EMAIL.toLowerCase()),
        eq(users.role, "admin")
      )
    )
    .limit(1);
  return row ?? null;
}

async function loadAgreement(engagementId: string) {
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (!engagement) return null;
  const [signer] = await db
    .select()
    .from(engagementSigners)
    .where(
      and(
        eq(engagementSigners.engagementId, engagementId),
        eq(engagementSigners.order, 1)
      )
    )
    .limit(1);
  return { engagement, signer: signer ?? null };
}

function agreementSubject(firmName: string): string {
  return `${FOUNDATION_AGREEMENT_TEMPLATE_NAME} — ${firmName}`;
}

/**
 * Create the Foundation service agreement for a user (owned by the Nexli
 * admin) and stamp foundationAgreementEngagementId. Returns whether the
 * recipient email went out.
 */
async function createFoundationAgreement(
  user: UserRow,
  ownerName: string,
  admin: UserRow
): Promise<{ engagementId: string; emailed: boolean; emailErrors: string[] }> {
  const firmName = user.companyName || user.portalDisplayName || user.name || "";
  const { engagement, emailErrors } = await createEngagement({
    ownerId: admin.id,
    senderName: admin.name || "Nexli Automation",
    senderEmail: admin.email,
    senderCompanyName: admin.companyName || "Nexli Automation LLC",
    subject: agreementSubject(firmName),
    content: buildFoundationAgreementContent({
      firmName,
      ownerName,
      effectiveDate: user.subscriptionStartedAt || new Date(),
    }),
    expiresInDays: 30,
    recipients: [{ name: ownerName || firmName, email: user.email }],
    metadata: {
      foundation: true,
      foundationUserId: user.id,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
    },
  });

  const emailed = emailErrors.length === 0;
  await db
    .update(users)
    .set({
      foundationAgreementEngagementId: engagement.id,
      foundationAgreementSentAt: emailed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { engagementId: engagement.id, emailed, emailErrors };
}

async function sendWelcome(
  user: UserRow,
  ownerName: string,
  adminId: string | null,
  agreementUrl: string | null,
  productName: string
): Promise<void> {
  const firmName = user.companyName || user.portalDisplayName || user.name || "";
  const { setupUrl, expiresAt } = await createPasswordSetupToken(user.id);
  const firstName = ownerName.split(" ")[0] || null;
  const { subject, html } = buildWelcomeEmail({
    firstName,
    firmName,
    setupUrl,
    agreementUrl,
    dashboardUrl: `${getPortalUrl()}/login`,
    portalUrl: `${getPortalUrl()}/portal`,
    liveInDays: FOUNDATION_LIVE_IN_DAYS,
    setupExpiresAt: expiresAt,
    productName,
  });
  await sendEmailWithLog({
    to: user.email,
    subject,
    html,
    recipientName: ownerName || firmName,
    emailType: "foundation_welcome",
    relatedId: user.id,
    sentBy: adminId ?? undefined,
  });
  await db
    .update(users)
    .set({ welcomeEmailSentAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
}

// ── Main entry ────────────────────────────────────────────

export async function provisionFirm(
  input: ProvisionInput
): Promise<ProvisionResult> {
  const errors: string[] = [];
  const steps: ProvisionSteps = {
    user: "updated",
    templates: "failed",
    agreement: "skipped",
    agreementEmail: "skipped",
    welcomeEmail: "skipped",
    site: "skipped",
  };

  const email = input.email.trim().toLowerCase();
  const firmName = input.firmName.trim();
  const tier = input.tier === "drs" ? "drs" : FOUNDATION_TIER;
  const sendAgreement = input.sendAgreement ?? true;
  const sendWelcomeEmail = input.sendWelcome ?? true;
  const periodEnd = parseIso(input.subscriptionCurrentPeriodEnd);
  const startedAt = parseIso(input.subscriptionStartedAt);
  const inputOwnerName = ownerNameFrom(input);

  // ── a. user ────────────────────────────────────────────
  let user: UserRow | null = null;
  let created = false;

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  user = byEmail ?? null;

  if (!user && input.stripeCustomerId) {
    const [byCustomer] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, input.stripeCustomerId))
      .limit(1);
    user = byCustomer ?? null;
  }

  if (!user) {
    const hashedPassword = await bcrypt.hash(
      crypto.randomBytes(32).toString("hex"),
      12
    );
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          name: inputOwnerName || firmName,
          hashedPassword,
          role: "client",
          tier,
          companyName: firmName,
          portalDisplayName: firmName,
          phone: input.phone?.trim() || null,
          websiteUrl: input.websiteUrl?.trim() || null,
          bookingUrl: input.bookingUrl?.trim() || null,
          stripeCustomerId: input.stripeCustomerId || null,
          stripeSubscriptionId: input.stripeSubscriptionId || null,
          subscriptionStatus: input.subscriptionStatus || null,
          subscriptionCurrentPeriodEnd: periodEnd,
          subscriptionStartedAt: startedAt,
        })
        .returning();
      user = inserted;
      created = true;
      steps.user = "created";
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Raced with a concurrent provision — re-select.
      const [again] = await db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.email})`, email))
        .limit(1);
      user = again ?? null;
      if (!user && input.stripeCustomerId) {
        const [byCustomer] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, input.stripeCustomerId))
          .limit(1);
        user = byCustomer ?? null;
      }
      if (!user) throw err;
    }
  }

  if (!created) {
    // Existing user: only fill stripe/subscription fields and null gaps.
    // Never touch password or branding.
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (input.stripeCustomerId && user.stripeCustomerId !== input.stripeCustomerId)
      patch.stripeCustomerId = input.stripeCustomerId;
    if (
      input.stripeSubscriptionId &&
      user.stripeSubscriptionId !== input.stripeSubscriptionId
    )
      patch.stripeSubscriptionId = input.stripeSubscriptionId;
    if (input.subscriptionStatus) patch.subscriptionStatus = input.subscriptionStatus;
    if (periodEnd) patch.subscriptionCurrentPeriodEnd = periodEnd;
    if (startedAt && !user.subscriptionStartedAt)
      patch.subscriptionStartedAt = startedAt;
    if (!user.tier) patch.tier = tier;
    if (!user.phone && input.phone?.trim()) patch.phone = input.phone.trim();
    if (!user.bookingUrl && input.bookingUrl?.trim())
      patch.bookingUrl = input.bookingUrl.trim();
    if (!user.websiteUrl && input.websiteUrl?.trim())
      patch.websiteUrl = input.websiteUrl.trim();
    if (!user.companyName && firmName) patch.companyName = firmName;
    if (!user.portalDisplayName && firmName) patch.portalDisplayName = firmName;

    if (Object.keys(patch).length > 1) {
      try {
        const [updated] = await db
          .update(users)
          .set(patch)
          .where(eq(users.id, user.id))
          .returning();
        if (updated) user = updated;
      } catch (err) {
        errors.push(`user update: ${errMsg(err)}`);
      }
    }
  }

  const ownerName = inputOwnerName || user.name || firmName;
  const productName = tier === "drs" ? "Nexli Dashboard" : "Firm Foundation";

  // ── b. templates ───────────────────────────────────────
  try {
    steps.templates = await seedCpaTemplates(
      user.id,
      user.companyName || firmName
    );
  } catch (err) {
    steps.templates = "failed";
    errors.push(`templates: ${errMsg(err)}`);
  }

  // ── c/d. agreement (Foundation only) ───────────────────
  let admin: UserRow | null = null;
  try {
    admin = await loadAdmin();
  } catch (err) {
    errors.push(`admin lookup: ${errMsg(err)}`);
  }

  let agreementUrl: string | null = null;
  let onboardingUrl: string | undefined;

  if (tier === FOUNDATION_TIER && sendAgreement) {
    if (!user.foundationAgreementEngagementId) {
      if (!admin) {
        steps.agreement = "failed";
        steps.agreementEmail = "skipped";
        errors.push("admin user not found");
      } else {
        try {
          const res = await createFoundationAgreement(user, ownerName, admin);
          steps.agreement = "created";
          if (res.emailed) {
            steps.agreementEmail = "sent";
          } else {
            steps.agreementEmail = "failed";
            errors.push(`agreement email: ${res.emailErrors.join("; ")}`);
          }
          user = (await loadUserById(user.id)) ?? user;
        } catch (err) {
          steps.agreement = "failed";
          steps.agreementEmail = "skipped";
          errors.push(`agreement: ${errMsg(err)}`);
        }
      }
    } else {
      steps.agreement = "exists";
      if (user.foundationAgreementSentAt) {
        steps.agreementEmail = "already";
      } else {
        // d. engagement exists but the recipient email never went out.
        try {
          const found = await loadAgreement(user.foundationAgreementEngagementId);
          if (!found?.signer) {
            steps.agreementEmail = "failed";
            errors.push("agreement email: recipient signer not found");
          } else {
            const engageUrl = getEngageUrl(found.signer.token);
            const { subject, html } = buildEngagementRequestEmail({
              clientName: found.signer.name,
              senderName: admin?.name || "Nexli Automation",
              subject: found.engagement.subject,
              engageUrl,
              expiresAt: found.engagement.expiresAt,
            });
            await sendEmailWithLog({
              to: found.signer.email,
              subject,
              html,
              recipientName: found.signer.name,
              emailType: "engagement_request",
              relatedId: found.engagement.id,
              sentBy: admin?.id,
            });
            await db
              .update(users)
              .set({ foundationAgreementSentAt: new Date(), updatedAt: new Date() })
              .where(eq(users.id, user.id));
            steps.agreementEmail = "sent";
            user = (await loadUserById(user.id)) ?? user;
          }
        } catch (err) {
          steps.agreementEmail = "failed";
          errors.push(`agreement email: ${errMsg(err)}`);
        }
      }
    }
  } else if (user.foundationAgreementEngagementId) {
    steps.agreement = "exists";
    steps.agreementEmail = user.foundationAgreementSentAt ? "already" : "skipped";
  }

  // Resolve the agreement signing link for the welcome email, if any, and
  // open the Launch Pad off the same signer token.
  if (user.foundationAgreementEngagementId) {
    try {
      const found = await loadAgreement(user.foundationAgreementEngagementId);
      if (found?.signer) {
        if (found.signer.status !== "signed") {
          agreementUrl = getEngageUrl(found.signer.token);
        }
        onboardingUrl = getOnboardingUrl(found.signer.token);

        // Open it now rather than waiting for someone to start it by hand
        // after the letter is signed: they have paid, and Stripe and DNS are
        // the two things blocking the build. initOnboarding is a no-op once
        // metadata.onboarding exists, so provisioning retries are safe.
        try {
          await initOnboarding(
            user.foundationAgreementEngagementId,
            "auto_sign",
            tier === FOUNDATION_TIER ? "foundation" : "drs"
          );
        } catch (err) {
          // Non-fatal: the page shows "isn't live yet" rather than breaking.
          errors.push(`onboarding init: ${errMsg(err)}`);
        }
      }
    } catch {
      // Non-fatal — welcome email just omits the agreement block.
    }
  }

  // ── e. welcome email ───────────────────────────────────
  if (sendWelcomeEmail) {
    if (user.welcomeEmailSentAt) {
      steps.welcomeEmail = "already";
    } else {
      try {
        await sendWelcome(user, ownerName, admin?.id ?? null, agreementUrl, productName);
        steps.welcomeEmail = "sent";
        user = (await loadUserById(user.id)) ?? user;
      } catch (err) {
        steps.welcomeEmail = "failed";
        errors.push(`welcome email: ${errMsg(err)}`);
      }
    }
  }

  // ── g. website from pre-purchase preview ───────────────
  if (input.previewConfig) {
    try {
      const existingSite = await getFirmSiteByOwner(user.id);
      if (existingSite) {
        steps.site = "exists";
      } else {
        const slug = await ensureUniqueSlug(slugify(firmName), user.id);
        const validation = validateFirmSiteConfig({
          ...input.previewConfig,
          slug,
        });
        if (!validation.ok) {
          steps.site = "failed";
          errors.push(`site: invalid preview config: ${validation.errors.join("; ")}`);
        } else {
          const now = new Date();
          const config: FirmSiteConfig = { ...validation.config, slug };
          await db.insert(firmSites).values({
            ownerUserId: user.id,
            slug,
            domain: config.domain ?? null,
            status: "draft",
            config,
            previewToken: crypto.randomBytes(24).toString("base64url"),
            generatedBy: "preview",
            generationNotes: `Imported from the pre-purchase preview ${input.previewToken ?? "(unknown token)"}`,
            createdAt: now,
            updatedAt: now,
          });
          steps.site = "created";
        }
      }
    } catch (err) {
      steps.site = "failed";
      errors.push(`site: ${errMsg(err)}`);
    }
  }

  // ── f. provisionedAt ───────────────────────────────────
  const ok = errors.length === 0;
  if (ok && !user.provisionedAt) {
    try {
      await db
        .update(users)
        .set({ provisionedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    } catch (err) {
      errors.push(`provisionedAt: ${errMsg(err)}`);
    }
  }

  return { ok: errors.length === 0, userId: user.id, created, steps, errors, onboardingUrl };
}

// ── Admin resend ──────────────────────────────────────────

export type ResendWhat = "welcome" | "agreement";

export interface ResendResult {
  ok: boolean;
  action: "welcome_sent" | "agreement_created" | "agreement_resent";
  error?: string;
}

export async function resendFoundationEmail(
  userId: string,
  what: ResendWhat
): Promise<ResendResult> {
  const user = await loadUserById(userId);
  if (!user) return { ok: false, action: "welcome_sent", error: "user not found" };
  if (user.role !== "client")
    return { ok: false, action: "welcome_sent", error: "not a client account" };

  const admin = await loadAdmin();
  const ownerName = user.name || user.companyName || "";
  const productName = user.tier === "drs" ? "Nexli Dashboard" : "Firm Foundation";

  if (what === "welcome") {
    let agreementUrl: string | null = null;
    if (user.foundationAgreementEngagementId) {
      const found = await loadAgreement(user.foundationAgreementEngagementId);
      if (found?.signer && found.signer.status !== "signed") {
        agreementUrl = getEngageUrl(found.signer.token);
      }
    }
    try {
      await sendWelcome(user, ownerName, admin?.id ?? null, agreementUrl, productName);
      return { ok: true, action: "welcome_sent" };
    } catch (err) {
      return { ok: false, action: "welcome_sent", error: errMsg(err) };
    }
  }

  // what === "agreement"
  if (!admin) {
    return { ok: false, action: "agreement_created", error: "admin user not found" };
  }

  if (!user.foundationAgreementEngagementId) {
    try {
      const res = await createFoundationAgreement(user, ownerName, admin);
      return res.emailed
        ? { ok: true, action: "agreement_created" }
        : {
            ok: false,
            action: "agreement_created",
            error: `created but email failed: ${res.emailErrors.join("; ")}`,
          };
    } catch (err) {
      return { ok: false, action: "agreement_created", error: errMsg(err) };
    }
  }

  const found = await loadAgreement(user.foundationAgreementEngagementId);
  if (!found?.signer) {
    return {
      ok: false,
      action: "agreement_resent",
      error: "agreement engagement or recipient signer not found",
    };
  }
  if (found.signer.status === "signed" || found.engagement.status === "signed") {
    return { ok: false, action: "agreement_resent", error: "agreement already signed" };
  }

  try {
    const firmName = user.companyName || user.portalDisplayName || user.name || "";
    const { subject, html } = buildAgreementReminderEmail({
      firstName: ownerName.split(" ")[0] || null,
      firmName,
      engageUrl: getEngageUrl(found.signer.token),
      expiresAt: found.engagement.expiresAt,
    });
    await sendEmailWithLog({
      to: found.signer.email,
      subject,
      html,
      recipientName: found.signer.name,
      emailType: "foundation_agreement_reminder",
      relatedId: found.engagement.id,
      sentBy: admin.id,
    });
    await db
      .update(users)
      .set({ foundationAgreementSentAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { ok: true, action: "agreement_resent" };
  } catch (err) {
    return { ok: false, action: "agreement_resent", error: errMsg(err) };
  }
}
