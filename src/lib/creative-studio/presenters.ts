import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativePresenters, type PresenterInfo, type Pronoun } from "@/lib/creative-studio/tables";
import { inStudio, type Studio } from "@/lib/creative-studio/studios";
import { signPaths } from "@/lib/creative-studio/storage";

type PresenterRow = typeof creativePresenters.$inferSelect;

/**
 * Presenters other than the studio's default (Daniela in Nexli's studio):
 * each has a name, a pronoun and a look, plus their own reference photos (creative_assets kind "reference" with
 * presenter_id). Videos keep a snapshot (creative_projects.presenter).
 * They have no set voice: Kling picks it from the person in the frame (the
 * old `voice` column is no longer used).
 */


/** The snapshot a video keeps (no voice line: Kling picks the voice from the frame). */
export function presenterInfo(row: Pick<PresenterRow, "id" | "name" | "pronoun" | "look">): PresenterInfo {
  const pronoun: Pronoun = row.pronoun === "he" ? "he" : "she";
  return { id: row.id, name: row.name.trim(), pronoun, voice: "", look: row.look.trim() };
}

export async function loadPresenter(ownerId: string, id: string): Promise<PresenterRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(creativePresenters)
    .where(and(eq(creativePresenters.id, id), eq(creativePresenters.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** The presenter's reference photos (null = the studio's default presenter's). */
export function referencesWhere(ownerId: string, studio: Studio, presenterId: string | null) {
  return and(
    eq(creativeAssets.ownerId, ownerId),
    eq(creativeAssets.kind, "reference"),
    isNull(creativeAssets.projectId),
    inStudio(creativeAssets.studioId, studio),
    presenterId ? eq(creativeAssets.presenterId, presenterId) : isNull(creativeAssets.presenterId)
  );
}

/** The studio's presenters (not archived) with their photo count and a thumbnail. */
export async function listPresenters(ownerId: string, studio: Studio) {
  const rows = await db
    .select()
    .from(creativePresenters)
    .where(and(eq(creativePresenters.ownerId, ownerId), inStudio(creativePresenters.studioId, studio), isNull(creativePresenters.archivedAt)))
    .orderBy(asc(creativePresenters.createdAt));
  const ids = rows.map((r) => r.id);
  const photos = ids.length
    ? await db
        .select({ presenterId: creativeAssets.presenterId, path: creativeAssets.storagePath, n: sql<number>`count(*) over (partition by ${creativeAssets.presenterId})::int` })
        .from(creativeAssets)
        .where(and(eq(creativeAssets.kind, "reference"), isNull(creativeAssets.projectId), inArray(creativeAssets.presenterId, ids)))
        .orderBy(asc(creativeAssets.createdAt))
    : [];
  const first = new Map<string, { path: string | null; n: number }>();
  for (const p of photos) if (p.presenterId && !first.has(p.presenterId)) first.set(p.presenterId, { path: p.path, n: p.n });
  const signed = await signPaths([...first.values()].map((f) => f.path), 6 * 3600);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    pronoun: (r.pronoun === "he" ? "he" : "she") as Pronoun,
    voice: r.voice,
    look: r.look,
    photos: first.get(r.id)?.n ?? 0,
    thumbUrl: first.get(r.id)?.path ? signed.get(first.get(r.id)!.path!) ?? null : null,
  }));
}

export type PresenterCard = Awaited<ReturnType<typeof listPresenters>>[number];

/** A presenter's editable fields from a request body (trimmed, capped). */
export function cleanPresenter(input: unknown): { name: string; pronoun: Pronoun; voice: string; look: string } {
  const b = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    name: s(b.name, 60),
    pronoun: b.pronoun === "he" ? "he" : "she",
    voice: s(b.voice, 600),
    look: s(b.look, 1500),
  };
}

/**
 * The snapshot for a video in studio `studioId`: null for the studio's
 * default presenter, undefined when the id isn't one of that studio's
 * (active) presenters.
 */
export async function presenterForStudio(ownerId: string, studioId: string | null, id: unknown): Promise<PresenterInfo | null | undefined> {
  if (id === null || id === "" || id === undefined) return null;
  if (typeof id !== "string") return undefined;
  const row = await loadPresenter(ownerId, id);
  if (!row || row.archivedAt || (row.studioId ?? null) !== (studioId ?? null)) return undefined;
  return presenterInfo(row);
}
