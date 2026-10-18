import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Self-applying schema bootstrap for the hand-written migrations in
 * scripts/*.sql that were never run against the production database.
 *
 * Why: this repo has no migration pipeline, and on 2026-10-18 production
 * login was failing with Postgres 42703 (undefined column) because the
 * Firm Foundation columns on "users" (scripts/add-foundation-tier.sql) and
 * the firm_sites table (scripts/add-firm-sites.sql) existed only on the dev
 * branch. Every statement here is idempotent (IF NOT EXISTS), mirrors those
 * scripts exactly, and runs at most once per lambda instance. Keep the three
 * in sync: this file, the scripts, and src/db/schema.ts.
 */
let ensured: Promise<void> | null = null;

export function ensureCoreSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const statements = [
        // ── users (scripts/add-foundation-tier.sql) ──
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_url TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_display_name TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_color TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMP`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS foundation_agreement_engagement_id UUID`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS foundation_agreement_sent_at TIMESTAMP`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_unique ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_unique ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_connect_account_id_unique ON users (stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL`,
        sql`CREATE INDEX IF NOT EXISTS users_tier_idx ON users (tier)`,
        // Existing full-service clients keep the full dashboard: treat them as DRS.
        sql`UPDATE users SET tier = 'drs' WHERE role = 'client' AND tier IS NULL`,

        // ── password_setup_tokens ──
        sql`CREATE TABLE IF NOT EXISTS password_setup_tokens (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash  TEXT NOT NULL UNIQUE,
          expires_at  TIMESTAMP NOT NULL,
          used_at     TIMESTAMP,
          created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS password_setup_tokens_hash_idx ON password_setup_tokens (token_hash)`,
        sql`CREATE INDEX IF NOT EXISTS password_setup_tokens_user_idx ON password_setup_tokens (user_id)`,

        // ── invoices ──
        sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_account_id TEXT`,

        // ── firm_sites (scripts/add-firm-sites.sql) ──
        sql`CREATE TABLE IF NOT EXISTS firm_sites (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          slug             TEXT NOT NULL UNIQUE,
          domain           TEXT UNIQUE,
          status           TEXT NOT NULL DEFAULT 'draft',
          config           JSONB NOT NULL,
          preview_token    TEXT NOT NULL UNIQUE,
          generated_by     TEXT NOT NULL DEFAULT 'template',
          generation_notes TEXT,
          created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
          published_at     TIMESTAMP
        )`,
        sql`CREATE INDEX IF NOT EXISTS firm_sites_status_idx ON firm_sites (status)`,
      ];
      for (const statement of statements) {
        await db.execute(statement);
      }
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
