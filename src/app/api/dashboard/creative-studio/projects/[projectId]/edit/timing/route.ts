import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { parseTarget, setWindow } from "@/lib/creative-studio/edit-text";

type Ctx = { params: Promise<{ projectId: string }> };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/**
 * When one element is on screen, set by hand. POST { target, whole: true }
 * for the whole video, or { target, start, end } in seconds. Saved as a new
 * version (no Claude call); undo brings the old timing back.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { target?: unknown; whole?: unknown; start?: unknown; end?: unknown } | null;
  const target = parseTarget(body?.target);
  if (!target) return NextResponse.json({ error: "Unknown element" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });

  const D = edit.props.durationS;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const whole = body?.whole === true;
  const start = whole ? 0 : r2(Math.min(D, Math.max(0, num(body?.start))));
  const end = whole ? D : r2(Math.min(D, Math.max(0, num(body?.end))));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.5) {
    return NextResponse.json({ error: "Make it at least half a second long, with the end after the start." }, { status: 400 });
  }
  const overlays = setWindow(edit.props.overlays, target, start, end);
  if (!overlays) return NextResponse.json({ error: "That element isn't in this edit anymore" }, { status: 409 });

  const label = target.slot === "rung" ? "ladder pill" : target.slot;
  await db.insert(creativeEdits).values({
    projectId: project.id,
    version: edit.version + 1,
    style: edit.style,
    finalCutAssetId: edit.finalCutAssetId,
    props: { ...edit.props, overlays },
    notes: whole ? `The ${label} now shows for the whole video.` : `The ${label} now shows ${clock(start)}–${clock(end)}.`,
    note: null,
  });
  return NextResponse.json(await projectDetail(project));
}
