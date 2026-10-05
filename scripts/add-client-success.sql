-- Customer-success loop: weekly pulse surveys + weekly updates for DRS
-- clients. Mirror of src/lib/client-success-tables.ts (which also creates
-- these at runtime). Idempotent. Run against Neon via the console or psql.

CREATE TABLE IF NOT EXISTS client_surveys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  week_start     DATE NOT NULL,
  sent_at        TIMESTAMP,
  viewed_at      TIMESTAMP,
  submitted_at   TIMESTAMP,
  expires_at     TIMESTAMP NOT NULL,
  results_score  INTEGER,            -- 1..5
  value_answer   TEXT,               -- 'yes' | 'somewhat' | 'no'
  comment        TEXT,
  alerted_at     TIMESTAMP,          -- low-score alert sent
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_surveys_client_week_idx ON client_surveys (client_user_id, week_start);
CREATE INDEX IF NOT EXISTS client_surveys_client_created_idx ON client_surveys (client_user_id, created_at);
CREATE INDEX IF NOT EXISTS client_surveys_submitted_idx ON client_surveys (submitted_at);

CREATE TABLE IF NOT EXISTS client_weekly_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start     DATE NOT NULL,
  headline       TEXT,
  body           TEXT NOT NULL,
  ad_spend_cents INTEGER,
  author_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent'
  sent_at        TIMESTAMP,
  viewed_at      TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_weekly_updates_client_week_idx ON client_weekly_updates (client_user_id, week_start);
CREATE INDEX IF NOT EXISTS client_weekly_updates_client_sent_idx ON client_weekly_updates (client_user_id, sent_at);
