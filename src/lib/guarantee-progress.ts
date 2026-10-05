import { db } from "@/db";
import { engagements, engagementSigners, users, leadNotifications } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { getNexliAdminId } from "./foundation-project";
import {
  getContacts,
  getCustomFields,
  searchContactsAddedBetween,
  type GHLContact,
} from "./ghl-client";
import { extractUtm } from "./ghl-attribution";
import { ADVISORY_ENGAGEMENT, NEXLI_GUARANTEE } from "./drs-pricing";
import { addDaysToDateOnly, type OnboardingState } from "./onboarding";

/**
 * The Nexli Guarantee progress tracker.
 *
 * The engagement letter guarantees NEXLI_GUARANTEE.QUALIFIED_LEADS qualified
 * leads within LEAD_WINDOW_DAYS of campaign launch; if unmet Nexli works free,
 * and if still unmet EXIT_OPTION_DAYS after launch the client may terminate
 * early. "Campaign launch" is the YYYY-MM-DD the admin records on the
 * client's Launch Pad (engagements.metadata.onboarding.campaignLaunchedAt).
 *
 * A lead is the same thing Ad Analytics counts: a GoHighLevel contact in the
 * client's own location that carries UTM data (lib/ghl-attribution). Clients
 * without a GHL location fall back to lead_notifications rows. Results are
 * memoized per client for 10 minutes — both the client Overview card and the
 * admin Client Tracker read through this.
 */

export type GuaranteeStatus = "not_launched" | "on_track" | "behind" | "met" | "missed";

export interface GuaranteeProgress {
  /** YYYY-MM-DD the campaigns went live, or null when not yet launched. */
  launchedAt: string | null;
  target: number;
  leads: number;
  daysElapsed: number;
  daysRemaining: number;
  /** YYYY-MM-DD the 90-day window closes. */
  windowEndsAt: string | null;
  /** YYYY-MM-DD from which the client may terminate early if still unmet. */
  exitOptionAt: string | null;
  status: GuaranteeStatus;
  /** leads × ADVISORY_ENGAGEMENT.AVG_USD — illustrative, never a revenue claim. */
  pipelineValueCents: number;
  avgEngagementCents: number;
  source: "ghl" | "notifications" | "none";
  computedAt: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 50; // 5,000 contacts — sanity cap on a 90-day window
/** Too early in the window to call a client "behind" (noise, ramp-up). */
const GRACE_DAYS = 14;
/** Pace tolerance: behind only when under 80% of the linear pace. */
const PACE_TOLERANCE = 0.8;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface ResolvedEngagement {
  id: string;
  campaignLaunchedAt: string | null;
}

/**
 * The client's DRS engagement: owned by the Nexli admin, the client is a
 * signer (order > 0, email matched case-insensitively — signer emails are
 * stored verbatim), and metadata.billingPlan is set (DRS letters snapshot it
 * at compose time). Prefers one with a recorded launch, then the latest
 * signed. Null when the client has no DRS engagement at all.
 */
async function resolveEngagement(clientEmail: string): Promise<ResolvedEngagement | null> {
  const adminId = await getNexliAdminId();
  if (!adminId) return null;
  const emailLc = clientEmail.toLowerCase().trim();

  const rows = await db
    .select({
      id: engagements.id,
      metadata: engagements.metadata,
      signerStatus: engagementSigners.status,
      signedAt: engagementSigners.signedAt,
    })
    .from(engagements)
    .innerJoin(engagementSigners, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, adminId),
        sql`${engagementSigners.order} > 0`,
        sql`lower(${engagementSigners.email}) = ${emailLc}`,
        sql`${engagements.metadata}->>'billingPlan' IS NOT NULL`
      )
    );
  if (rows.length === 0) return null;

  const launchOf = (metadata: unknown): string | null => {
    const ob = ((metadata || {}) as { onboarding?: OnboardingState }).onboarding;
    const v = ob?.campaignLaunchedAt;
    return typeof v === "string" && DATE_ONLY.test(v) ? v : null;
  };
  const signedMs = (r: (typeof rows)[number]) =>
    r.signerStatus === "signed" && r.signedAt ? new Date(r.signedAt).getTime() : -1;

  const best = [...rows].sort((a, b) => {
    const la = launchOf(a.metadata) ? 1 : 0;
    const lb = launchOf(b.metadata) ? 1 : 0;
    if (la !== lb) return lb - la;
    return signedMs(b) - signedMs(a);
  })[0];

  return { id: best.id, campaignLaunchedAt: launchOf(best.metadata) };
}

/**
 * Contacts added in the window, paged via POST /contacts/search with a
 * list-scan fallback — the same strategy as the Ad Analytics route.
 */
async function fetchContactsInWindow(
  locationId: string,
  since: Date,
  until: Date
): Promise<GHLContact[]> {
  const byId = new Map<string, GHLContact>();
  const inWindow = (c: GHLContact) => {
    const d = new Date(c.dateAdded);
    return !isNaN(d.getTime()) && d >= since && d <= until;
  };

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await searchContactsAddedBetween(locationId, since, until, page, PAGE_LIMIT);
      const contacts = res.contacts ?? [];
      for (const c of contacts) if (inWindow(c)) byId.set(c.id, c);
      if (contacts.length < PAGE_LIMIT) break;
    }
    return [...byId.values()];
  } catch (err) {
    console.error("[guarantee] contacts/search failed, falling back to list scan:", err);
  }

  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await getContacts(locationId, PAGE_LIMIT, cursor);
    const contacts = res.contacts ?? [];
    if (contacts.length === 0) break;
    for (const c of contacts) if (inWindow(c)) byId.set(c.id, c);
    const last = contacts[contacts.length - 1]?.id;
    if (!last || last === cursor || contacts.length < PAGE_LIMIT) break;
    cursor = last;
  }
  return [...byId.values()];
}

