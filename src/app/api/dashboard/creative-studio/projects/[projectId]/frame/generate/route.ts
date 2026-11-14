import { NextRequest, NextResponse } from "next/server";
import { and, asc, inArray } from "drizzle-orm";
import { studioById } from "@/lib/creative-studio/studios";
import { db } from "@/db";
import { creativeAssets, type SourceMeta } from "@/lib/creative-studio/tables";
import { mediaOf } from "@/lib/creative-studio/source";
import { loadPresenter, referencesWhere } from "@/lib/creative-studio/presenters";
import { rankAvatarPhotos } from "@/lib/creative-studio/avatar-shared";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, scenesOf } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { ManusError, startFrameTask, startStoryboardTask } from "@/lib/creative-studio/manus";
import { presenterOf } from "@/lib/creative-studio/prompts";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Ask Manus for frames from the video's presenter's reference photos:
 * • { shot, count?, scene? } — options from a one-line shot description: 2 to
 *   choose from, or 1 when a batch makes frames for many videos at once. With
 *   `scene` the options are for that scene.
 * • { storyboard: true } — every scene still waiting for a frame, made
 *   together in one task (same person, same look), each landing in its scene.
 * • { recreate, shot? } — recreate a photo you uploaded (frames "sign" with
 *   purpose "recreate"); `shot` is what to change (a new suit colour, outfit,
 *   background…). Works without reference photos too (the photo's own person).
 * • { referenceStill: n, shot? } — the same, from still n of the video being
 *   recreated (its look, with this video's presenter).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as {
    shot?: string;
    referenceIds?: string[];
    count?: number;
    scene?: string;
    storyboard?: boolean;
    recreate?: string;
    referenceStill?: number;
  } | null;
  const storyboard = body?.storyboard === true;
  const shot = typeof body?.shot === "string" ? body.shot.trim().slice(0, 1500) : "";
  // Only a photo uploaded to this video's own recreate folder.
  let recreatePath = !storyboard && typeof body?.recreate === "string" && body.recreate.startsWith(`${project.id}/recreate/`) && !body.recreate.includes("..") ? body.recreate : null;
  // A still of the video being recreated (its opening look by default).
  if (!storyboard && !recreatePath && typeof body?.referenceStill === "number" && project.media?.mode === "recreate") {
    const ref = await mediaOf(project, project.media.ids[0] ?? "");
    const stills = ((ref?.metadata ?? {}) as SourceMeta).stills ?? [];
    recreatePath = stills[Math.max(0, Math.min(stills.length - 1, Math.round(body.referenceStill)))]?.path ?? null;
    if (!recreatePath) return NextResponse.json({ error: "The video to recreate isn't read yet. Try again in a moment." }, { status: 409 });
  }
  const scenes = scenesOf(project, await framesOf(project.id));
  const waiting = scenes.filter((sc) => !sc.frameId && sc.shot.trim());
  if (storyboard && waiting.length === 0) return NextResponse.json({ error: "Every scene already has a frame." }, { status: 400 });
  if (!storyboard && !shot && !recreatePath) return NextResponse.json({ error: "Describe the shot you want" }, { status: 400 });
  const sceneId = typeof body?.scene === "string" && scenes.some((sc) => sc.id === body.scene) ? body.scene : null;

  // Only this video's presenter's photos, from its studio (Daniela's in Nexli's by default; a client studio has its own).
  const studio = await studioById(access.ownerId, project.studioId);
  const presenter = project.presenter ?? null;
  const refsQuery = referencesWhere(access.ownerId, studio, presenter?.id || null);
  const ids = Array.isArray(body?.referenceIds) ? body.referenceIds.filter((x) => typeof x === "string") : [];
  const where = ids.length ? and(refsQuery, inArray(creativeAssets.id, ids)) : refsQuery;
  // An AI avatar has many photos: Manus gets its 6 best (main + Kling angles first, none of someone else).
  const avatar = presenter?.avatar && presenter.id ? await loadPresenter(access.ownerId, presenter.id) : null;
  const refs = avatar?.avatar
    ? rankAvatarPhotos(await db.select().from(creativeAssets).where(where).orderBy(asc(creativeAssets.createdAt)), avatar).slice(0, 6)
    : await db.select().from(creativeAssets).where(where).limit(6);
  if (presenter && refs.length === 0 && !presenter.look && !recreatePath) {
    return NextResponse.json(
      { error: `Manus doesn't know what ${presenter.name} looks like yet. Add photos of ${presenter.name}, or describe how they look, then try again.` },
      { status: 400 }
    );
  }
  if (!presenter && studio.kind === "client" && refs.length === 0 && !recreatePath) {
    return NextResponse.json(
      {
        error: `${studio.name}'s studio has no reference pictures yet, so Manus doesn't know who presents. Paste or upload a frame instead, or add reference pictures first.`,
      },
      { status: 400 }
    );
  }
  const signed = await signPaths([...refs.map((r) => r.storagePath), recreatePath], 2 * 3600);
  const recreateUrl = recreatePath ? signed.get(recreatePath) : undefined;
  if (recreatePath && !recreateUrl) return NextResponse.json({ error: "Couldn't find the photo to recreate. Attach it again." }, { status: 400 });
  const referenceUrls = refs.map((r) => (r.storagePath ? signed.get(r.storagePath) : undefined)).filter(Boolean) as string[];
  const aspect = project.format === "vsl_16x9" ? "16:9" : "9:16";

  try {
    if (storyboard) {
      const who = presenterOf(project);
      const task = await startStoryboardTask({
        scenes: waiting.map((sc) => ({ label: sc.label, shot: sc.shot })),
        aspect,
        referenceUrls,
        presenter: { name: who.name, pronoun: who.pronoun, look: who.look },
      });
      await db.insert(creativeAssets).values({
        projectId: project.id,
        kind: "manus_task",
        source: "manus",
        providerTaskId: task.taskId,
        status: "running",
        metadata: {
          shot: `${waiting.length} story scenes`,
          taskUrl: task.taskUrl,
          references: refs.map((r) => r.id),
          // scene-1.png … scene-N.png land in these scenes, in this order.
          storyboard: waiting.map((sc) => sc.id),
        },
      });
    } else {
      const task = await startFrameTask({
        shot,
        aspect,
        count: body?.count === 1 ? 1 : 2,
        referenceUrls,
        client: studio.kind === "client",
        presenter: presenter ? { name: presenter.name, pronoun: presenter.pronoun, look: presenter.look } : null,
        ...(recreateUrl ? { recreateUrl } : {}),
      });
      await db.insert(creativeAssets).values({
        projectId: project.id,
        kind: "manus_task",
        source: "manus",
        providerTaskId: task.taskId,
        status: "running",
        metadata: { shot: recreatePath ? `${typeof body?.referenceStill === "number" ? "Recreate the video's look" : "Recreate your photo"}${shot ? `: ${shot}` : ""}` : shot, ...(recreatePath ? { recreate: recreatePath } : {}), taskUrl: task.taskUrl, references: refs.map((r) => r.id), ...(sceneId ? { sceneId } : {}) },
      });
    }
  } catch (err) {
    const message = err instanceof ManusError ? err.message : "Couldn't start Manus";
    console.error("[creative-studio] Manus start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json(await projectDetail(project));
}
