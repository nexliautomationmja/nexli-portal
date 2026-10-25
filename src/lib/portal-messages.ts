import { createHash, randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientWeeklyUpdates, portalMessages, users } from "@/db/schema";
import { getSupabase } from "@/lib/supabase";
import { sendEmailWithLog, emailWrapper } from "@/lib/email";
import { getOwnerBranding } from "@/lib/branding";
import { createNotification } from "@/lib/notifications";
import { getNexliAdminId } from "@/lib/foundation-project";
import { getPortalUrl } from "@/lib/foundation-config";
import {
  MAX_MESSAGE_LENGTH,
  MAX_VOICE_BYTES,
  VOICE_MESSAGE_PLACEHOLDER,
  type MessageKind,
  type ThreadMessage,
  type TranscriptStatus,
} from "@/lib/portal-messages-types";

export * from "@/lib/portal-messages-types";

/**
 * Message threads between an owner (Nexli admin or a firm) and one client
 * email, with voice notes + automatic transcripts. Thread = (ownerId,
 * clientEmail). Callers must `await ensurePortalMessageColumns()` first.
 */

const BUCKET = "documents";
const SIGNED_URL_SECONDS = 60 * 60;
/** Placeholder body for a weekly update recorded as voice, until transcribed. */
export const VOICE_UPDATE_PLACEHOLDER = "Voice update";

type MessageRow = typeof portalMessages.$inferSelect;

// ── Errors ────────────────────────────────────────────────

/** Bad input (unsupported type, too large, empty) — map to HTTP 400. */
export class VoiceInputError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "VoiceInputError";
  }
}

/** Storage upload/download failed — map to HTTP 502. */
export class VoiceStorageError extends Error {
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "VoiceStorageError";
  }
}

/** Status for a thrown error from this module (500 for anything unknown). */
export function voiceErrorStatus(err: unknown): number {
  if (err instanceof VoiceInputError || err instanceof VoiceStorageError) return err.status;
  return 500;
}

// ── Helpers ───────────────────────────────────────────────

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** "audio/webm;codecs=opus" → "audio/webm"; null if not allowlisted. */
export function normalizeAudioMime(mime: string | null | undefined): string | null {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  return base in AUDIO_EXT ? base : null;
}

export function excerpt(text: string | null | undefined, max: number): string {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Parse a client-reported duration (ms). Clamped to 0..30min, null if junk. */
export function parseDurationMs(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), 30 * 60 * 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function threadHash(clientEmail: string): string {
  return createHash("sha256").update(clientEmail.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function asStatus(v: string | null): TranscriptStatus | null {
  return v === "pending" || v === "done" || v === "failed" ? v : null;
}

function asKind(v: string | null): MessageKind {
  return v === "voice" || v === "weekly_update" ? v : "text";
}

// ── Serialization ─────────────────────────────────────────

export async function serializeMessages(rows: MessageRow[]): Promise<ThreadMessage[]> {
  if (rows.length === 0) return [];

  const paths = [...new Set(rows.map((r) => r.audioPath).filter((p): p is string => !!p))];
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data, error } = await getSupabase()
        .storage.from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (error) throw error;
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) urlByPath.set(item.path, item.signedUrl);
      }
    } catch (err) {
      console.error("[portal-messages] signed URLs failed:", err);
    }
  }

  const updateIds = [
    ...new Set(rows.map((r) => r.weeklyUpdateId).filter((id): id is string => !!id)),
  ];
  const updateById = new Map<string, { headline: string | null; adSpendCents: number | null }>();
  if (updateIds.length > 0) {
    try {
      const updates = await db
        .select({
          id: clientWeeklyUpdates.id,
          headline: clientWeeklyUpdates.headline,
          adSpendCents: clientWeeklyUpdates.adSpendCents,
        })
        .from(clientWeeklyUpdates)
        .where(inArray(clientWeeklyUpdates.id, updateIds));
      for (const u of updates) {
        updateById.set(u.id, { headline: u.headline, adSpendCents: u.adSpendCents });
      }
    } catch (err) {
      console.error("[portal-messages] weekly update join failed:", err);
    }
  }

  return rows.map((r) => {
    const kind = asKind(r.kind);
    return {
      id: r.id,
      senderType: r.senderType === "client" ? "client" : "cpa",
      kind,
      message: r.message,
      transcript: r.transcript ?? null,
      transcriptStatus: asStatus(r.transcriptStatus),
      audioUrl: r.audioPath ? urlByPath.get(r.audioPath) ?? null : null,
      audioDurationMs: r.audioDurationMs ?? null,
      weeklyUpdate:
        kind === "weekly_update"
          ? (r.weeklyUpdateId && updateById.get(r.weeklyUpdateId)) || {
              headline: null,
              adSpendCents: null,
            }
          : null,
      read: r.read,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  });
}

