import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeClips,
  creativeCuts,
  creativeProjects,
  type CutClipPlan,
  type CutOverride,
  type CutSettings,
} from "@/lib/creative-studio/tables";
import { buildClipPlan, probeDuration, tempDir } from "@/lib/creative-studio/autocut";
import { transcribeClip } from "@/lib/creative-studio/transcribe";
import { readStorage } from "@/lib/creative-studio/frames";

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;
type Cut = typeof creativeCuts.$inferSelect;

export async function latestCut(projectId: string): Promise<Cut | null> {
  const [cut] = await db
    .select()
    .from(creativeCuts)
    .where(eq(creativeCuts.projectId, projectId))
    .orderBy(desc(creativeCuts.version))
    .limit(1);
  return cut ?? null;
}

export async function loadCut(projectId: string, cutId: string): Promise<Cut | null> {
  if (!/^[0-9a-f-]{36}$/i.test(cutId)) return null;
  const [cut] = await db
    .select()
    .from(creativeCuts)
    .where(and(eq(creativeCuts.id, cutId), eq(creativeCuts.projectId, projectId)))
    .limit(1);
  return cut ?? null;
}

export function overridesFor(cut: Cut | null, clipId: string): CutOverride[] {
  return cut?.plan.find((p) => p.clipId === clipId)?.overrides ?? [];
}

/** Download a clip's rendered video to a temp file. */
export async function clipVideoFile(clip: Clip, dir: string): Promise<string> {
  if (!clip.videoAssetId) throw new Error(`Clip ${clip.idx + 1} has no rendered video`);
  const [asset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, clip.videoAssetId)).limit(1);
  if (!asset?.storagePath) throw new Error(`Clip ${clip.idx + 1}'s video is missing`);
  const file = path.join(dir, `clip-${clip.id}.mp4`);
  await fs.writeFile(file, await readStorage(asset.storagePath));
  return file;
}

/** Make sure the clip's current take has word timings (Scribe) and its true duration. */
export async function ensureTranscript(clip: Clip, videoFile: string): Promise<Clip> {
  if (clip.transcript && clip.transcript.version === clip.version && clip.transcript.durationS > 0) return clip;
  const bytes = await fs.readFile(videoFile);
  const [transcript, duration] = await Promise.all([transcribeClip(bytes, clip.version), probeDuration(videoFile)]);
  transcript.durationS = duration || transcript.durationS || clip.durationS;
  const [updated] = await db
    .update(creativeClips)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(creativeClips.id, clip.id))
    .returning();
  return updated;
}

export function planFor(project: Project, clip: Clip, settings: CutSettings, overrides: CutOverride[]): CutClipPlan {
  const t = clip.transcript && clip.transcript.version === clip.version ? clip.transcript : null;
  return buildClipPlan({
    clipId: clip.id,
    version: clip.version,
    transcript: t,
    sourceS: t?.durationS || clip.durationS,
    settings,
    overrides,
    format: project.format,
  });
}

/** A previously rendered piece with this plan hash (any cut of this project). */
export async function findPiece(projectId: string, hash: string) {
  const [piece] = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.projectId, projectId),
        eq(creativeAssets.kind, "cut_part"),
        sql`${creativeAssets.metadata}->>'hash' = ${hash}`
      )
    )
    .limit(1);
  return piece ?? null;
}

export { tempDir };
