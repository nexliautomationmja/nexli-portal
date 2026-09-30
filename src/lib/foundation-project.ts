/**
 * Firm Foundation project status, as seen by the firm owner.
 *
 * A Foundation firm is BOTH a tenant of this app (their own dashboard at
 * /login) AND a client of Nexli (magic-link portal at /portal, where the
 * Nexli admin user is the "owner"). This module builds the project tracker
 * shown in that Nexli client portal and, optionally, on the firm's own
 * dashboard.
 *
 * Every lookup is wrapped so a missing table (e.g. `firm_sites` before its
 * migration runs) or a transient DB error degrades to "not done" rather than
 * breaking the page.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { engagementSigners, firmSites, users } from "@/db/schema";
import { leads } from "@/db/external-schema";
import { getEngageUrl } from "@/lib/engagements";
import {
  FOUNDATION_TIER,
  NEXLI_ADMIN_EMAIL,
  getMarketingSiteUrl,
  getPortalUrl,
} from "@/lib/foundation-config";

export type FoundationStepKey =
  | "paid"
  | "agreementSigned"
  | "intakeReceived"
  | "websiteDraft"
  | "websiteLive"
  | "portalReady";

export interface FoundationProjectStep {
  key: FoundationStepKey;
  label: string;
  done: boolean;
  /** ISO timestamp of completion, when known. */
  at?: string | null;
}

export interface FoundationProject {
  firmName: string;
  steps: FoundationProjectStep[];
  /** The firm's own dashboard login (credentials). */
  dashboardUrl: string;
  /** Public URL of the firm's website once published. */
  siteUrl: string | null;
  /** Signing link for the service agreement while it is still unsigned. */
  agreementUrl: string | null;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[foundation-project] ${label} lookup failed:`, err);
    return null;
  }
}

/** The Nexli admin user that owns Foundation agreements, or null if unseeded. */
export async function getNexliAdminId(): Promise<string | null> {
  const adminEmail = NEXLI_ADMIN_EMAIL.toLowerCase().trim();
  const row = await safe("nexli admin", async () => {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(sql`lower(${users.email}) = ${adminEmail}`, eq(users.role, "admin"))
      )
      .limit(1);
    return u ?? null;
  });
  return row?.id ?? null;
}

/**
 * Build the project tracker for a Foundation firm owner identified by email.
 * Returns null when the email does not belong to a Foundation-tier client.
 */
export async function getFoundationProjectForEmail(
  email: string
): Promise<FoundationProject | null> {
  const normalEmail = email.toLowerCase().trim();
  if (!normalEmail) return null;

  const [firm] = await db
    .select({
      id: users.id,
      name: users.name,
      companyName: users.companyName,
      portalDisplayName: users.portalDisplayName,
      subscriptionStartedAt: users.subscriptionStartedAt,
      provisionedAt: users.provisionedAt,
      lastLoginAt: users.lastLoginAt,
      foundationAgreementEngagementId: users.foundationAgreementEngagementId,
    })
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = ${normalEmail}`,
        eq(users.role, "client"),
        eq(users.tier, FOUNDATION_TIER)
      )
    )
    .limit(1);

  if (!firm) return null;

  const firmName =
    firm.companyName || firm.portalDisplayName || firm.name || "Your firm";

  // 1. Paid
  const paidAt = iso(firm.subscriptionStartedAt);

  // 2. Agreement signed (signer order 1 on the Foundation agreement)
  const signer = firm.foundationAgreementEngagementId
    ? await safe("agreement signer", async () => {
        const [s] = await db
          .select({
            status: engagementSigners.status,
            signedAt: engagementSigners.signedAt,
            token: engagementSigners.token,
          })
          .from(engagementSigners)
          .where(
            and(
              eq(
                engagementSigners.engagementId,
                firm.foundationAgreementEngagementId!
              ),
              eq(engagementSigners.order, 1)
            )
          )
          .limit(1);
        return s ?? null;
      })
    : null;
  const agreementSigned = signer?.status === "signed";

  // 3. Onboarding intake (marketing `leads` mirror, newest row for the email)
  const intake = await safe("onboarding intake", async () => {
    const [lead] = await db
      .select({ onboardingIntake: leads.onboardingIntake })
      .from(leads)
      .where(sql`lower(${leads.email}) = ${normalEmail}`)
      .orderBy(desc(leads.createdAt))
      .limit(1);
    return lead ?? null;
  });
  const intakeData =
    intake?.onboardingIntake && typeof intake.onboardingIntake === "object"
      ? (intake.onboardingIntake as { submittedAt?: string | null })
      : null;
  const intakeReceived = !!intakeData;

  // 4/5. Website draft + live (firm_sites may not be migrated yet)
  const site = await safe("firm site", async () => {
    const [s] = await db
      .select({
        slug: firmSites.slug,
        domain: firmSites.domain,
        status: firmSites.status,
        updatedAt: firmSites.updatedAt,
        publishedAt: firmSites.publishedAt,
      })
      .from(firmSites)
      .where(eq(firmSites.ownerUserId, firm.id))
      .limit(1);
    return s ?? null;
  });
  const sitePublished = site?.status === "published";

  // 6. Firm dashboard ready
  const portalReadyAt = iso(firm.provisionedAt) ?? iso(firm.lastLoginAt);

  const steps: FoundationProjectStep[] = [
    { key: "paid", label: "Subscription active", done: !!paidAt, at: paidAt },
    {
      key: "agreementSigned",
      label: "Service agreement signed",
      done: agreementSigned,
      at: agreementSigned ? iso(signer?.signedAt) : null,
    },
    {
      key: "intakeReceived",
      label: "Onboarding details received",
      done: intakeReceived,
      at: intakeReceived ? iso(intakeData?.submittedAt) : null,
    },
    {
      key: "websiteDraft",
      label: "Website draft created",
      done: !!site,
      at: site ? iso(site.updatedAt) : null,
    },
    {
      key: "websiteLive",
      label: site?.domain ? "Website live" : "Website published",
      done: sitePublished,
      at: sitePublished ? iso(site?.publishedAt) : null,
    },
    {
      key: "portalReady",
      label: "Your firm dashboard is ready",
      done: !!portalReadyAt,
      at: portalReadyAt,
    },
  ];

  const siteUrl =
    sitePublished && site
      ? site.domain
        ? `https://${site.domain}`
        : `${getMarketingSiteUrl()}/sites/${site.slug}`
      : null;

  const agreementUrl =
    signer && signer.status !== "signed" ? getEngageUrl(signer.token) : null;

  return {
    firmName,
    steps,
    dashboardUrl: `${getPortalUrl()}/login`,
    siteUrl,
    agreementUrl,
  };
}
