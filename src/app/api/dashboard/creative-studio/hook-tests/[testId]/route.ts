import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { accessToken, KlingNotConnectedError, KlingToolError } from "@/lib/creative-studio/kling-mcp";
import { HookError, advanceTest, askAgain, deleteTest, loadTest, pollTakes, submitTakes, testView } from "@/lib/creative-studio/hook-tests";
import { makeHookVideo, recreateWithHook } from "@/lib/creative-studio/hook-video";

// Watching a dropped-in video (download, stills, Scribe) plus Claude; Kling's 60 s rate-limit backoff.
export const maxDuration = 300;

type Ctx = { params: Promise<{ testId: string }> };

const missing = () => NextResponse.json({ error: "Hook test not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const test = await loadTest(access.ownerId, (await params).testId);
  if (!test) return missing();
  return NextResponse.json({ test: await testView(test) });
}

/** A Kling token, or the reason there isn't one (with `needsKling` so the page offers to connect). */
async function klingToken(ownerId: string): Promise<string> {
  try {
    return await accessToken(ownerId);
  } catch (err) {
    throw new HookError(err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling", 400, true);
  }
}

/**
 * POST { action }:
 *   run      → watch the video (a dropped-in one) and write the hooks; safe to call again while it's working.
 *   again    → { note?, hookId? } new hooks (all without a clip, or just that one), then `run`.
 *   kling    → { hookIds } make those hooks' clips on Kling (a video made here).
 *   poll     → check the clips on Kling and store the finished ones.
 *   video    → { hookId } a new video: this hook's clip, then the original's clips after its old hook.
 *   recreate → { hookId } a dropped-in video: a new video set up to recreate it, opening with this hook.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const started = Date.now();
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const test = await loadTest(access.ownerId, (await params).testId);
  if (!test) return missing();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hookId = typeof body?.hookId === "string" ? body.hookId : "";
  try {
    switch (body?.action) {
      case "run":
        return NextResponse.json({ test: await testView(await advanceTest(test, started + 285_000)) });
      case "again": {
        const row = await askAgain(test, typeof body.note === "string" ? body.note : "", hookId || null);
        return NextResponse.json({ test: await testView(row) });
      }
      case "kling": {
        const ids = Array.isArray(body.hookIds) ? body.hookIds.filter((x): x is string => typeof x === "string").slice(0, 9) : [];
        const report = await submitTakes(await klingToken(access.ownerId), test, ids);
        return NextResponse.json({ test: await testView(test), report });
      }
      case "poll": {
        const left = await pollTakes(await klingToken(access.ownerId), test).catch((err) => {
          if (err instanceof HookError) throw err;
          if (err instanceof KlingToolError && err.kind === "auth") throw new HookError(err.message, 400, true);
          console.error("[creative-studio] hook poll failed:", err instanceof Error ? err.message : err);
          return -1;
        });
        return NextResponse.json({ test: await testView(test), rendering: left });
      }
      case "video": {
        const made = await makeHookVideo(test, access.actorId, hookId);
        return NextResponse.json({ projectId: made.projectId });
      }
      case "recreate": {
        const made = await recreateWithHook(test, access.actorId, hookId);
        return NextResponse.json({ projectId: made.projectId });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof HookError) return NextResponse.json({ error: err.message, ...(err.needsKling ? { needsKling: true } : {}) }, { status: err.status });
    console.error("[creative-studio] hook test action failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "That didn't work. Try again." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const test = await loadTest(access.ownerId, (await params).testId);
  if (!test) return missing();
  await deleteTest(test);
  return NextResponse.json({ ok: true });
}
