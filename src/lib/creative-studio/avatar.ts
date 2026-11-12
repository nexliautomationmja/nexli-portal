import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativePresenters, creativeProjects, creativeStudios, type AvatarRead, type Pronoun } from "@/lib/creative-studio/tables";
import { signPaths } from "@/lib/creative-studio/storage";
import { KLING_EXTRA_PHOTOS, SAMPLE_MAX, type AvatarView, type KlingStatus } from "@/lib/creative-studio/avatar-shared";

/**
 * AI avatars (Nov 2026). Marcel drops a zip of photos of a person he wants as
 * a presenter; Claude reads them (who they look like, what firm they suit,
 * how they should sound, which photos to use), ElevenLabs designs the voice,
 * he locks it in, and assigns it to ONE client firm's studio. Each firm gets
 * its own face and voice, so their ads never look like anyone else's.
 *
 * An avatar is a creative_presenters row with avatar = true; its photos are
 * creative_assets kind "reference" with presenter_id = the avatar. Until it's
 * assigned, studio_id is null and it's only in the library (never offered in
 * Nexli's own videos); assigning moves the row and its photos to the firm's
 * studio, so every existing studio check keeps it theirs.
 */

const MODEL = "claude-opus-5-5";

export type AvatarRow = typeof creativePresenters.$inferSelect;

/** A live (not archived) avatar of this workspace. */
export async function loadAvatar(ownerId: string, id: string): Promise<AvatarRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(creativePresenters)
    .where(and(eq(creativePresenters.id, id), eq(creativePresenters.ownerId, ownerId), eq(creativePresenters.avatar, true), isNull(creativePresenters.archivedAt)))
    .limit(1);
  return row ?? null;
}

/** The avatar's photos, oldest first (they move with it when it's assigned, so no studio filter). */
export async function avatarPhotos(ownerId: string, avatarId: string) {
  return db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.ownerId, ownerId), eq(creativeAssets.kind, "reference"), isNull(creativeAssets.projectId), eq(creativeAssets.presenterId, avatarId)))
    .orderBy(asc(creativeAssets.createdAt));
}

/** How many videos use this avatar (its snapshot on creative_projects.presenter). */
async function videoCounts(ownerId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const idExpr = sql<string>`${creativeProjects.presenter}->>'id'`;
  const rows = await db
    .select({ id: idExpr, n: sql<number>`count(*)::int` })
    .from(creativeProjects)
    .where(and(eq(creativeProjects.ownerId, ownerId), inArray(idExpr, ids)))
    .groupBy(idExpr);
  return new Map(rows.map((r) => [r.id, r.n]));
}

export async function avatarVideoCount(ownerId: string, id: string): Promise<number> {
  return (await videoCounts(ownerId, [id])).get(id) ?? 0;
}

function klingStatus(row: AvatarRow, photoIds: Set<string>): KlingStatus {
  if (!row.lockedAt) return "not_locked";
  if (row.klingElementId) return "ready";
  if (row.klingElementError) return "error";
  const extra = (row.klingPhotoIds ?? []).filter((id) => photoIds.has(id) && id !== row.mainPhotoId);
  if (!row.mainPhotoId || !photoIds.has(row.mainPhotoId) || extra.length === 0) return "needs_photo";
  return "pending";
}

/** Every avatar in the workspace (library + assigned), newest first, as the Avatars tab shows them. */
export async function listAvatars(ownerId: string): Promise<AvatarView[]> {
  const rows = await db
    .select()
    .from(creativePresenters)
    .where(and(eq(creativePresenters.ownerId, ownerId), eq(creativePresenters.avatar, true), isNull(creativePresenters.archivedAt)))
    .orderBy(desc(creativePresenters.createdAt));
  return avatarViews(ownerId, rows);
}

