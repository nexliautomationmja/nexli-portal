-- Pre-deploy check for the Aug 2026 pricing change (retainer $997 → $1,497/$2,497,
-- ad tiers $1,500/$2,500/$4,500 → $2,500/$4,500/$7,500).
--
-- Engagements composed BEFORE the change lack pricing snapshots in their
-- metadata, so if their Initial Setup invoice settles AFTER deploy, the
-- auto-generated follow-on invoices would fall back to the NEW constants and
-- overbill vs. the signed contract. Run this in the DB console before (or
-- right after) deploying; if it returns rows, run the patch below for each.

SELECT
  i.invoice_number,
  i.client_name,
  i.status,
  i.balance_due,
  i.metadata->>'drsVariant'      AS drs_variant,
  i.metadata->>'engagementId'    AS engagement_id,
  e.metadata                     AS engagement_metadata
FROM invoices i
LEFT JOIN engagements e ON e.id = (i.metadata->>'engagementId')::uuid
WHERE i.metadata->>'drsRole' = 'initial_setup'
  AND i.status NOT IN ('paid', 'canceled', 'void');

-- Patch (only for rows above whose engagement_metadata is missing the keys):
-- grandfather the OLD pricing onto the engagement so follow-on invoices match
-- the signed contract.
--
-- Starter DRS engagement signed at the old $997 retainer:
--   UPDATE engagements
--   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"retainerCents": 99700}'::jsonb
--   WHERE id = '<engagement_id>';
--
-- Original DRS engagement signed at the old $997 subscription:
--   UPDATE engagements
--   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"monthlyCents": 99700}'::jsonb
--   WHERE id = '<engagement_id>';
--
-- If ads were included at old tier pricing, also pin the old fee (engagements
-- composed before deploy already store adsManagementCents — only patch if the
-- key is absent). Old tiers: foundation 150000, growth 250000, scale 450000.
--   UPDATE engagements
--   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"adsManagementCents": 150000}'::jsonb
--   WHERE id = '<engagement_id>';
