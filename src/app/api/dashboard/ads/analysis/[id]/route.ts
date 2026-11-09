import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { actOnAnalysis, advanceAnalysis, analysisDetail, analysisView, enqueueAnalysis, loadAnalysis } from "@/lib/ads/analysis-service";
import { getSettings } from "@/lib/ads/settings";
import { ManusError } from "@/lib/creative-studio/manus";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** One analysis with its report and the steps it made. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const row = await loadAnalysis(access.ownerId, (await params).id);
  if (!row) return NextResponse.json({ error: "That analysis wasn't found" }, { status: 404 });
  return NextResponse.json(await analysisDetail(row));
}

/**
 * POST { action: "reply", text } | { action: "allow" } (approve what Manus
 * asked — only ever from Marcel's click) | { action: "stop" } | { action: "seen" }
 * | { action: "retry" } (a failed/stopped run → a fresh one).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const row = await loadAnalysis(access.ownerId, (await params).id);
  if (!row) return NextResponse.json({ error: "That analysis wasn't found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { action?: string; text?: unknown } | null;
  try {
    if (body?.action === "retry") {
      if (row.status !== "failed" && row.status !== "stopped") return NextResponse.json({ error: "Only a failed or stopped run can be retried." }, { status: 400 });
      const settings = await getSettings(row.ownerId, row.accountId);
      const { row: fresh, created } = await enqueueAnalysis({ ownerId: row.ownerId, accountId: row.accountId, kind: row.kind, trigger: "manual", startedBy: access.actorId, agentProfile: settings.agentProfile });
      const advanced = created ? await advanceAnalysis(fresh, { deadline: Date.now() + 270_000 }) : fresh;
      return NextResponse.json({ analysis: analysisView(advanced) });
    }
    const action =
      body?.action === "reply"
        ? ({ type: "reply", text: typeof body.text === "string" ? body.text : "" } as const)
        : body?.action === "allow"
          ? ({ type: "allow" } as const)
          : body?.action === "stop"
            ? ({ type: "stop" } as const)
            : body?.action === "seen"
              ? ({ type: "seen" } as const)
              : null;
    if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const { row: next, error } = await actOnAnalysis(row, action);
    if (error) return NextResponse.json({ error, analysis: analysisView(next) }, { status: 409 });
    return NextResponse.json({ analysis: analysisView(next) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "That didn't work";
    console.error("[ads] analysis action failed:", message);
    return NextResponse.json({ error: err instanceof ManusError ? message : "Something went wrong. Try again." }, { status: 502 });
  }
}