export async function avatarViews(ownerId: string, rows: AvatarRow[]): Promise<AvatarView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const studioIds = [...new Set(rows.map((r) => r.studioId).filter((s): s is string => Boolean(s)))];
  const [photos, studios, counts] = await Promise.all([
    db
      .select()
      .from(creativeAssets)
      .where(and(eq(creativeAssets.ownerId, ownerId), eq(creativeAssets.kind, "reference"), isNull(creativeAssets.projectId), inArray(creativeAssets.presenterId, ids)))
      .orderBy(asc(creativeAssets.createdAt)),
    studioIds.length
      ? db.select({ id: creativeStudios.id, name: creativeStudios.name }).from(creativeStudios).where(and(eq(creativeStudios.ownerId, ownerId), inArray(creativeStudios.id, studioIds)))
      : Promise.resolve([] as { id: string; name: string }[]),
    videoCounts(ownerId, ids),
  ]);
  const studioName = new Map(studios.map((s) => [s.id, s.name]));
  const paths = [
    ...photos.map((p) => p.storagePath),
    ...rows.map((r) => r.voicePath),
    ...rows.flatMap((r) => (r.lockedAt ? [] : r.voiceOptions?.options.map((o) => o.path) ?? [])),
    ...rows.map((r) => r.testClip?.path),
  ].filter((p): p is string => Boolean(p));
  const signed = await signPaths(paths, 6 * 3600);
  const url = (p: string | null | undefined) => (p ? signed.get(p) ?? null : null);

  return rows.map((r) => {
    const own = photos.filter((p) => p.presenterId === r.id);
    const photoIds = new Set(own.map((p) => p.id));
    const read = r.avatarRead;
    return {
      id: r.id,
      name: r.name,
      pronoun: (r.pronoun === "he" ? "he" : "she") as Pronoun,
      look: r.look,
      bestFor: r.bestFor ?? "",
      note: r.note ?? "",
      voice: r.voice,
      voiceSample: r.voiceSample ?? "",
      voiceUrl: url(r.voicePath),
      photos: own.map((p) => ({ id: p.id, url: url(p.storagePath), width: p.width, height: p.height })),
      mainPhotoId: r.mainPhotoId && photoIds.has(r.mainPhotoId) ? r.mainPhotoId : own[0]?.id ?? null,
      klingPhotoIds: (r.klingPhotoIds ?? []).filter((id) => photoIds.has(id)),
      read: read ? { age: read.age, names: read.names, otherPerson: read.otherPerson.filter((id) => photoIds.has(id)), notes: read.notes } : null,
      options:
        !r.lockedAt && r.voiceOptions
          ? {
              description: r.voiceOptions.description,
              sample: r.voiceOptions.sample,
              voices: r.voiceOptions.options.map((o) => ({ generatedVoiceId: o.generatedVoiceId, url: url(o.path), durationS: o.durationS })),
            }
          : null,
      locked: Boolean(r.lockedAt),
      voiceKept: Boolean(r.voiceId),
      kling: { status: klingStatus(r, photoIds), error: r.klingElementError },
      assigned: r.studioId ? { studioKey: r.studioId, studioName: studioName.get(r.studioId) ?? "A client firm", at: (r.assignedAt ?? r.updatedAt).toISOString() } : null,
      videos: counts.get(r.id) ?? 0,
      test: r.testClip ? { status: r.testClip.status, url: url(r.testClip.path), error: r.testClip.error, line: r.testClip.line } : null,
      photoTask: r.photoTask ? { status: r.photoTask.status, taskUrl: r.photoTask.taskUrl, waiting: r.photoTask.waiting, error: r.photoTask.error } : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function avatarView(ownerId: string, row: AvatarRow): Promise<AvatarView> {
  return (await avatarViews(ownerId, [row]))[0];
}

// ---------------------------------------------------------------------------
// Claude reads the photos

const RULES = `You set up AI presenters ("avatars") for Nexli, an agency that makes Facebook and Instagram video and photo ads for professional-services firms: CPA and accounting firms, tax strategists, financial advisors and wealth managers, attorneys. Each avatar becomes the exclusive on-camera presenter for ONE firm. Kling makes the videos from these photos, and the avatar's voice is designed from your description, so what you write is what the firm's clients will see and hear.

You get numbered photos that should all show the same AI-generated person. Look at all of them and return:

- pronoun — "she" or "he".
- age — their apparent age range, e.g. "late 30s".
- look — 1–3 sentences on how they look, for an image model: face, hair, skin tone, build, the clothes they usually wear here, anything distinctive. No name, no guesses about who they "are".
- bestFor — one sentence: the kind of firm and clients this presenter suits best, and why (e.g. "Wealth managers serving retirees and pre-retirees: reads seasoned, calm and trustworthy").
- names — 3 first names that suit them: common, easy to say and spell, not a famous person. If the user already gave a name, return it as the first.
- voice — a description of their voice for a voice designer, 1–3 sentences, at most 400 characters: gender, age, accent, pitch, tone and texture, pace, energy. It must fit the face you see and the job: a trusted professional talking to business owners — warm, confident, clear, conversational. No announcer, radio, hype, sales or cartoon voices. American English unless the photos or the user's note say otherwise. Make it clearly different from the voices of the avatars already in the library (listed below, if any): a firm's audience must never hear the same voice twice.
- sample — what they say in their voice sample, 240–420 characters, first person, natural spoken English: they introduce themselves by name and talk to a firm owner the way the start of a good ad would. Open with one complete sentence of 8–12 words that works on its own (it's also their 5-second test clip), e.g. "Hi, I'm Marcus, and I help firm owners keep more of what they earn." Spell numbers as words. No prices, guarantees, promised results, firm names, or the word Nexli.
- main — the number of the best main photo: face clearly visible and facing the camera, sharp and well lit, ideally head-and-shoulders or waist-up, no text on it.
- kling — up to ${KLING_EXTRA_PHOTOS} other photo numbers that add the most: different angles, framing or outfits of the same person, sharp, no text. Never the main photo, never a photo of someone else.
- otherPerson — the numbers of any photos that show a different person, no person, or several people. Empty when they're all the same person.
- notes — one or two plain sentences on anything off (blurry photos, a face that changes between photos, text or logos on a photo), or "" when it's all fine.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pronoun", "age", "look", "bestFor", "names", "voice", "sample", "main", "kling", "otherPerson", "notes"],
  properties: {
    pronoun: { type: "string", enum: ["she", "he"] },
    age: { type: "string" },
    look: { type: "string" },
    bestFor: { type: "string" },
    names: { type: "array", items: { type: "string" } },
    voice: { type: "string" },
    sample: { type: "string" },
    main: { type: "integer" },
    kling: { type: "array", items: { type: "integer" } },
    otherPerson: { type: "array", items: { type: "integer" } },
    notes: { type: "string" },
  },
} as const;

export interface AvatarReadResult {
  pronoun: Pronoun;
  look: string;
  bestFor: string;
  voice: string;
  sample: string;
  mainPhotoId: string | null;
  klingPhotoIds: string[];
  read: AvatarRead;
}

interface RawRead {
  pronoun?: unknown;
  age?: unknown;
  look?: unknown;
  bestFor?: unknown;
  names?: unknown;
  voice?: unknown;
  sample?: unknown;
  main?: unknown;
  kling?: unknown;
  otherPerson?: unknown;
  notes?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Claude's numbered picks → photo ids (main never flagged; Kling picks never the main or someone else). */
export function mapRead(raw: RawRead, photoIds: string[], at = new Date().toISOString()): AvatarReadResult {
  const byNumber = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= photoIds.length ? photoIds[n - 1] : null);
  const list = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(byNumber).filter((id): id is string => Boolean(id)))];
  const other = list(raw.otherPerson).filter((id) => photoIds.length > 1 || id !== photoIds[0]);
  const usable = photoIds.filter((id) => !other.includes(id));
  const picked = byNumber(raw.main);
  const main = picked && !other.includes(picked) ? picked : usable[0] ?? null;
  const kling = list(raw.kling)
    .filter((id) => id !== main && !other.includes(id))
    .slice(0, KLING_EXTRA_PHOTOS);
  // Kling needs at least one more angle: take the next usable photo if Claude picked none.
  if (kling.length === 0) {
    const next = usable.find((id) => id !== main);
    if (next) kling.push(next);
  }
  const names = (Array.isArray(raw.names) ? raw.names : []).map((n) => str(n, 40)).filter(Boolean).slice(0, 3);
  return {
    pronoun: raw.pronoun === "he" ? "he" : "she",
    look: str(raw.look, 1500),
    bestFor: str(raw.bestFor, 400),
    voice: str(raw.voice, 1000),
    sample: str(raw.sample, SAMPLE_MAX),
    mainPhotoId: main,
    klingPhotoIds: kling,
    read: { age: str(raw.age, 60), names, otherPerson: other, notes: str(raw.notes, 600), at },
  };
}

/** The other avatars, so a new one's voice (and look) stays clearly different. */
export async function libraryVoices(ownerId: string, exceptId: string): Promise<{ name: string; voice: string; look: string }[]> {
  const rows = await db
    .select({ id: creativePresenters.id, name: creativePresenters.name, voice: creativePresenters.voice, look: creativePresenters.look })
    .from(creativePresenters)
    .where(and(eq(creativePresenters.ownerId, ownerId), eq(creativePresenters.avatar, true), isNull(creativePresenters.archivedAt)))
    .orderBy(desc(creativePresenters.createdAt))
    .limit(40);
  return rows.filter((r) => r.id !== exceptId && r.voice.trim()).map((r) => ({ name: r.name, voice: r.voice.trim(), look: r.look.trim() }));
}

/** The user message: the library's voices, the numbered photos, then the ask. */
export function readContent(args: {
  photoUrls: string[];
  name: string;
  note: string;
  others: { name: string; voice: string; look: string }[];
}): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (args.others.length) {
    blocks.push({
      type: "text",
      text: `Avatars already in the library — make this one's voice clearly different from every one of these:\n${args.others
        .map((o) => `- ${o.name}: ${o.voice}${o.look ? ` (looks: ${o.look.slice(0, 200)})` : ""}`)
        .join("\n")}`,
    });
  }
  args.photoUrls.forEach((url, i) => {
    blocks.push({ type: "text", text: `Photo ${i + 1}:` });
    blocks.push({ type: "image", source: { type: "url", url } });
  });
  const name = args.name.trim();
  const note = args.note.trim();
  blocks.push({
    type: "text",
    text: [
      `Set up this avatar from the ${args.photoUrls.length} photo${args.photoUrls.length === 1 ? "" : "s"} above.`,
      name ? `The user named them ${name}: use that name in the sample and as the first name.` : "The user hasn't named them yet: suggest 3 names and use the first in the sample.",
      note ? `The user's note about them: ${note}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return blocks;
}

export async function readAvatar(args: {
  photos: { id: string; url: string }[];
  name: string;
  note: string;
  others: { name: string; voice: string; look: string }[];
}): Promise<AvatarReadResult> {
  if (!args.photos.length) throw new Error("Add the avatar's photos first.");
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: RULES,
    messages: [{ role: "user", content: readContent({ photoUrls: args.photos.map((p) => p.url), name: args.name, note: args.note, others: args.others }) }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];
  const message = await client.beta.messages.stream(params).finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to read these photos. Try different ones.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let raw: RawRead;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Claude's read came back unreadable. Try again.");
  }
  const result = mapRead(raw, args.photos.map((p) => p.id));
  if (!result.voice || !result.sample) throw new Error("Claude didn't describe a voice. Try again.");
  return result;
}
