/**
 * Firm Foundation websites — CRUD over `firm_sites`.
 *
 * The marketing app renders each site at
 *   ${MARKETING_SITE_URL}/sites/<slug>            (published)
 *   ${MARKETING_SITE_URL}/sites/<slug>?preview=…  (draft preview)
 *   https://<domain>                              (custom domain, published)
 */
import crypto from "crypto";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { firmSites, users, type FirmSiteRow } from "@/db/schema";
import { leads } from "@/db/external-schema";
import { getMarketingSiteUrl } from "@/lib/foundation-config";
import {
  generateFirmSiteConfig,
  slugify,
  resolveFirmName,
  type OnboardingIntake,
  type UserRow,
} from "@/lib/firm-site-generator";
import {
  RESERVED_SLUGS,
  validateFirmSiteConfig,
  type FirmSiteConfig,
} from "@/lib/firm-sites/types";

export type { FirmSiteRow, OnboardingIntake };

export class ValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type LeadRow = typeof leads.$inferSelect;

// ── Reads ────────────────────────────────────────────────

export async function getFirmSiteByOwner(ownerUserId: string): Promise<FirmSiteRow | null> {
  const [row] = await db
    .select()
    .from(firmSites)
    .where(eq(firmSites.ownerUserId, ownerUserId))
    .limit(1);
  return row ?? null;
}

/**
 * Newest lead row for this email that carries an onboarding intake. The
 * `leads` table belongs to the marketing app; read-only here.
 */
export async function getIntakeForUser(
  email: string
): Promise<{ intake: OnboardingIntake; lead: LeadRow } | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(
        sql`lower(${leads.email}) = ${needle}`,
        isNotNull(leads.onboardingIntake)
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(1);
  if (!lead || !lead.onboardingIntake || typeof lead.onboardingIntake !== "object") {
    return null;
  }
  return { intake: lead.onboardingIntake as OnboardingIntake, lead };
}

// ── Slugs & domains ──────────────────────────────────────

/**
 * Returns `base` if free (or already owned by `ownerUserId`), otherwise
 * `base-2`, `base-3`, … Reserved slugs are always suffixed.
 */
