import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativePhotoAds } from "@/lib/creative-studio/tables";
import { CONCEPT_LIMITS } from "@/lib/creative-studio/photo-ads";

const FIELDS = ["title", "headline", "subline", "scene", "look"] as const;

/** Apply the review's changes to a batch's planned concepts: { ads: [{ id, headline?, … }], remove: [id] }. */
export async function applyPlanEdits(batchId: string, body: unknown): Promise<void> {
  const b = (body ?? {}) as { ads?: unknown; remove?: unknown };
  const remove = Array.isArray(b.remove) ? b.remove.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (remove.length) {
    await db
      .delete(creativePhotoAds)
      .where(and(eq(creativePhotoAds.batchId, batchId), eq(creativePhotoAds.status, "planned"), inArray(creativePhotoAds.id, remove)));
  }
  const edits = Array.isArray(b.ads) ? b.ads.slice(0, 40) : [];
  for (const e of edits) {
    const edit = (e ?? {}) as Record<string, unknown>;
    if (typeof edit.id !== "string" || !/^[0-9a-f-]{36}$/i.test(edit.id)) continue;
    const patch: Record<string, string> = {};
    for (const f of FIELDS) {
      if (typeof edit[f] !== "string") continue;
      const v = (edit[f] as string).replace(/\s+/g, " ").trim().slice(0, CONCEPT_LIMITS[f]);
      if (v || f === "subline" || f === "look") patch[f] = v;
    }
    if (!Object.keys(patch).length) continue;
    await db
      .update(creativePhotoAds)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(creativePhotoAds.id, edit.id), eq(creativePhotoAds.batchId, batchId), eq(creativePhotoAds.status, "planned")));
  }
}
