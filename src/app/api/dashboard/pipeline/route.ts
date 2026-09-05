import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, pipelineLeads, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc, isNotNull, isNull } from "drizzle-orm";
import {
  getContacts,
  getContactById,
  getAllCalendarEvents,
  type GHLContact,
} from "@/lib/ghl-client";
import { ensurePipelineTable, MAX_VALUE_CENTS } from "@/lib/pipeline-table";
import { PIPELINE } from "@/lib/drs-pricing";

/**
 * Internal sales pipeline — owner-scoped. Manual leads plus an automatic
 * sync: any GHL contact with a non-cancelled booked calendar event lands on
 * the "open" side (once — a lead marked won/lost, or removed, is never
 * re-added; removal soft-deletes so the tombstone blocks re-import). Each
 * lead's value defaults to the expected client LTV
 * (PIPELINE.DEFAULT_DEAL_VALUE_CENTS) and is editable per lead.
 *
 * The sync is time-gated (15 min per owner, tracked in analyticsSnapshots)
 * so dashboard loads and rapid board actions don't hammer the GHL API.
 */

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const SYNC_GATE_MS = 15 * 60 * 1000;
const SYNC_SOURCE = "pipeline-sync";

async function shouldSync(ownerId: string): Promise<boolean> {
  const [marker] = await db
    .select({ createdAt: analyticsSnapshots.createdAt })
    .from(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, ownerId),
        eq(analyticsSnapshots.source, SYNC_SOURCE)
      )
    )
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(1);
  return !marker || Date.now() - new Date(marker.createdAt).getTime() > SYNC_GATE_MS;
}

async function markSynced(ownerId: string): Promise<void> {
  await db
    .delete(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, ownerId),
        eq(analyticsSnapshots.source, SYNC_SOURCE)
      )
    );
  await db.insert(analyticsSnapshots).values({
    userId: ownerId,
    source: SYNC_SOURCE,
    periodStart: new Date(),
    periodEnd: new Date(),
    data: { syncedAt: new Date().toISOString() },
  });
}

/**
 * A contact counts as "booked" when a tag shows they booked a call at some
 * point (cal.com bookings, "booked call", "call booked", …) — evidence of
 * real interest even if the event itself is outside the calendar window.
 */
function hasBookedTag(tags: string[] | undefined): boolean {
  if (!tags) return false;
  return tags.some((raw) => {
    const t = raw.toLowerCase();
    return t.includes("cal.com") || (t.includes("book") && t.includes("call"));
  });
}