async function serializeOne(row: MessageRow): Promise<ThreadMessage> {
  const [m] = await serializeMessages([row]);
  return m;
}

// ── Thread queries ────────────────────────────────────────

export async function loadThread(ownerId: string, clientEmail: string): Promise<MessageRow[]> {
  return db
    .select()
    .from(portalMessages)
    .where(and(eq(portalMessages.ownerId, ownerId), eq(portalMessages.clientEmail, clientEmail)))
    .orderBy(portalMessages.createdAt);
}

/** Mark every unread message from `fromSender` in the thread as read (one UPDATE). */
export async function markThreadRead(
  ownerId: string,
  clientEmail: string,
  fromSender: "cpa" | "client"
): Promise<void> {
  await db
    .update(portalMessages)
    .set({ read: true })
    .where(
      and(
        eq(portalMessages.ownerId, ownerId),
        eq(portalMessages.clientEmail, clientEmail),
        eq(portalMessages.senderType, fromSender),
        eq(portalMessages.read, false)
      )
    );
}

/** Unread messages from `fromSender` in the thread (cheap COUNT). */
export async function countUnread(
  ownerId: string,
  clientEmail: string,
  fromSender: "cpa" | "client"
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(portalMessages)
    .where(
      and(
        eq(portalMessages.ownerId, ownerId),
        eq(portalMessages.clientEmail, clientEmail),
        eq(portalMessages.senderType, fromSender),
        eq(portalMessages.read, false)
      )
    );
  return Number(row?.n ?? 0);
}

/** Insert a plain text message and return it serialized. */
export async function createTextMessage(params: {
  ownerId: string;
  clientEmail: string;
  senderType: "cpa" | "client";
  senderUserId?: string | null;
  message: string;
}): Promise<ThreadMessage> {
  const [row] = await db
    .insert(portalMessages)
    .values({
      ownerId: params.ownerId,
      clientEmail: params.clientEmail,
      senderType: params.senderType,
      senderUserId: params.senderUserId ?? null,
      kind: "text",
      message: params.message.slice(0, MAX_MESSAGE_LENGTH),
    })
    .returning();
  return serializeOne(row);
}

/** Read `file` + `durationMs` from a multipart voice upload. Throws VoiceInputError. */
export async function parseVoiceForm(req: Request): Promise<{
  file: File;
  durationMs: number | null;
  form: FormData;
}> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new VoiceInputError("Expected a multipart upload.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new VoiceInputError("No recording provided.");
  return { file, durationMs: parseDurationMs(form.get("durationMs")), form };
}

// ── Storage + transcription ───────────────────────────────

export async function storeVoice(params: {
  file: File | Blob;
  mime?: string | null;
  ownerId: string;
  clientEmail: string;
}): Promise<{ path: string; mime: string; buffer: Buffer }> {
  const { file, ownerId, clientEmail } = params;
  const mime = normalizeAudioMime(params.mime || file.type);
  if (!mime) {
    throw new VoiceInputError(
      "Unsupported audio format. Use WebM, OGG, M4A/MP4, AAC, MP3 or WAV."
    );
  }
  if (file.size === 0) throw new VoiceInputError("The recording is empty.");
  if (file.size > MAX_VOICE_BYTES) {
    throw new VoiceInputError("Recording too large (4MB max, about 4 minutes).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `messages/${ownerId}/${threadHash(clientEmail)}/${randomUUID()}.${AUDIO_EXT[mime]}`;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) {
    console.error("[portal-messages] voice upload failed:", error);
    throw new VoiceStorageError("Couldn't save the recording. Please try again.");
  }
  return { path, mime, buffer };
}

export async function transcribeAudio(buffer: Buffer, mime: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const base = normalizeAudioMime(mime) ?? "audio/webm";

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: base }),
    `voice.${AUDIO_EXT[base] ?? "webm"}`
  );

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

