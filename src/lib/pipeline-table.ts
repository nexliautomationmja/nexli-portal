import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Runtime bootstrap for the pipeline_leads table.
 *
 * This repo has no migration pipeline (build is plain `next build`, the
 * drizzle migrations folder is stale, and the dev machine has no local
 * node), so new tables are created lazily with CREATE TABLE IF NOT EXISTS
 * the first time a pipeline API handler runs. Keep this DDL in sync with
 * the pipelineLeads definition in src/db/schema.ts.
 *
 * Memoized per lambda instance; on failure the memo resets so the next
 * request retries instead of caching a broken state.
 */
// value_cents is int4 — cap deal values at $20M to stay well inside range.
export const MAX_VALUE_CENTS = 2_000_000_000;

let ensured: Promise<void> | null = null;

export function ensurePipelineTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pipeline_leads" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "email" text,
          "phone" text,
          "company" text,
          "notes" text,
          "source" text NOT NULL DEFAULT 'manual',
          "stage" text NOT NULL DEFAULT 'open',
          "value_cents" integer NOT NULL,
          "ghl_contact_id" text,
          "booked_at" timestamp,
          "deleted_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "pipeline_leads_owner_idx" ON "pipeline_leads" ("owner_id")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "pipeline_leads_owner_stage_idx" ON "pipeline_leads" ("owner_id", "stage")`
      );
      // One pipeline entry per GHL contact per owner — booked-call sync
      // relies on this to stay idempotent even across concurrent requests.
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_leads_owner_ghl_idx" ON "pipeline_leads" ("owner_id", "ghl_contact_id") WHERE "ghl_contact_id" IS NOT NULL`
      );
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
