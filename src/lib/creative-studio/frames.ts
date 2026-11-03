import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { getSupabase } from "@/lib/supabase";
import { creativeAssets, creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { CREATIVE_BUCKET, ensureCreativeBucket } from "@/lib/creative-studio/storage";
import { toFrame } from "@/lib/creative-studio/images";

type Project = typeof creativeProjects.$inferSelect;

export async function readStorage(path: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(CREATIVE_BUCKET).download(path);
  if (error || !data) throw new Error("Couldn't read that image from storage");
  return Buffer.from(await data.arrayBuffer());
}

export async function writeStorage(path: string, bytes: Buffer, contentType: string): Promise<void> {
  await ensureCreativeBucket();
  const { error } = await getSupabase().storage.from(CREATIVE_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

/**
 * Make `bytes` the project's opening frame: cropped for the format (9:16 for
 * ads), stored, put first in the frame order, and used by every clip.
 */
export async function setOpeningFrame(project: Project, bytes: Buffer, source: string, metadata: Record<string, unknown> = {}) {
  const frame = await toFrame(bytes, project.format);
  const path = `${project.id}/frames/${randomUUID()}.png`;
  await writeStorage(path, frame.bytes, "image/png");
  await db
    .update(creativeAssets)
    .set({ sort: sql`${creativeAssets.sort} + 1` })
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")));
  const [asset] = await db
    .insert(creativeAssets)
    .values({
      projectId: project.id,
      kind: "frame",
      storagePath: path,
      mime: "image/png",
      width: frame.width,
      height: frame.height,
      source,
      sort: 0,
      metadata,
    })
    .returning({ id: creativeAssets.id });
  await db.update(creativeClips).set({ frameAssetId: asset.id }).where(eq(creativeClips.projectId, project.id));
  await db.update(creativeProjects).set({ updatedAt: new Date() }).where(eq(creativeProjects.id, project.id));
  return asset.id;
}