async function syncBookedCalls(ownerId: string): Promise<void> {
  const [user] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!user?.ghlLocationId) return;
  const locationId = user.ghlLocationId;

  // Booked calls: last 90 days through 60 days out.
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  // Scan up to 3 pages of contacts (300) so booked-call tags are seen even
  // on larger contact lists.
  const fetchContacts = async (): Promise<GHLContact[]> => {
    const all: GHLContact[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const res = await getContacts(locationId, 100, cursor);
      const contacts = res.contacts ?? [];
      if (contacts.length === 0) break;
      all.push(...contacts);
      const last = contacts[contacts.length - 1]?.id;
      if (!last || last === cursor || contacts.length < 100) break;
      cursor = last;
    }
    return all;
  };

  const [contacts, events] = await Promise.all([
    fetchContacts(),
    getAllCalendarEvents(locationId, start.toISOString(), end.toISOString()),
  ]);

  // Candidates: contactId → earliest parseable event time (null when only a
  // tag proves the booking, or GHL sends an unparseable date).
  const candidates = new Map<string, Date | null>();

  for (const e of events) {
    if (!e.contactId || e.status === "cancelled") continue;
    const t = new Date(e.startTime);
    const valid = !isNaN(t.getTime());
    const prev = candidates.get(e.contactId);
    if (prev === undefined) {
      candidates.set(e.contactId, valid ? t : null);
    } else if (valid && (prev === null || t.getTime() < prev.getTime())) {
      candidates.set(e.contactId, t);
    }
  }

  // Tagged contacts (cal.com / booked call) show past interest — they enter
  // the pipeline too, without a booked date.
  for (const c of contacts) {
    if (!candidates.has(c.id) && hasBookedTag(c.tags)) {
      candidates.set(c.id, null);
    }
  }

  if (candidates.size === 0) {
    await markSynced(ownerId);
    return;
  }

  // Never re-add a contact that's already in the pipeline — any stage,
  // including soft-deleted tombstones.
  const existing = await db
    .select({ ghlContactId: pipelineLeads.ghlContactId })
    .from(pipelineLeads)
    .where(
      and(eq(pipelineLeads.ownerId, ownerId), isNotNull(pipelineLeads.ghlContactId))
    );
  const known = new Set(existing.map((r) => r.ghlContactId));

  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // Contacts outside the fetched pages get an individual lookup (bounded).
  let individualLookups = 0;
  for (const [contactId, bookedAt] of candidates) {
    if (known.has(contactId)) continue;
    let contact = contactById.get(contactId);
    if (!contact && individualLookups < 15) {
      individualLookups++;
      try {
        contact = (await getContactById(locationId, contactId)).contact;
      } catch (err) {
        console.error("Pipeline sync: contact lookup failed:", contactId, err);
      }
    }
    if (!contact) continue;
    const name =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email ||
      "GHL lead";
    try {
      await db.insert(pipelineLeads).values({
        ownerId,
        name: name.slice(0, 200),
        email: contact.email || null,
        phone: contact.phone || null,
        source: "booked_call",
        stage: "open",
        valueCents: PIPELINE.DEFAULT_DEAL_VALUE_CENTS,
        ghlContactId: contactId,
        bookedAt,
      });
    } catch (err) {
      // Unique (owner_id, ghl_contact_id) race with a concurrent sync — fine.
      console.error("Pipeline booked-call insert skipped:", err);
    }
  }

  await markSynced(ownerId);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = session.user.id;
  await ensurePipelineTable();

  // Both paths (board + Overview summary) sync booked calls, but at most
  // once per 15 minutes per owner — cheap loads, fresh-enough numbers.
  const summaryOnly = req.nextUrl.searchParams.get("summary") === "1";
  try {
    if (await shouldSync(ownerId)) {
      await syncBookedCalls(ownerId);
    }
  } catch (err) {
    console.error("Pipeline booked-call sync failed (continuing):", err);
  }

  const leads = await db
    .select()
    .from(pipelineLeads)
    .where(and(eq(pipelineLeads.ownerId, ownerId), isNull(pipelineLeads.deletedAt)))
    .orderBy(desc(pipelineLeads.createdAt));

  const kpis = {
    openCount: 0,
    openValueCents: 0,
    wonCount: 0,
    wonValueCents: 0,
    lostCount: 0,
  };
  for (const l of leads) {
    if (l.stage === "open") {
      kpis.openCount++;
      kpis.openValueCents += l.valueCents;
    } else if (l.stage === "won") {
      kpis.wonCount++;
      kpis.wonValueCents += l.valueCents;
    } else if (l.stage === "lost") {
      kpis.lostCount++;
    }
  }

  if (summaryOnly) return NextResponse.json({ kpis });

  // Location id lets the board build "view profile in GHL" links.
  const [owner] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  return NextResponse.json({
    leads,
    kpis,
    ghlLocationId: owner?.ghlLocationId ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensurePipelineTable();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = str(body.name, 200);
  if (!name) {
    return NextResponse.json({ error: "Lead name is required." }, { status: 400 });
  }
  let valueCents = PIPELINE.DEFAULT_DEAL_VALUE_CENTS;
  if (body.valueCents !== undefined) {
    const v = Number(body.valueCents);
    if (!Number.isInteger(v) || v < 0 || v > MAX_VALUE_CENTS) {
      return NextResponse.json(
        { error: "Deal value must be between $0 and $20,000,000." },
        { status: 400 }
      );
    }
    valueCents = v;
  }

  const fields = {
    name,
    email: str(body.email, 320) || null,
    phone: str(body.phone, 50) || null,
    company: str(body.company, 200) || null,
    notes: str(body.notes, 2000) || null,
    valueCents,
  };

  // Picked from existing GHL contacts — carries the contact id so the card
  // can deep-link to their profile. One pipeline entry per contact: an
  // active duplicate is rejected; a previously removed (soft-deleted) or
  // closed entry for the same contact is revived instead.
  const ghlContactId = str(body.ghlContactId, 100) || null;
  if (ghlContactId) {
    const [existing] = await db
      .select()
      .from(pipelineLeads)
      .where(
        and(
          eq(pipelineLeads.ownerId, session.user.id),
          eq(pipelineLeads.ghlContactId, ghlContactId)
        )
      )
      .limit(1);
    if (existing) {
      if (!existing.deletedAt && existing.stage === "open") {
        return NextResponse.json(
          { error: `${existing.name} is already in your pipeline.` },
          { status: 409 }
        );
      }
      const [lead] = await db
        .update(pipelineLeads)
        .set({
          ...fields,
          stage: "open",
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(pipelineLeads.id, existing.id))
        .returning();
      return NextResponse.json({ lead });
    }
  }

  const [lead] = await db
    .insert(pipelineLeads)
    .values({
      ownerId: session.user.id,
      ...fields,
      ghlContactId,
      source: "manual",
      stage: "open",
    })
    .returning();

  return NextResponse.json({ lead });
}
