import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, pipelineLeads, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import {
  getContacts,
  getCustomFields,
  searchContactsAddedBetween,
  type GHLContact,
} from "@/lib/ghl-client";
import {
  extractUtm,
  groupKey,
  hasBookedTag,
  type UtmAttribution,
} from "@/lib/ghl-attribution";
import { ensurePipelineTable } from "@/lib/pipeline-table";

/**
 * Ad Analytics — UTM attribution sourced from GoHighLevel contacts.
 *
 * Every lead ends up in GHL (booked calls, forms, workflows), and GHL keeps
 * the UTM parameters the contact arrived with. This route scans the owner's
 * contacts added in the selected window, pulls UTM data from wherever GHL
 * stored it (see lib/ghl-attribution), and rolls it up by campaign
 * (utm_campaign) and creative (utm_content) — the two fields the UTM Link
 * Builder writes. Booked calls come from GHL tags + the internal pipeline;
 * "won" comes from the pipeline board.
 *
 * Results are cached 10 minutes per owner + range in analyticsSnapshots so
 * page loads don't hammer the GHL API. `?refresh=1` bypasses the cache.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const SOURCE = "ad-analytics";
const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // 1,000 contacts per scan
const RECENT_LIMIT = 50;

type Range = "7" | "30" | "90" | "all";

interface Bucket {
  key: string;
  label: string;
  total: number;
  booked: number;
  won: number;
}

interface RecentLead {
  id: string;
  name: string;
  email: string | null;
  source: string | null;
  campaign: string | null;
  content: string | null;
  booked: boolean;
  won: boolean;
  dateAdded: string;
}

interface AdAnalyticsData {
  connected: boolean;
  range: Range;
  ghlLocationId: string | null;
  summary: { totalLeads: number; bookedCalls: number; won: number };
  campaigns: Bucket[];
  creatives: Bucket[];
  sources: Bucket[];
  recentLeads: RecentLead[];
  diagnostics: {
    scanned: number;
    withUtm: number;
    mode: "search" | "list" | "none";
    truncated: boolean;
    since: string;
  };
  computedAt: string;
}

function parseRange(v: string | null): Range {
  return v === "7" || v === "90" || v === "all" ? v : "30";
}

function windowFor(range: Range): { since: Date; until: Date } {
  // "All" is bounded to a year — GHL search is paged, and a year covers the
  // history of the current ad campaigns.
  const days = range === "all" ? 365 : Number(range);
  const until = new Date();
  const since = new Date(Date.now() - days * 86400000);
  since.setHours(0, 0, 0, 0);
  return { since, until };
}

function empty(range: Range, connected: boolean, locationId: string | null): AdAnalyticsData {
  return {
    connected,
    range,
    ghlLocationId: locationId,
    summary: { totalLeads: 0, bookedCalls: 0, won: 0 },
    campaigns: [],
    creatives: [],
    sources: [],
    recentLeads: [],
    diagnostics: {
      scanned: 0,
      withUtm: 0,
      mode: "none",
      truncated: false,
      since: windowFor(range).since.toISOString(),
    },
    computedAt: new Date().toISOString(),
  };
}

/**
 * Contacts added in the window. Prefers POST /contacts/search (server-side
 * date filter, full objects). If that endpoint is unavailable (scope, API
 * change) it falls back to scanning GET /contacts/ pages and filtering by
 * dateAdded locally.
 */
async function fetchContactsInWindow(
  locationId: string,
  since: Date,
  until: Date
): Promise<{ contacts: GHLContact[]; mode: "search" | "list"; truncated: boolean }> {
  const byId = new Map<string, GHLContact>();
  const inWindow = (c: GHLContact) => {
    const d = new Date(c.dateAdded);
    return !isNaN(d.getTime()) && d >= since && d <= until;
  };

  try {
    let truncated = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await searchContactsAddedBetween(locationId, since, until, page, PAGE_LIMIT);
      const contacts = res.contacts ?? [];
      for (const c of contacts) if (inWindow(c)) byId.set(c.id, c);
      if (contacts.length < PAGE_LIMIT) break;
      if (page === MAX_PAGES) truncated = true;
    }
    return { contacts: [...byId.values()], mode: "search", truncated };
  } catch (err) {
    console.error("[ad-analytics] contacts/search failed, falling back to list scan:", err);
  }

  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await getContacts(locationId, PAGE_LIMIT, cursor);
    const contacts = res.contacts ?? [];
    if (contacts.length === 0) break;
    for (const c of contacts) if (inWindow(c)) byId.set(c.id, c);
    const last = contacts[contacts.length - 1]?.id;
    if (!last || last === cursor || contacts.length < PAGE_LIMIT) break;
    cursor = last;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { contacts: [...byId.values()], mode: "list", truncated };
}

