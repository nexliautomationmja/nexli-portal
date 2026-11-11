import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativePhotoAds, creativePhotoBatches } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { firmBrief, studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { clampPhotoCount, planPhotoAds } from "@/lib/creative-studio/photo-ads";
import { batchView, listBatches, referenceFiles, styleRefPrefix } from "@/lib/creative-studio/photo-ads-service";
import { signPaths } from "@/lib/creative-studio/storage";

/** Reference ads to mimic, at most this many per batch. */
const MAX_STYLE_REFS = 3;

export const maxDuration = 300;

/** This studio's photo ad batches, newest first. */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  return NextResponse.json({ batches: await listBatches(access.ownerId, studio) });
}

/**
 * Plan a batch: POST { prompt, count (1–20), styleRefs? }. Claude writes the
 * concepts; nothing goes to Manus until the user reviews them and taps Make.
 * styleRefs = uploaded reference ads to mimic (photo-ads/style-ref), which
 * Claude and later Manus both see.
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as { prompt?: unknown; count?: unknown; styleRefs?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  if (!prompt) return NextResponse.json({ error: "Tell me what the ads should be about" }, { status: 400 });
  const count = clampPhotoCount(body?.count);
  const prefix = styleRefPrefix(access.ownerId);
  const shape = /^[0-9a-f-]{36}\.(png|jpe?g|webp)$/i;
  const styleRefs = (Array.isArray(body?.styleRefs) ? body.styleRefs : [])
    .filter((p): p is string => typeof p === "string" && p.startsWith(prefix) && shape.test(p.slice(prefix.length)))
    .slice(0, MAX_STYLE_REFS);

  if (studio.kind === "client" && (await referenceFiles(access.ownerId, studio)).length === 0) {
    return NextResponse.json(
      {
        error: `${studio.name}'s studio has no reference pictures yet, so Manus doesn't know who presents. Add reference pictures in a video's frame step first.`,
      },
      { status: 400 }
    );
  }

  let plan;
  try {
    const signed = styleRefs.length ? await signPaths(styleRefs, 3600) : new Map<string, string>();
    const styleRefUrls = styleRefs.map((p) => signed.get(p) ?? "").filter(Boolean);
    plan = await planPhotoAds({ prompt, count, firm: firmBrief(studio), ...(styleRefUrls.length ? { styleRefUrls } : {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    console.error("[creative-studio] photo ad plan failed:", message);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }

  const [batch] = await db
    .insert(creativePhotoBatches)
    .values({ ownerId: access.ownerId, studioId: studio.id, createdBy: access.actorId, prompt, notes: plan.notes || null, styleRefs: styleRefs.length ? styleRefs : null })
    .returning();
  await db.insert(creativePhotoAds).values(plan.ads.map((a, idx) => ({ ...a, idx, batchId: batch.id, ownerId: access.ownerId })));
  return NextResponse.json({ batch: await batchView(batch) });
}