/**
 * Transcribe and write the result onto the message row (and, for a voice
 * weekly update still holding the placeholder body, onto the update row).
 * Never throws — a failure marks transcriptStatus "failed".
 */
async function applyTranscript(row: MessageRow, buffer: Buffer, mime: string): Promise<MessageRow> {
  try {
    const transcript = await transcribeAudio(buffer, mime);
    const [updated] = await db
      .update(portalMessages)
      .set({
        transcript,
        transcriptStatus: "done",
        message: transcript ? transcript.slice(0, MAX_MESSAGE_LENGTH) : VOICE_MESSAGE_PLACEHOLDER,
      })
      .where(eq(portalMessages.id, row.id))
      .returning();
    if (transcript && row.weeklyUpdateId) {
      try {
        await db
          .update(clientWeeklyUpdates)
          .set({ body: transcript.slice(0, 10_000), updatedAt: new Date() })
          .where(
            and(
              eq(clientWeeklyUpdates.id, row.weeklyUpdateId),
              eq(clientWeeklyUpdates.body, VOICE_UPDATE_PLACEHOLDER)
            )
          );
      } catch (err) {
        console.error("[portal-messages] weekly update body sync failed:", err);
      }
    }
    return updated ?? row;
  } catch (err) {
    console.error("[portal-messages] transcription failed:", err);
    const [updated] = await db
      .update(portalMessages)
      .set({ transcriptStatus: "failed" })
      .where(eq(portalMessages.id, row.id))
      .returning();
    return updated ?? row;
  }
}

/**
 * Store a voice note, insert the message, transcribe inline. For
 * kind "weekly_update" an existing message for the same weeklyUpdateId is
 * replaced in place (re-sending a week never double-posts).
 * Throws VoiceInputError / VoiceStorageError; transcription failure does not
 * throw (transcriptStatus "failed").
 */
export async function createVoiceMessage(params: {
  ownerId: string;
  clientEmail: string;
  senderType: "cpa" | "client";
  senderUserId?: string | null;
  file: File | Blob;
  mime?: string | null;
  durationMs?: number | null;
  kind?: "voice" | "weekly_update";
  weeklyUpdateId?: string | null;
}): Promise<ThreadMessage> {
  const kind = params.kind ?? "voice";
  const stored = await storeVoice({
    file: params.file,
    mime: params.mime,
    ownerId: params.ownerId,
    clientEmail: params.clientEmail,
  });

  const values = {
    kind,
    message: VOICE_MESSAGE_PLACEHOLDER,
    audioPath: stored.path,
    audioMime: stored.mime,
    audioDurationMs: params.durationMs ?? null,
    transcript: null,
    transcriptStatus: "pending",
    weeklyUpdateId: params.weeklyUpdateId ?? null,
    senderUserId: params.senderUserId ?? null,
  };

  let row: MessageRow | undefined;
  if (kind === "weekly_update" && params.weeklyUpdateId) {
    const [existing] = await db
      .select({ id: portalMessages.id, audioPath: portalMessages.audioPath })
      .from(portalMessages)
      .where(eq(portalMessages.weeklyUpdateId, params.weeklyUpdateId))
      .limit(1);
    if (existing) {
      [row] = await db
        .update(portalMessages)
        .set({ ...values, read: false })
        .where(eq(portalMessages.id, existing.id))
        .returning();
      if (existing.audioPath && existing.audioPath !== stored.path) {
        await getSupabase()
          .storage.from(BUCKET)
          .remove([existing.audioPath])
          .catch(() => {});
      }
    }
  }
  if (!row) {
    [row] = await db
      .insert(portalMessages)
      .values({
        ownerId: params.ownerId,
        clientEmail: params.clientEmail,
        senderType: params.senderType,
        ...values,
      })
      .returning();
  }

  const done = await applyTranscript(row, stored.buffer, stored.mime);
  return serializeOne(done);
}