function bump(map: Map<string, Bucket>, raw: string | null, booked: boolean, won: boolean) {
  const key = groupKey(raw);
  if (!key || !raw) return;
  const b = map.get(key) ?? { key, label: raw.trim(), total: 0, booked: 0, won: 0 };
  b.total++;
  if (booked) b.booked++;
  if (won) b.won++;
  map.set(key, b);
}

function sorted(map: Map<string, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => b.booked - a.booked || b.total - a.total);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = session.user.id;
  const range = parseRange(req.nextUrl.searchParams.get("days"));
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  const [owner] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  const locationId = owner?.ghlLocationId ?? null;
  if (!locationId) {
    return NextResponse.json(empty(range, false, null));
  }

  const cacheWhere = and(
    eq(analyticsSnapshots.userId, ownerId),
    eq(analyticsSnapshots.source, SOURCE),
    sql`${analyticsSnapshots.data}->>'range' = ${range}`
  );
  const [cached] = await db
    .select()
    .from(analyticsSnapshots)
    .where(cacheWhere)
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(1);
  if (
    !refresh &&
    cached &&
    Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json(cached.data);
  }

  const { since, until } = windowFor(range);

  try {
    await ensurePipelineTable();

    const [fieldDefs, pipelineRows, fetched] = await Promise.all([
      getCustomFields(locationId).catch((err) => {
        console.error("[ad-analytics] custom fields lookup failed (continuing):", err);
        return { customFields: [] };
      }),
      db
        .select({
          ghlContactId: pipelineLeads.ghlContactId,
          stage: pipelineLeads.stage,
          bookedAt: pipelineLeads.bookedAt,
          source: pipelineLeads.source,
        })
        .from(pipelineLeads)
        .where(and(eq(pipelineLeads.ownerId, ownerId), isNotNull(pipelineLeads.ghlContactId))),
      fetchContactsInWindow(locationId, since, until),
    ]);

    const fieldNames = new Map<string, string>();
    for (const f of fieldDefs.customFields ?? []) {
      fieldNames.set(f.id, f.fieldKey || f.name || "");
    }

    const pipelineByContact = new Map(
      pipelineRows.map((r) => [r.ghlContactId as string, r])
    );

    const campaigns = new Map<string, Bucket>();
    const creatives = new Map<string, Bucket>();
    const sources = new Map<string, Bucket>();
    const leads: RecentLead[] = [];

    for (const c of fetched.contacts) {
      const utm: UtmAttribution | null = extractUtm(c, fieldNames);
      if (!utm) continue;
      const p = pipelineByContact.get(c.id);
      const booked =
        hasBookedTag(c.tags) || Boolean(p?.bookedAt) || p?.source === "booked_call";
      const won = p?.stage === "won";

      bump(campaigns, utm.campaign, booked, won);
      bump(creatives, utm.content, booked, won);
      bump(sources, utm.source, booked, won);

      leads.push({
        id: c.id,
        name:
          [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "GHL contact",
        email: c.email || null,
        source: utm.source,
        campaign: utm.campaign,
        content: utm.content,
        booked,
        won,
        dateAdded: c.dateAdded,
      });
    }

    leads.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

    const data: AdAnalyticsData = {
      connected: true,
      range,
      ghlLocationId: locationId,
      summary: {
        totalLeads: leads.length,
        bookedCalls: leads.filter((l) => l.booked).length,
        won: leads.filter((l) => l.won).length,
      },
      campaigns: sorted(campaigns),
      creatives: sorted(creatives),
      sources: sorted(sources),
      recentLeads: leads.slice(0, RECENT_LIMIT),
      diagnostics: {
        scanned: fetched.contacts.length,
        withUtm: leads.length,
        mode: fetched.mode,
        truncated: fetched.truncated,
        since: since.toISOString(),
      },
      computedAt: new Date().toISOString(),
    };

    await db.delete(analyticsSnapshots).where(cacheWhere);
    await db.insert(analyticsSnapshots).values({
      userId: ownerId,
      source: SOURCE,
      periodStart: since,
      periodEnd: until,
      data,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[ad-analytics] Error:", err);
    if (cached) return NextResponse.json(cached.data);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load ad analytics from GoHighLevel", message: message.slice(0, 300) },
      { status: 502 }
    );
  }
}
