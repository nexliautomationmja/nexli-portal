import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Runtime bootstrap for the customer-success tables:
 *
 *   client_surveys        — one weekly pulse survey per DRS client (token link,
 *                           answers, low-score alert stamp)
 *   client_weekly_updates — the weekly "here's what the team worked on" note
 *                           Marcel writes per client (draft → sent)
 *
 * Same approach as src/lib/pipeline-table.ts: this repo has no migration
 * pipeline, so the tables are created lazily with CREATE TABLE IF NOT EXISTS
 * the first time a handler that uses them runs. Keep this DDL in sync with
 * clientSurveys / clientWeeklyUpdates in src/db/schema.ts and the hand-written
 * mirror in scripts/add-client-success.sql.
 */
let ensured: Promise<void> | null = null;

export function ensureClientSuccessTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "client_surveys" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "client_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "token" text NOT NULL UNIQUE,
          "week_start" date NOT NULL,
          "sent_at" timestamp,
          "viewed_at" timestamp,
          "submitted_at" timestamp,
          "expires_at" timestamp NOT NULL,
          "results_score" integer,
          "value_answer" text,
          "comment" text,
          "alerted_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "client_surveys_client_week_idx" ON "client_surveys" ("client_user_id", "week_start")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "client_surveys_client_created_idx" ON "client_surveys" ("client_user_id", "created_at")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "client_surveys_submitted_idx" ON "client_surveys" ("submitted_at")`
      );

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "client_weekly_updates" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "client_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "week_start" date NOT NULL,
          "headline" text,
          "body" text NOT NULL,
          "ad_spend_cents" integer,
          "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "status" text NOT NULL DEFAULT 'draft',
          "sent_at" timestamp,
          "viewed_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "client_weekly_updates_client_week_idx" ON "client_weekly_updates" ("client_user_id", "week_start")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "client_weekly_updates_client_sent_idx" ON "client_weekly_updates" ("client_user_id", "sent_at")`
      );
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

/** Monday (UTC date, YYYY-MM-DD) of the week containing `d`. */
export function weekStartOf(d: Date = new Date()): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  day.setUTCDate(day.getUTCDate() + diff);
  return day.toISOString().slice(0, 10);
}