export async function ensureUniqueSlug(base: string, ownerUserId: string): Promise<string> {
  const root = slugify(base);
  const isReserved = (s: string) => RESERVED_SLUGS.includes(s);

  for (let i = 1; i < 1000; i += 1) {
    const candidate = i === 1 ? root : `${root.slice(0, 60 - String(i).length - 1)}-${i}`;
    if (isReserved(candidate)) continue;
    const [taken] = await db
      .select({ ownerUserId: firmSites.ownerUserId })
      .from(firmSites)
      .where(and(eq(firmSites.slug, candidate), ne(firmSites.ownerUserId, ownerUserId)))
      .limit(1);
    if (!taken) return candidate;
  }
  // Practically unreachable; fall back to a random suffix.
  return `${root.slice(0, 50)}-${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * Lowercase, strip protocol / path / leading "www.". Returns null for empty
 * input or anything that is not a bare hostname with a dot.
 */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z]+:\/\//, "");
  d = d.split(/[/?#]/)[0] ?? "";
  d = d.replace(/:\d+$/, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\.+$/, "");
  if (!d.includes(".")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return null;
  return d;
}

// ── Generate ─────────────────────────────────────────────

async function loadUser(userId: string): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("User not found");
  return user;
}

/**
 * (Re)generate the site config for a user. Creates the row on first run;
 * later runs replace config/generatedBy/generationNotes while preserving
 * slug, domain, status and previewToken.
 */
export async function generateSiteForUser(ownerUserId: string): Promise<FirmSiteRow> {
  const user = await loadUser(ownerUserId);
  const existing = await getFirmSiteByOwner(ownerUserId);
  const found = await getIntakeForUser(user.email);
  const intake = found?.intake ?? null;

  const slug =
    existing?.slug ?? (await ensureUniqueSlug(slugify(resolveFirmName(user, intake)), ownerUserId));

  const { config, generatedBy, notes } = await generateFirmSiteConfig({ user, intake, slug });
  const now = new Date();

  // Keep the stored config's domain in sync with the row.
  const domain = existing?.domain ?? normalizeDomain(intake?.preferredDomain);
  const finalConfig: FirmSiteConfig = { ...config, slug };
  delete finalConfig.domain;
  if (domain) finalConfig.domain = domain;

  if (existing) {
    const [row] = await db
      .update(firmSites)
      .set({ config: finalConfig, generatedBy, generationNotes: notes, updatedAt: now })
      .where(eq(firmSites.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(firmSites)
    .values({
      ownerUserId,
      slug,
      domain,
      status: "draft",
      config: finalConfig,
      previewToken: crypto.randomBytes(24).toString("base64url"),
      generatedBy,
      generationNotes: notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

// ── Update / publish ─────────────────────────────────────

export async function updateFirmSite(
  ownerUserId: string,
  patch: { config?: unknown; domain?: unknown }
): Promise<FirmSiteRow> {
  const existing = await getFirmSiteByOwner(ownerUserId);
  if (!existing) throw new NotFoundError("No website for this user");

  const set: Partial<typeof firmSites.$inferInsert> = { updatedAt: new Date() };

  // Domain: undefined = leave alone; null/"" = clear; string = normalise.
  let domain = existing.domain;
  if (patch.domain !== undefined) {
    if (patch.domain === null || patch.domain === "") {
      domain = null;
    } else {
      const d = normalizeDomain(patch.domain);
      if (!d) throw new ValidationError(["domain must be a bare hostname like firm.com"]);
      domain = d;
    }
    set.domain = domain;
  }

  if (patch.config !== undefined) {
    const validated = validateFirmSiteConfig(patch.config);
    if (!validated.ok) throw new ValidationError(validated.errors);
    const config: FirmSiteConfig = { ...validated.config, slug: existing.slug };
    delete config.domain;
    if (domain) config.domain = domain;
    set.config = config;
    set.generatedBy = "manual";
  } else if (patch.domain !== undefined) {
    const config: FirmSiteConfig = { ...existing.config, slug: existing.slug };
    delete config.domain;
    if (domain) config.domain = domain;
    set.config = config;
  }

  const [row] = await db.update(firmSites).set(set).where(eq(firmSites.id, existing.id)).returning();
  return row;
}

export async function publishFirmSite(ownerUserId: string): Promise<FirmSiteRow> {
  const existing = await getFirmSiteByOwner(ownerUserId);
  if (!existing) throw new NotFoundError("No website for this user");
  const now = new Date();
  const [row] = await db
    .update(firmSites)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(eq(firmSites.id, existing.id))
    .returning();
  return row;
}

export async function unpublishFirmSite(ownerUserId: string): Promise<FirmSiteRow> {
  const existing = await getFirmSiteByOwner(ownerUserId);
  if (!existing) throw new NotFoundError("No website for this user");
  const [row] = await db
    .update(firmSites)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(firmSites.id, existing.id))
    .returning();
  return row;
}

// ── URLs & summaries ─────────────────────────────────────

export function getFirmSiteUrls(row: FirmSiteRow): { previewUrl: string; liveUrl: string } {
  const base = `${getMarketingSiteUrl()}/sites/${encodeURIComponent(row.slug)}`;
  return {
    previewUrl: `${base}?preview=${encodeURIComponent(row.previewToken)}`,
    liveUrl: row.domain ? `https://${row.domain}` : base,
  };
}

export interface FirmSiteSummary {
  status: string;
  slug: string;
  domain: string | null;
  generatedBy: string;
  generationNotes: string | null;
  updatedAt: string;
  publishedAt: string | null;
  previewUrl: string;
  liveUrl: string;
}

export function toFirmSiteSummary(row: FirmSiteRow | null): FirmSiteSummary | null {
  if (!row) return null;
  const { previewUrl, liveUrl } = getFirmSiteUrls(row);
  return {
    status: row.status,
    slug: row.slug,
    domain: row.domain,
    generatedBy: row.generatedBy,
    generationNotes: row.generationNotes,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    previewUrl,
    liveUrl,
  };
}
