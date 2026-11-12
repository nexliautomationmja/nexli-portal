import { and, eq, isNull, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { creativePresenters, creativeStudios } from "@/lib/creative-studio/tables";

/**
 * Studios: Nexli's own Creative Studio plus one per client firm. Nexli's is
 * implicit — studio_id is null on everything it owns (so all work made
 * before studios existed stays Nexli's, untouched). A client studio is a
 * creative_studios row; every admin in the workspace can open every studio.
 *
 * Lists and creates carry the studio as `?studio=<key>` (key "nexli" or the
 * studio's uuid). Anything below a project, batch or ad-copy job already
 * knows its studio from its own row.
 */

export const NEXLI_KEY = "nexli";

export interface Studio {
  /** null = Nexli's own studio. */
  id: string | null;
  /** "nexli" or the studio's uuid — what goes in URLs and ?studio=. */
  key: string;
  kind: "nexli" | "client";
  name: string;
  about: string | null;
  website: string | null;
  logoUrl: string | null;
  clientUserId: string | null;
  archived: boolean;
  /** The firm's AI avatar (creative_presenters id): new videos, batches and Photo Ads use it. Null for Nexli. */
  defaultPresenterId: string | null;
}

/** Just what the browser needs to show where you are and link back. */
export type StudioRef = Pick<Studio, "key" | "kind" | "name">;

export const NEXLI_STUDIO: Studio = {
  id: null,
  key: NEXLI_KEY,
  kind: "nexli",
  name: "Nexli",
  about: null,
  website: null,
  logoUrl: null,
  clientUserId: null,
  archived: false,
  defaultPresenterId: null,
};

export const studioRef = (s: Studio): StudioRef => ({ key: s.key, kind: s.kind, name: s.name });

/** The firm's AI avatar (its default presenter), if it still has it. */
export async function studioAvatar(ownerId: string, studio: Studio): Promise<{ id: string; name: string } | null> {
  if (!studio.id || !studio.defaultPresenterId) return null;
  const [row] = await db
    .select({ id: creativePresenters.id, name: creativePresenters.name })
    .from(creativePresenters)
    .where(
      and(
        eq(creativePresenters.id, studio.defaultPresenterId),
        eq(creativePresenters.ownerId, ownerId),
        eq(creativePresenters.studioId, studio.id),
        eq(creativePresenters.avatar, true),
        isNull(creativePresenters.archivedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StudioRow = typeof creativeStudios.$inferSelect;

function fromRow(row: StudioRow, logoUrl: string | null): Studio {
  return {
    id: row.id,
    key: row.id,
    kind: "client",
    name: row.name,
    about: row.about,
    website: row.website,
    logoUrl,
    clientUserId: row.clientUserId,
    archived: Boolean(row.archivedAt),
    defaultPresenterId: row.defaultPresenterId ?? null,
  };
}

async function loadStudio(ownerId: string, id: string): Promise<Studio | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select({ studio: creativeStudios, logoUrl: users.logoUrl })
    .from(creativeStudios)
    .leftJoin(users, eq(users.id, creativeStudios.clientUserId))
    .where(and(eq(creativeStudios.id, id), eq(creativeStudios.ownerId, ownerId)))
    .limit(1);
  return row ? fromRow(row.studio, row.logoUrl ?? null) : null;
}

/** The studio a key names, in this workspace. Missing/"nexli" = Nexli; unknown = null. */
export async function resolveStudio(ownerId: string, key: string | null | undefined): Promise<Studio | null> {
  if (!key || key === NEXLI_KEY) return NEXLI_STUDIO;
  return loadStudio(ownerId, key);
}

/** The studio a project, batch or workspace asset belongs to (its studio_id). */
export async function studioById(ownerId: string, studioId: string | null | undefined): Promise<Studio> {
  if (!studioId) return NEXLI_STUDIO;
  // A row pointing at a studio that's gone (shouldn't happen) still never borrows Nexli's voice.
  return (await loadStudio(ownerId, studioId)) ?? { ...NEXLI_STUDIO, id: studioId, key: studioId, kind: "client", name: "Client studio" };
}

/** `?studio=` on a request (default Nexli, so tabs opened before studios existed keep working). */
export function studioKeyFrom(req: Request): string {
  return new URL(req.url).searchParams.get("studio")?.trim() || NEXLI_KEY;
}

/** WHERE clause for "rows in this studio". */
export function inStudio(column: AnyColumn, studio: Studio): SQL {
  return sameStudio(column, studio.id);
}

/** WHERE clause for "rows in the studio with this id" (null = Nexli's). */
export function sameStudio(column: AnyColumn, studioId: string | null | undefined): SQL {
  return studioId ? eq(column, studioId) : isNull(column);
}

/**
 * Appended to every writer's system prompt in a client studio (scripts,
 * batch plans, ad copy, edit layouts and text). Empty for Nexli, so Nexli's
 * prompts stay exactly as they were.
 */
export function firmBrief(studio: Studio): string {
  if (studio.kind === "nexli") return "";
  const about = studio.about?.trim();
  return `

# This one is for a client firm — not for Nexli
You are making this for ${studio.name}${studio.website ? ` (${studio.website})` : ""}, one of Nexli's client firms. Nexli makes the firm's ads; the ad sells the firm.

About the firm (from the Nexli team):
${about || "(Not filled in yet. Keep every claim general to what the user says — don't invent services, results, prices, locations or guarantees.)"}

What changes from the rules above (they were written for Nexli's own ads):
- Sell ${studio.name}, never Nexli. Never mention Nexli, the Digital Rainmaker System, or any of Nexli's offer facts, prices, investment amounts, setup fee, launch timeline or guarantees — the "Current Nexli offer facts" do not apply here.
- Use only facts from "About the firm" above or from the user's own words. No invented numbers, results, client counts, prices or guarantees.
- The call to action is the firm's (from "About the firm" or the user), not Nexli's.
- Don't name the presenter unless the user does; it's whoever is in the frame.
- Everything else still applies: hooks, structure, pacing, the spoken-word and compliance rules, and the output format.`;
}

/** The firm's name in place of "Nexli" for short prompts that name the brand. */
export const brandName = (studio: Studio) => (studio.kind === "nexli" ? "Nexli" : studio.name);

/** The studio named by the request's `?studio=` (null when it isn't one of this workspace's). */
export function studioFromRequest(ownerId: string, req: Request): Promise<Studio | null> {
  return resolveStudio(ownerId, studioKeyFrom(req));
}

export const studioNotFound = () => Response.json({ error: "That studio wasn't found. Go back to Creative Studio and pick one." }, { status: 404 });

/** For writers that name the brand: the firm's name + brief in a client studio, nothing for Nexli. */
export const namedFirm = (s: Studio): { name: string; brief: string } | undefined =>
  s.kind === "client" ? { name: s.name, brief: firmBrief(s) } : undefined;

/** What studio pages hand to the browser components. */
export interface StudioView {
  key: string;
  kind: "nexli" | "client";
  name: string;
  /** A client studio's "About this firm" is filled in (the writers sell the firm from it). */
  hasAbout: boolean;
  archived: boolean;
  /** The firm's AI avatar, picked by default for new videos (absent = the studio's default presenter). */
  avatar?: { id: string; name: string } | null;
}

/** A studio on the picker ("What creative studio are we going for?"). */
export interface StudioCard {
  key: string;
  kind: "nexli" | "client";
  name: string;
  about: string | null;
  website: string | null;
  logoUrl: string | null;
  clientUserId: string | null;
  /** The linked portal client's company (or person) name. */
  clientName: string | null;
  archived: boolean;
  videos: number;
  lastActivity: string | null;
  /** Opening frames of its 3 newest videos (signed URLs). */
  thumbs: string[];
  /** The firm's AI avatar (its default presenter), when it has one. */
  avatar: { id: string; name: string; thumbUrl: string | null } | null;
}
