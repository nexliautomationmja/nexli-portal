import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Runtime bootstrap for the voice / weekly-update columns on portal_messages.
 * This repo has no migration pipeline, so columns are added lazily with
 * ADD COLUMN IF NOT EXISTS the first time a messages handler runs. Keep in
 * sync with portalMessages in src/db/schema.ts and
 * scripts/add-portal-message-voice.sql.
 *
 * Memoized per lambda instance; on failure the memo resets so the next
 * request retries.
 */
let ensured: Promise<void> | null = null;

export function ensurePortalMessageColumns(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        ALTER TABLE "portal_messages"
          ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'text',
          ADD COLUMN IF NOT EXISTS "audio_path" text,
          ADD COLUMN IF NOT EXISTS "audio_mime" text,
          ADD COLUMN IF NOT EXISTS "audio_duration_ms" integer,
          ADD COLUMN IF NOT EXISTS "transcript" text,
          ADD COLUMN IF NOT EXISTS "transcript_status" text,
          ADD COLUMN IF NOT EXISTS "weekly_update_id" uuid,
          ADD COLUMN IF NOT EXISTS "sender_user_id" uuid
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "portal_messages_weekly_update_idx" ON "portal_messages" ("weekly_update_id") WHERE "weekly_update_id" IS NOT NULL`
      );
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
