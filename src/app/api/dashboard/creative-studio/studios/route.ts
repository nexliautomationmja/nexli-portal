import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { creativeAssets, creativePresenters, creativeProjects, creativeStudios } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { NEXLI_KEY, type StudioCard } from "@/lib/creative-studio/studios";
import { signPaths } from "@/lib/creative-studio/storage";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * The studio picker: Nexli's studio first, then every client firm's studio
 * (archived ones flagged), each with its video count, last activity and the
 * opening frames of its 3 newest videos.
 */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;

  const [studios, projects] = await Promise.all([
    db
      .select({ studio: creativeStudios, logoUrl: users.logoUrl, clientName: users.companyName, clientPerson: users.name })
      .from(creativeStudios)
      .leftJoin(users, eq(users.id, creativeStudios.clientUserId))
      .where(eq(creativeStudios.ownerId, access.ownerId))
      .orderBy(asc(creativeStudios.name)),
    db
      .select({ id: creativeProjects.id, studioId: creativeProjects.studioId, updatedAt: creativeProjects.updatedAt })
      .from(creativeProjects)
      .where(eq(creativeProjects.ownerId, access.ownerId))
      .orderBy(desc(creativeProjects.updatedAt)),
  ]);

  // Per studio: count, newest activity, the 3 newest videos (for thumbnails).
  const byStudio = new Map<string, { count: number; last: Date | null; recent: string[] }>();
  for (const p of projects) {
    const key = p.studioId ?? NEXLI_KEY;
    const s = byStudio.get(key) ?? { count: 0, last: null, recent: [] };
    s.count += 1;
    if (!s.last || p.updatedAt > s.last) s.last = p.updatedAt;
    if (s.recent.length < 3) s.recent.push(p.id);
    byStudio.set(key, s);
  }
  const recentIds = [...byStudio.values()].flatMap((s) => s.recent);
  const frames = recentIds.length
    ? await db
        .select({ projectId: creativeAssets.projectId, path: creativeAssets.storagePath, sort: creativeAssets.sort })
        .from(creativeAssets)
        .where(and(inArray(creativeAssets.projectId, recentIds), eq(creativeAssets.kind, "frame")))
    : [];
  const firstFrame = new Map<string, string>();
  for (const f of [...frames].sort((a, b) => a.sort - b.sort)) {
    if (f.projectId && f.path && !firstFrame.has(f.projectId)) firstFrame.set(f.projectId, f.path);
  }
  // Each firm's AI avatar: its default presenter, else any avatar assigned to it.
  const avatars = await db
    .select({ id: creativePresenters.id, name: creativePresenters.name, studioId: creativePresenters.studioId, mainPhotoId: creativePresenters.mainPhotoId })
    .from(creativePresenters)
    .where(and(eq(creativePresenters.ownerId, access.ownerId), eq(creativePresenters.avatar, true), isNotNull(creativePresenters.studioId), isNull(creativePresenters.archivedAt)))
    .orderBy(asc(creativePresenters.assignedAt));
  const mainIds = avatars.map((a) => a.mainPhotoId).filter((id): id is string => Boolean(id));
  const mains = mainIds.length
    ? await db.select({ id: creativeAssets.id, path: creativeAssets.storagePath }).from(creativeAssets).where(and(eq(creativeAssets.ownerId, access.ownerId), inArray(creativeAssets.id, mainIds)))
    : [];
  const mainPath = new Map(mains.map((m) => [m.id, m.path]));
  const signed = await signPaths([...firstFrame.values(), ...mains.map((m) => m.path)], 6 * 3600);
  const avatarOf = (studioId: string, defaultId: string | null) => {
    const a = avatars.find((x) => x.studioId === studioId && x.id === defaultId) ?? avatars.find((x) => x.studioId === studioId);
    if (!a) return null;
    const path = a.mainPhotoId ? mainPath.get(a.mainPhotoId) : null;
    return { id: a.id, name: a.name, thumbUrl: path ? signed.get(path) ?? null : null };
  };
  const thumbsOf = (key: string) =>
    (byStudio.get(key)?.recent ?? [])
      .map((id) => firstFrame.get(id))
      .map((path) => (path ? signed.get(path) : undefined))
      .filter((u): u is string => Boolean(u));
  const stats = (key: string, createdAt?: Date) => {
    const s = byStudio.get(key);
    return { videos: s?.count ?? 0, lastActivity: (s?.last ?? createdAt ?? null)?.toISOString() ?? null, thumbs: thumbsOf(key) };
  };

  const cards: StudioCard[] = [
    {
      key: NEXLI_KEY,
      kind: "nexli",
      name: "Nexli",
      about: null,
      website: null,
      logoUrl: null,
      clientUserId: null,
      clientName: null,
      archived: false,
      ...stats(NEXLI_KEY),
      avatar: null,
    },
    ...studios.map(({ studio, logoUrl, clientName, clientPerson }) => ({
      key: studio.id,
      kind: "client" as const,
      name: studio.name,
      about: studio.about,
      website: studio.website,
      logoUrl: logoUrl ?? null,
      clientUserId: studio.clientUserId,
      clientName: clientName ?? clientPerson ?? null,
      archived: Boolean(studio.archivedAt),
      ...stats(studio.id, studio.createdAt),
      avatar: avatarOf(studio.id, studio.defaultPresenterId),
    })),
  ];
  return NextResponse.json({ studios: cards });
}

/**
 * New client studio. POST { name, about?, website?, clientUserId? } — pick a
 * portal client firm (its company name is the default name) or just type one.
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  let clientUserId: string | null = null;
  let fallbackName = "";
  let fallbackWebsite = "";
  const pickedClient = clip(body?.clientUserId, 40);
  if (pickedClient) {
    if (!/^[0-9a-f-]{36}$/i.test(pickedClient)) return NextResponse.json({ error: "That client wasn't found" }, { status: 400 });
    const [client] = await db
      .select({ id: users.id, companyName: users.companyName, name: users.name, websiteUrl: users.websiteUrl })
      .from(users)
      .where(and(eq(users.id, pickedClient), eq(users.role, "client")))
      .limit(1);
    if (!client) return NextResponse.json({ error: "That client wasn't found" }, { status: 400 });
    clientUserId = client.id;
    fallbackName = client.companyName || client.name || "";
    fallbackWebsite = client.websiteUrl ?? "";
  }
  const name = clip(body?.name, 120) || fallbackName;
  if (!name) return NextResponse.json({ error: "Give the studio the firm's name" }, { status: 400 });

  const [created] = await db
    .insert(creativeStudios)
    .values({
      ownerId: access.ownerId,
      name,
      about: clip(body?.about, 4000) || null,
      website: clip(body?.website, 300) || fallbackWebsite || null,
      clientUserId,
      createdBy: access.actorId,
    })
    .returning({ id: creativeStudios.id });
  return NextResponse.json({ ok: true, key: created.id });
}
