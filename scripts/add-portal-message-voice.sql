-- Voice messages + weekly updates in client message threads.
-- Mirror of src/lib/portal-messages-table.ts (which also applies this at
-- runtime). Idempotent. Run against Neon via the console or psql.

ALTER TABLE portal_messages
  ADD COLUMN IF NOT EXISTS kind              TEXT NOT NULL DEFAULT 'text', -- 'text' | 'voice' | 'weekly_update'
  ADD COLUMN IF NOT EXISTS audio_path        TEXT,     -- Supabase `documents` bucket path
  ADD COLUMN IF NOT EXISTS audio_mime        TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS transcript        TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT,     -- 'pending' | 'done' | 'failed'
  ADD COLUMN IF NOT EXISTS weekly_update_id  UUID,
  ADD COLUMN IF NOT EXISTS sender_user_id    UUID;

CREATE INDEX IF NOT EXISTS portal_messages_weekly_update_idx
  ON portal_messages (weekly_update_id) WHERE weekly_update_id IS NOT NULL;
