-- Firm Foundation: database-backed firm websites.
-- One row per Foundation firm. The marketing app renders /sites/<slug> (and
-- custom domains) from `config` at request time, so publishing a site needs
-- no deploy. Owned by the dashboard app; the marketing app reads it via the
-- read-only mirror in lib/firm-sites-schema.ts.
--
-- Run against Neon via the console, psql, or:
--   node scripts/demo/run-sql.mjs dashboard/scripts/add-firm-sites.sql --env dashboard/.env.local
-- Idempotent.

CREATE TABLE IF NOT EXISTS firm_sites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE,
  domain           TEXT UNIQUE,
  status           TEXT NOT NULL DEFAULT 'draft',      -- 'draft' | 'published'
  config           JSONB NOT NULL,
  preview_token    TEXT NOT NULL UNIQUE,
  generated_by     TEXT NOT NULL DEFAULT 'template',   -- 'claude' | 'template' | 'manual'
  generation_notes TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS firm_sites_status_idx ON firm_sites (status);
