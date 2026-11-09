import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativePhotoAds, creativePhotoBatches } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { firmBrief, studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { clampPhotoCount, planPhotoAds } from "@/lib/creative-studio/photo-ads";
import { batchView, listBatches, referenceFiles } from "@/lib/creative-studio/photo-ads-service";

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
 * Plan a batch: POST { prompt, count (1–20) }. Claude writes the concepts;
 * nothing goes to Manus until the user reviews them and taps Make.
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as { prompt?: unknown; count?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  if (!prompt) return NextResponse.json({ error: "Tell me what the ads should be about" }, { status: 400 });
  const count = clampPhotoCount(body?.count);

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
    plan = await planPhotoAds({ prompt, count, firm: firmBrief(studio) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    console.error("[creative-studio] photo ad plan failed:", message);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }

  const [batch] = await db
    .insert(creativePhotoBatches)
    .values({ ownerId: access.ownerId, studioId: studio.id, createdBy: access.actorId, prompt, notes: plan.notes || null })
    .returning();
  await db.insert(creativePhotoAds).values(plan.ads.map((a, idx) => ({ ...a, idx, batchId: batch.id, ownerId: access.ownerId })));
  return NextResponse.json({ batch: await batchView(batch) });
}