/** Re-run transcription for a voice message in one of `ownerId`'s threads. */
export async function retryTranscript(
  messageId: string,
  ownerId: string
): Promise<ThreadMessage | null> {
  const [row] = await db
    .select()
    .from(portalMessages)
    .where(and(eq(portalMessages.id, messageId), eq(portalMessages.ownerId, ownerId)))
    .limit(1);
  if (!row || !row.audioPath) return null;

  const { data, error } = await getSupabase().storage.from(BUCKET).download(row.audioPath);
  if (error || !data) {
    console.error("[portal-messages] voice download failed:", error);
    throw new VoiceStorageError("Couldn't load the recording. Please try again.");
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  await db
    .update(portalMessages)
    .set({ transcriptStatus: "pending" })
    .where(eq(portalMessages.id, row.id));
  const done = await applyTranscript(row, buffer, row.audioMime || data.type || "audio/webm");
  return serializeOne(done);
}

// ── Notifications ─────────────────────────────────────────

/** Email the client that the owner posted in their thread. Never throws. */
export async function notifyClientOfMessage(params: {
  ownerId: string;
  clientEmail: string;
  message: ThreadMessage;
}): Promise<void> {
  const { ownerId, clientEmail, message } = params;
  try {
    const [branding, nexliAdminId, clientUser] = await Promise.all([
      getOwnerBranding(ownerId),
      getNexliAdminId(),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          and(
            sql`lower(${users.email}) = ${clientEmail.toLowerCase().trim()}`,
            eq(users.role, "client")
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    const sender = branding.isNexli ? "your Nexli team" : branding.displayName;
    const isVoice = message.transcriptStatus !== null;
    const portalUrl = getPortalUrl();
    const ctaUrl =
      clientUser && nexliAdminId && ownerId === nexliAdminId
        ? `${portalUrl}/dashboard/nexli-messages`
        : `${portalUrl}/portal/dashboard/messages`;

    const text = isVoice ? message.transcript : message.message;
    const quote = excerpt(text, 300);
    const firstName = (clientUser?.name || "").trim().split(/\s+/)[0];
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
    const lead = isVoice
      ? `${escapeHtml(sender)} sent you a voice message.`
      : `${escapeHtml(sender)} sent you a message.`;

    const html = emailWrapper(
      `
      <p style="margin:0 0 6px;color:#9999a8;font-size:14px;">${greeting}</p>
      <h1 style="margin:0 0 16px;color:#fff;font-size:20px;font-weight:800;">${isVoice ? "&#127897; " : ""}${lead}</h1>
      ${
        quote
          ? `<div style="margin:0 0 24px;padding:14px 16px;background-color:#131319;border:1px solid #1e1e2a;border-radius:12px;">
              ${isVoice ? `<p style="margin:0 0 6px;color:#808090;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Transcript</p>` : ""}
              <p style="margin:0;color:#ccccda;font-size:14px;line-height:1.7;">${escapeHtml(quote)}</p>
            </div>`
          : ""
      }
      <div style="text-align:center;margin:24px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background-color:#2563EB;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:700;">Open messages</a>
      </div>
    `,
      branding
    );

    await sendEmailWithLog({
      to: clientEmail,
      subject: `New message from ${branding.isNexli ? "your Nexli team" : branding.displayName}`,
      html,
      fromName: branding.fromName,
      recipientName: clientUser?.name || undefined,
      emailType: "portal_message",
      relatedId: message.id,
      sentBy: ownerId,
    });
  } catch (err) {
    console.error("[portal-messages] client notification failed:", err);
  }
}

/** In-app (+ admin email) notification that a client replied. Never throws. */
export async function notifyOwnerOfReply(params: {
  ownerId: string;
  clientEmail: string;
  clientName?: string | null;
  message: ThreadMessage;
}): Promise<void> {
  const { ownerId, clientEmail, clientName, message } = params;
  const who = clientName?.trim() || clientEmail;
  const isVoice = message.transcriptStatus !== null;
  // The notification email renders this unescaped — drop angle brackets.
  const text = excerpt(isVoice ? message.transcript : message.message, 200).replace(/[<>]/g, "");
  try {
    await createNotification({
      userId: ownerId,
      type: "portal_message",
      title: `New message from ${who}`,
      message: isVoice
        ? text
          ? `sent a voice message: ${text}`
          : "sent a voice message"
        : text,
      metadata: { clientEmail, clientName: clientName ?? null, messageId: message.id },
    });
  } catch (err) {
    console.error("[portal-messages] owner notification failed:", err);
  }
}
