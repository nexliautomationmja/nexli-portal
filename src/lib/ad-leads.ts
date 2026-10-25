import { db } from "@/db";
import { pipelineLeads } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  getContacts,
  getCustomFields,
  searchContactsAddedBetween,
  type GHLContact,
} from "@/lib/ghl-client";
import {
  extractUtm,
  hasBookedTag,
  platformOf,
  type LeadPlatform,
  type UtmAttribution,
} from "@/lib/ghl-attribution";
import { ensurePipelineTable } from "@/lib/pipeline-table";

/**
 * Shared GoHighLevel lead scan for Ad Analytics and the admin Overview's
 * Meta ads section: contacts added in a window, each classified with its
 * UTM attribution, booked / won status (GHL tags + internal pipeline) and
 * Meta platform (see platformOf).
 */

const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // 1,000 contacts per scan

export interface ClassifiedContact {
  contact: GHLContact;
  /** null when the contact carries no UTM data anywhere. */
  utm: UtmAttribution | null;
  booked: boolean;
  won: boolean;
  /** Meta placement, "unknown" for Meta-without-platform, null for non-Meta. */
  platform: LeadPlatform | null;
}

export interface AdLeadScan {
  contacts: ClassifiedContact[];
  scanned: number;
  mode: "search" | "list";
  truncated: boolean;
}

/**
 * Contacts added in the window. Prefers POST /contacts/search (server-side
 * date filter, full objects). If that endpoint is unavailable (scope, API
 * change) it falls back to scanning GET /contacts/ pages and filtering by
 * dateAdded locally.
 */
export async function fetchContactsInWindow(
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
    console.error("[ad-leads] contacts/search failed, falling back to list scan:", err);
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

/**
 * Scan `locationId`'s contacts added between `since` and `until` and
 * classify each. Throws on GHL failure (callers fall back to cache).
 */
export async function scanAdLeads(opts: {
  ownerId: string;
  locationId: string;
  since: Date;
  until: Date;
}): Promise<AdLeadScan> {
  const { ownerId, locationId, since, until } = opts;
  await ensurePipelineTable();

  const [fieldDefs, pipelineRows, fetched] = await Promise.all([
    getCustomFields(locationId).catch((err) => {
      console.error("[ad-leads] custom fields lookup failed (continuing):", err);
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

  const pipelineByContact = new Map(pipelineRows.map((r) => [r.ghlContactId as string, r]));

  const contacts: ClassifiedContact[] = fetched.contacts.map((c) => {
    const utm = extractUtm(c, fieldNames);
    const p = pipelineByContact.get(c.id);
    return {
      contact: c,
      utm,
      booked: hasBookedTag(c.tags) || Boolean(p?.bookedAt) || p?.source === "booked_call",
      won: p?.stage === "won",
      platform: platformOf(utm, c),
    };
  });

  return {
    contacts,
    scanned: fetched.contacts.length,
    mode: fetched.mode,
    truncated: fetched.truncated,
  };
}
