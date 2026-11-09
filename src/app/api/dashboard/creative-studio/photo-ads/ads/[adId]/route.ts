import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { ManusError } from "@/lib/creative-studio/manus";
import { actOnAd, advanceBatch, batchView, loadAd, loadBatch } from "@/lib/creative-studio/photo-ads-service";

export const maxDuration = 120;

type Ctx = { params: Promise<{ adId: string }> };

/**
 * One photo ad: POST { action: "redo", note? } | { action: "reply", text } |
 * { action: "allow" } (approve what Manus asked — only on the user's click) |
 * { action: "stop" }.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const ad = await loadAd(access.ownerId, (await params).adId);
  const batch = ad ? await loadBatch(access.ownerId, ad.batchId) : null;
  if (!ad || !batch) return NextResponse.json({ error: "That ad wasn't found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { action?: string; text?: unknown; note?: unknown } | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const action =
    body?.action === "redo"
      ? ({ type: "redo", note: str(body.note) } as const)
      : body?.action === "reply"
        ? ({ type: "reply", text: str(body.text) } as const)
        : body?.action === "allow"
          ? ({ type: "allow" } as const)
          : body?.action === "stop"
            ? ({ type: "stop" } as const)
            : null;
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (action.type === "redo" && (ad.status === "planned" || batch.status !== "started")) {
    return NextResponse.json({ error: "Make the batch first." }, { status: 400 });
  }
  try {
    const problem = await actOnAd(ad, action);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    await advanceBatch(batch);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Manus didn't take that";
    console.error("[creative-studio] photo ad action failed:", message);
    return NextResponse.json({ error: err instanceof ManusError ? message : "Something went wrong. Try again." }, { status: 502 });
  }
  return NextResponse.json({ batch: await batchView(batch) });
}
