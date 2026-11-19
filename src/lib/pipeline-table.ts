import { db } from "@/db";
import { sql } from "drizzle-orm";
import { PIPELINE } from "@/lib/drs-pricing";

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
      await revalueDefaultLeads();
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

/**
 * Nov 19 2026: the default lead value became one Initial Term of Agency Fees
 * ($60,000). Open leads still holding a default an earlier pricing gave them
 * — never valued by hand — move to it. Only rows last touched before this
 * change: a value set by hand afterwards, even one equal to an old default,
 * is left alone. Won and lost leads keep the value they closed at.
 * Idempotent (a moved lead no longer holds an old default); never throws.
 */
const REVALUED_BEFORE = "2026-11-19T20:00:00Z";

async function revalueDefaultLeads(): Promise<void> {
  try {
    const olds = sql.join(
      PIPELINE.PREVIOUS_DEFAULTS_CENTS.map((v) => sql`${v}`),
      sql`, `
    );
    await db.execute(sql`
      UPDATE "pipeline_leads"
      SET "value_cents" = ${PIPELINE.DEFAULT_DEAL_VALUE_CENTS}
      WHERE "stage" = 'open'
        AND "deleted_at" IS NULL
        AND "value_cents" IN (${olds})
        AND "updated_at" < ${REVALUED_BEFORE}::timestamp
    `);
  } catch (err) {
    console.error("[pipeline] revaluing default leads failed (continuing):", err);
  }
}
