import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { RENDER_STARTING as STARTING, creativeEdits, isWaiting } from "@/lib/creative-studio/tables";
import { renderProps } from "@/lib/creative-studio/edit-service";
import { framesFor, isCrash, isRateLimit, lambdaLimits, renderersFor, startRender } from "@/lib/creative-studio/remotion";

/**
 * Final renders wait their turn for the AWS Lambda concurrency limit instead
 * of failing with "Rate Exceeded". An edit in line is status "rendering" with
 * no render id; whoever polls it (the video page, the batch board) starts it
 * once fewer than `parallel` renders are on Lambda across the whole account.
 * If AWS still refuses, it goes back in line and retries with fewer copies.
 * If a copy crashes mid-render (out of memory), it goes back in line once and
 * retries with lighter settings on the same number of copies.
 */

type Edit = typeof creativeEdits.$inferSelect;

/** A start that never came back (the request died) frees its slot after this. */
const STARTING_STALE_MS = 2 * 60_000;
/** A render quiet this long is dead: the launch function times out at 15 min. */
const LIVE_MS = 20 * 60_000;
/** After AWS refuses, let the copies still running finish before trying again. */
const COOLDOWN_MS = 45_000;
/** Refusals before giving up (the last try renders on a single copy). */
export const MAX_RENDER_ATTEMPTS = 4;
/** Crashed copies before giving up: the first crash retries once with lighter settings. */
const MAX_RENDER_CRASHES = 2;

function plainError(message: string, limit: number, durationS: number): string {
  if (isRateLimit(message)) {
    return `AWS only lets this account run ${limit} Lambda copies at once and refused even a single one. Ask AWS to raise the limit, then try again.`;
  }
  if (isCrash(message)) {
    const per = Math.round(durationS / Math.max(1, renderersFor(limit, 0, framesFor(durationS))));
    return (
      `A Lambda machine crashed twice while rendering, even with lighter settings — most likely it ran out of memory. ` +
      `With AWS's ${limit}-copy limit, each machine renders about ${per} seconds of this video. ` +
      `Try again; if it keeps failing, raising the AWS limit gives each machine a much shorter piece.`
    );
  }
  return `Remotion: ${message}`.slice(0, 500);
}

/** Put an edit in line and start it right away if a slot is free. */
export async function queueRender(edit: Edit): Promise<void> {
  const [queued] = await db
    .update(creativeEdits)
    .set({
      status: "rendering",
      renderId: null,
      renderBucket: null,
      renderAttempts: 0,
      renderCrashes: 0,
      progress: 0,
      error: null,
      specs: null,
      outputAssetId: null,
      outputKey: null,
      updatedAt: new Date(),
    })
    .where(eq(creativeEdits.id, edit.id))
    .returning();
  if (queued) await startIfFree(queued);
}

/** Start a queued edit on Lambda if the account has room for it. */
export async function startIfFree(edit: Edit): Promise<"started" | "waiting" | "failed"> {
  if (!isWaiting(edit)) return "started";
  if (edit.renderId === STARTING) {
    if (Date.now() - edit.updatedAt.getTime() < STARTING_STALE_MS) return "waiting";
    await db
      .update(creativeEdits)
      .set({ renderId: null })
      .where(and(eq(creativeEdits.id, edit.id), eq(creativeEdits.renderId, STARTING)));
  }
  if ((edit.renderAttempts > 0 || edit.renderCrashes > 0) && Date.now() - edit.updatedAt.getTime() < COOLDOWN_MS) return "waiting";

  const limits = await lambdaLimits();
  const live = new Date(Date.now() - LIVE_MS);
  // One statement claims the slot only while the account has room, so two
  // pages polling at once can't both start (a near-tie just retries below).
  const [claimed] = await db
    .update(creativeEdits)
    .set({ renderId: STARTING, updatedAt: new Date() })
    .where(
      and(
        eq(creativeEdits.id, edit.id),
        eq(creativeEdits.status, "rendering"),
        isNull(creativeEdits.renderId),
        sql`(SELECT count(*) FROM ${creativeEdits} WHERE ${and(
          eq(creativeEdits.status, "rendering"),
          isNotNull(creativeEdits.renderId),
          gt(creativeEdits.updatedAt, live)
        )}) < ${limits.parallel}`
      )
    )
    .returning({ id: creativeEdits.id });
  if (!claimed) return "waiting";

  try {
    // Every Lambda chunk downloads the cut, so the link has to outlive the render.
    const props = await renderProps(edit, 12 * 3600);
    const copies = renderersFor(limits.limit, edit.renderAttempts, framesFor(props.durationS));
    const { renderId, bucketName } = await startRender(props, copies, edit.renderCrashes > 0);
    await db
      .update(creativeEdits)
      .set({ renderId, renderBucket: bucketName, progress: 0, updatedAt: new Date() })
      .where(eq(creativeEdits.id, edit.id));
    return "started";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Starting the render failed";
    console.error("[creative-studio] render start failed:", message);
    return (await requeueOrFail(edit, message, limits.limit)) ? "waiting" : "failed";
  }
}

/**
 * AWS refused (or the render died of it): back in line with fewer copies,
 * until MAX_RENDER_ATTEMPTS. A crashed copy: back in line once, lighter.
 * Anything else fails with the reason. Returns true when it went back in line.
 */
export async function requeueOrFail(edit: Edit, message: string, limit?: number): Promise<boolean> {
  const attempts = edit.renderAttempts + 1;
  if (isRateLimit(message) && attempts < MAX_RENDER_ATTEMPTS) {
    await db
      .update(creativeEdits)
      .set({ renderId: null, renderBucket: null, renderAttempts: attempts, progress: 0, error: null, updatedAt: new Date() })
      .where(eq(creativeEdits.id, edit.id));
    return true;
  }
  const crashes = edit.renderCrashes + 1;
  if (isCrash(message) && crashes < MAX_RENDER_CRASHES) {
    await db
      .update(creativeEdits)
      .set({ renderId: null, renderBucket: null, renderCrashes: crashes, progress: 0, error: null, updatedAt: new Date() })
      .where(eq(creativeEdits.id, edit.id));
    return true;
  }
  await db
    .update(creativeEdits)
    .set({
      status: "failed",
      renderId: null,
      renderBucket: null,
      error: plainError(message, limit ?? (await lambdaLimits()).limit, edit.props.durationS),
      updatedAt: new Date(),
    })
    .where(eq(creativeEdits.id, edit.id));
  return false;
}

/** Take a render that hasn't reached Lambda yet back out of line. */
export async function leaveQueue(edit: Edit): Promise<boolean> {
  const [left] = await db
    .update(creativeEdits)
    .set({ status: "draft", renderAttempts: 0, renderCrashes: 0, progress: 0, updatedAt: new Date() })
    .where(and(eq(creativeEdits.id, edit.id), eq(creativeEdits.status, "rendering"), isNull(creativeEdits.renderId)))
    .returning({ id: creativeEdits.id });
  return Boolean(left);
}