/** Qualified leads since launch: GHL contacts with UTM data, same as Ad Analytics. */
async function countGhlLeads(locationId: string, since: Date, until: Date): Promise<number> {
  const [fieldDefs, contacts] = await Promise.all([
    getCustomFields(locationId).catch((err) => {
      console.error("[guarantee] custom fields lookup failed (continuing):", err);
      return { customFields: [] };
    }),
    fetchContactsInWindow(locationId, since, until),
  ]);
  const fieldNames = new Map<string, string>();
  for (const f of fieldDefs.customFields ?? []) {
    fieldNames.set(f.id, f.fieldKey || f.name || "");
  }
  let leads = 0;
  for (const c of contacts) if (extractUtm(c, fieldNames)) leads++;
  return leads;
}

async function countNotificationLeads(clientUserId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(leadNotifications)
    .where(
      and(eq(leadNotifications.userId, clientUserId), gte(leadNotifications.createdAt, since))
    );
  return row?.count || 0;
}

/**
 * Status rules:
 *   met      — leads ≥ target (at any point)
 *   missed   — window over (daysElapsed > LEAD_WINDOW_DAYS) and still short
 *   behind   — ≥ GRACE_DAYS in and under 80% of the linear pace to target
 *   on_track — otherwise (including the first two weeks)
 */
export function guaranteeStatus(leads: number, daysElapsed: number, target: number): GuaranteeStatus {
  if (leads >= target) return "met";
  if (daysElapsed > NEXLI_GUARANTEE.LEAD_WINDOW_DAYS) return "missed";
  const pace = target * (daysElapsed / NEXLI_GUARANTEE.LEAD_WINDOW_DAYS) * PACE_TOLERANCE;
  if (daysElapsed >= GRACE_DAYS && leads < pace) return "behind";
  return "on_track";
}

function notLaunched(now: Date): GuaranteeProgress {
  return {
    launchedAt: null,
    target: NEXLI_GUARANTEE.QUALIFIED_LEADS,
    leads: 0,
    daysElapsed: 0,
    daysRemaining: NEXLI_GUARANTEE.LEAD_WINDOW_DAYS,
    windowEndsAt: null,
    exitOptionAt: null,
    status: "not_launched",
    pipelineValueCents: 0,
    avgEngagementCents: ADVISORY_ENGAGEMENT.AVG_USD * 100,
    source: "none",
    computedAt: now.toISOString(),
  };
}

async function computeGuaranteeProgress(clientUserId: string): Promise<GuaranteeProgress | null> {
  const [client] = await db
    .select({ email: users.email, ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, clientUserId))
    .limit(1);
  if (!client) return null;

  const engagement = await resolveEngagement(client.email);
  if (!engagement) return null;

  const now = new Date();
  const launchedAt = engagement.campaignLaunchedAt;
  if (!launchedAt) return notLaunched(now);

  // Launch day counts from 00:00 UTC — date-only strings never drift with TZ.
  const since = new Date(`${launchedAt}T00:00:00Z`);
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
  const daysRemaining = Math.max(0, NEXLI_GUARANTEE.LEAD_WINDOW_DAYS - daysElapsed);

  let leads = 0;
  let source: GuaranteeProgress["source"] = "notifications";
  if (client.ghlLocationId) {
    leads = await countGhlLeads(client.ghlLocationId, since, now);
    source = "ghl";
  } else {
    leads = await countNotificationLeads(clientUserId, since);
  }

  const target = NEXLI_GUARANTEE.QUALIFIED_LEADS;
  return {
    launchedAt,
    target,
    leads,
    daysElapsed,
    daysRemaining,
    windowEndsAt: addDaysToDateOnly(launchedAt, NEXLI_GUARANTEE.LEAD_WINDOW_DAYS),
    exitOptionAt: addDaysToDateOnly(launchedAt, NEXLI_GUARANTEE.EXIT_OPTION_DAYS),
    status: guaranteeStatus(leads, daysElapsed, target),
    pipelineValueCents: leads * ADVISORY_ENGAGEMENT.AVG_USD * 100,
    avgEngagementCents: ADVISORY_ENGAGEMENT.AVG_USD * 100,
    source,
    computedAt: now.toISOString(),
  };
}

// ── Memo (per client, 10 min; in-flight calls are shared) ─────

const cache = new Map<string, { expiresAt: number; promise: Promise<GuaranteeProgress | null> }>();

/**
 * Guarantee progress for a client dashboard account. Null when the client
 * has no DRS engagement at all; `status: "not_launched"` when there is one
 * but no campaign launch date has been recorded yet. Throws on GHL/DB
 * failure (callers decide whether that is fatal) and drops the memo entry
 * so the next call retries.
 */
export async function getGuaranteeProgress(clientUserId: string): Promise<GuaranteeProgress | null> {
  const hit = cache.get(clientUserId);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = computeGuaranteeProgress(clientUserId).catch((err) => {
    cache.delete(clientUserId);
    throw err;
  });
  cache.set(clientUserId, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  return promise;
}
