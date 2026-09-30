-- Firm Foundation tier: per-firm branding, subscription + Stripe Connect
-- columns on users, password setup tokens, and the connected-account id on
-- invoices. Run against the Neon database via the Neon console or psql.
--
-- Why hand-written SQL: src/db/migrations/meta is several tables behind
-- src/db/schema.ts (invoices, tax returns, portal tables were applied with
-- db:push), so `drizzle-kit generate` produces an unsafe migration. This
-- script mirrors the schema.ts changes and is idempotent.

-- ── users ────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_url TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_color TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT;                       -- 'drs' | 'foundation'
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS foundation_agreement_engagement_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS foundation_agreement_sent_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_unique
  ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_unique
  ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_connect_account_id_unique
  ON users (stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_tier_idx ON users (tier);

-- Existing full-service clients keep the full dashboard: treat them as DRS.
UPDATE users SET tier = 'drs' WHERE role = 'client' AND tier IS NULL;

-- ── password_setup_tokens ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS password_setup_tokens_hash_idx ON password_setup_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_setup_tokens_user_idx ON password_setup_tokens (user_id);

-- ── invoices ─────────────────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
