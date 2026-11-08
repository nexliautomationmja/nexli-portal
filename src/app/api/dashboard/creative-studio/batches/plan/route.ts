import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { firmBrief, studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { cleanFormatRig } from "@/lib/creative-studio/validate";
import { claudeError } from "@/lib/creative-studio/script";
import { planBatch } from "@/lib/creative-studio/batch";
import { clampCount } from "@/lib/creative-studio/batch-shared";

export const maxDuration = 300;

/**
 * Plan a batch: Claude splits one idea into N different videos (title,
 * brief, frame shot). Nothing is saved; the user edits the plan first.
 * POST { brief, format, count } → { videos, notes }
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as { brief?: unknown; format?: unknown; count?: unknown } | null;
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 6000) : "";
  if (!brief) return NextResponse.json({ error: "Describe what the batch is about" }, { status: 400 });
  const { format } = cleanFormatRig(body?.format, null);
  const count = clampCount(format, body?.count);
  if (count < 2) return NextResponse.json({ error: "A batch is 2 or more videos" }, { status: 400 });
  try {
    return NextResponse.json(await planBatch({ brief, count, format, firm: firmBrief(studio) }));
  } catch (err) {
    console.error("[creative-studio] batch plan failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Planning the batch failed") }, { status: 500 });
  }
}
