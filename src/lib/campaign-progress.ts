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
import { ADVISORY_ENGAGEMENT } from "./drs-pricing";
import type { OnboardingState } from "./onboarding";

/**
 * Campaign progress tracker.
 *
 * Counts the leads a client's campaigns have generated since launch.
 * "Campaign launch" is the YYYY-MM-DD the admin records on the client's
 * Launch Pad (engagements.metadata.onboarding.campaignLaunchedAt).
 *
 * A lead is the same thing Ad Analytics counts: a GoHighLevel contact in the
 * client's own location that carries UTM data (lib/ghl-attribution). Clients
 * without a GHL location fall back to lead_notifications rows. Results are
 * memoized per client for 10 minutes — both the client Overview tile and the
 * admin Client Tracker read through this.
 */

export type CampaignStatus = "not_launched" | "live";

export interface CampaignProgress {
  /** YYYY-MM-DD the campaigns went live, or null when not yet launched. */
  launchedAt: string | null;
  leads: number;
  daysSinceLaunch: number;
  /** leads × ADVISORY_ENGAGEMENT.AVG_USD — illustrative, never a revenue claim. */
  pipelineValueCents: number;
  avgEngagementCents: number;
  status: CampaignStatus;
  source: "ghl" | "notifications" | "none";
  computedAt: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 50; // 5,000 contacts — sanity cap per scan

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
    console.error("[campaign-progress] contacts/search failed, falling back to list scan:", err);
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

/** Leads since launch: GHL contacts with UTM data, same as Ad Analytics. */
async function countGhlLeads(locationId: string, since: Date, until: Date): Promise<number> {
  const [fieldDefs, contacts] = await Promise.all([
    getCustomFields(locationId).catch((err) => {
      console.error("[campaign-progress] custom fields lookup failed (continuing):", err);
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

function notLaunched(now: Date): CampaignProgress {
  return {
    launchedAt: null,
    leads: 0,
    daysSinceLaunch: 0,
    pipelineValueCents: 0,
    avgEngagementCents: ADVISORY_ENGAGEMENT.AVG_USD * 100,
    status: "not_launched",
    source: "none",
    computedAt: now.toISOString(),
  };
}

async function computeCampaignProgress(clientUserId: string): Promise<CampaignProgress | null> {
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
  const daysSinceLaunch = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));

  let leads = 0;
  let source: CampaignProgress["source"] = "notifications";
  if (client.ghlLocationId) {
    leads = await countGhlLeads(client.ghlLocationId, since, now);
    source = "ghl";
  } else {
    leads = await countNotificationLeads(clientUserId, since);
  }

  return {
    launchedAt,
    leads,
    daysSinceLaunch,
    pipelineValueCents: leads * ADVISORY_ENGAGEMENT.AVG_USD * 100,
    avgEngagementCents: ADVISORY_ENGAGEMENT.AVG_USD * 100,
    status: "live",
    source,
    computedAt: now.toISOString(),
  };
}

// ── Memo (per client, 10 min; in-flight calls are shared) ─────

const cache = new Map<string, { expiresAt: number; promise: Promise<CampaignProgress | null> }>();

/**
 * Campaign progress for a client dashboard account. Null when the client
 * has no DRS engagement at all; `status: "not_launched"` when there is one
 * but no campaign launch date has been recorded yet. Throws on GHL/DB
 * failure (callers decide whether that is fatal) and drops the memo entry
 * so the next call retries.
 */
export async function getCampaignProgress(clientUserId: string): Promise<CampaignProgress | null> {
  const hit = cache.get(clientUserId);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = computeCampaignProgress(clientUserId).catch((err) => {
    cache.delete(clientUserId);
    throw err;
  });
  cache.set(clientUserId, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  return promise;
}
