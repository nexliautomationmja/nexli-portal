import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clientWeeklyUpdates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureClientSuccessTables } from "@/lib/client-success-tables";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  MAX_VOICE_BYTES,
  VOICE_UPDATE_PLACEHOLDER,
  createVoiceMessage,
  normalizeAudioMime,
  parseVoiceForm,
  voiceErrorStatus,
} from "@/lib/portal-messages";
import {
  emailWeeklyUpdate,
  loadWeeklyUpdateClient,
  parseAdSpend,
  parseHeadline,
  parseWeekStart,
  weeklyUpdateThreadOwner,
} from "@/lib/weekly-update-thread";

export const maxDuration = 60; // upload + inline transcription + email

/**
 * POST multipart { file, durationMs, weekStart?, headline?, adSpendCents? }
 * Record this week's update as a voice note: upserts the week's update row
 * as sent (body = transcript, "Voice update" until transcribed), posts the
 * audio into the client's Nexli thread, and emails the client.
 * → { update, message, emailed }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminId = session.user.id;
  const { clientId } = await params;
  const client = await loadWeeklyUpdateClient(clientId);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let parsed: Awaited<ReturnType<typeof parseVoiceForm>>;
  try {
    parsed = await parseVoiceForm(req);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const { file, durationMs, form } = parsed;

  // Validate cheaply before touching the update row.
  if (!normalizeAudioMime(file.type)) {
    return NextResponse.json(
      { error: "Unsupported audio format. Use WebM, OGG, M4A/MP4, AAC, MP3 or WAV." },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_VOICE_BYTES) {
    return NextResponse.json(
      { error: file.size === 0 ? "The recording is empty." : "Recording too large (4MB max)." },
      { status: 400 }
    );
  }
  const rawWeek = form.get("weekStart");
  const weekStart = parseWeekStart(typeof rawWeek === "string" ? rawWeek : null);
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart must be YYYY-MM-DD." }, { status: 400 });
  }
  const headline = parseHeadline(form.get("headline"));
  const rawSpend = form.get("adSpendCents");
  const adSpendCents = parseAdSpend(typeof rawSpend === "string" ? rawSpend : undefined);
  if (adSpendCents === undefined && typeof rawSpend === "string") {
    return NextResponse.json({ error: "Ad spend must be a positive number." }, { status: 400 });
  }

  await ensureClientSuccessTables();
  await ensurePortalMessageColumns();

  const now = new Date();
  const [existing] = await db
    .select()
    .from(clientWeeklyUpdates)
    .where(
      and(eq(clientWeeklyUpdates.clientUserId, clientId), eq(clientWeeklyUpdates.weekStart, weekStart))
    )
    .limit(1);

  const values = {
    headline,
    body: VOICE_UPDATE_PLACEHOLDER,
    adSpendCents: adSpendCents ?? null,
    authorId: adminId,
    status: "sent",
    sentAt: now,
    updatedAt: now,
  };
  let update: typeof clientWeeklyUpdates.$inferSelect;
  if (existing) {
    [update] = await db
      .update(clientWeeklyUpdates)
      .set(values)
      .where(eq(clientWeeklyUpdates.id, existing.id))
      .returning();
  } else {
    [update] = await db
      .insert(clientWeeklyUpdates)
      .values({ clientUserId: clientId, weekStart, ...values })
      .returning();
  }

  let message;
  try {
    message = await createVoiceMessage({
      ownerId: await weeklyUpdateThreadOwner(adminId),
      clientEmail: client.email.toLowerCase().trim(),
      senderType: "cpa",
      senderUserId: adminId,
      file,
      mime: file.type,
      durationMs,
      kind: "weekly_update",
      weeklyUpdateId: update.id,
    });
  } catch (err) {
    // Roll the update row back so a failed upload doesn't leave a "sent"
    // placeholder (or clobber an earlier note for this week).
    try {
      if (existing) {
        await db
          .update(clientWeeklyUpdates)
          .set({
            headline: existing.headline,
            body: existing.body,
            adSpendCents: existing.adSpendCents,
            authorId: existing.authorId,
            status: existing.status,
            sentAt: existing.sentAt,
            updatedAt: existing.updatedAt,
          })
          .where(eq(clientWeeklyUpdates.id, existing.id));
      } else {
        await db.delete(clientWeeklyUpdates).where(eq(clientWeeklyUpdates.id, update.id));
      }
    } catch (rollbackErr) {
      console.error("[weekly-update voice] rollback failed:", rollbackErr);
    }
    const status = voiceErrorStatus(err);
    if (status === 500) console.error("[weekly-update voice] failed:", err);
    return NextResponse.json(
      { error: status === 500 ? "Couldn't send the voice update." : (err as Error).message },
      { status }
    );
  }

  // Body now holds the transcript (if transcription succeeded).
  const [fresh] = await db
    .select()
    .from(clientWeeklyUpdates)
    .where(eq(clientWeeklyUpdates.id, update.id))
    .limit(1);
  if (fresh) update = fresh;

  const emailed = await emailWeeklyUpdate({
    update,
    client,
    senderAdminId: adminId,
    voice: { transcript: message.transcript },
    now,
  });

  return NextResponse.json({
    ok: true,
    update,
    message,
    emailed,
    ...(emailed ? {} : { warning: "Sent to the thread, but the email couldn't be delivered." }),
  });
}
