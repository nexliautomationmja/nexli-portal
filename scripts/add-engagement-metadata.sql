-- Migration: Add metadata JSONB column to engagements table
-- Stores ads tier info for auto-invoicing: { adsTier, adsManagementCents }
-- Run this against your Neon PostgreSQL database via Neon console or psql.

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS metadata JSONB;
