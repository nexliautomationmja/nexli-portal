import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, pipelineLeads, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc, isNotNull, isNull } from "drizzle-orm";
import {
  getContacts,
  getContactById,
  getAllCalendarEvents,
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
  const [contactsRes, events] = await Promise.all([
    getContacts(locationId, 100),
    getAllCalendarEvents(locationId, start.toISOString(), end.toISOString()),
  ]);

  const booked = events.filter((e) => e.contactId && e.status !== "cancelled");
  if (booked.length === 0) {
    await markSynced(ownerId);
    return;
  }

  // Earliest parseable event time per contact (null when GHL sends a format
  // we can't parse — better no date than a wrong one).
  const earliestByContact = new Map<string, Date | null>();
  for (const e of booked) {
    const t = new Date(e.startTime);
    const valid = !isNaN(t.getTime());
    const prev = earliestByContact.get(e.contactId);
    if (prev === undefined) {
      earliestByContact.set(e.contactId, valid ? t : null);
    } else if (valid && (prev === null || t.getTime() < prev.getTime())) {
      earliestByContact.set(e.contactId, t);
    }
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

  const contactById = new Map(contactsRes.contacts?.map((c) => [c.id, c]) ?? []);

  // Contacts outside the fetched page get an individual lookup (bounded).
  let individualLookups = 0;
  for (const [contactId, bookedAt] of earliestByContact) {
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
  return NextResponse.json({ leads, kpis });
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

  const [lead] = await db
    .insert(pipelineLeads)
    .values({
      ownerId: session.user.id,
      name,
      email: str(body.email, 320) || null,
      phone: str(body.phone, 50) || null,
      company: str(body.company, 200) || null,
      notes: str(body.notes, 2000) || null,
      source: "manual",
      stage: "open",
      valueCents,
    })
    .returning();

  return NextResponse.json({ lead });
}
