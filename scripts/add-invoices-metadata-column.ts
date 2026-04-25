/**
 * One-off migration: add `metadata` jsonb column to the invoices table.
 *
 * Used to support the Digital Rainmaker System auto-invoicing flow, where
 * each generated invoice is tagged with:
 *   { engagementId, drsRole: "initial_setup" | "final_setup" | "monthly_subscription" }
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/add-invoices-metadata-column.ts
 */

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("DATABASE_URL or POSTGRES_URL must be set");
    process.exit(1);
  }

  const sql = neon(url);
  await sql`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "metadata" jsonb`;
  console.log("✓ invoices.metadata column ensured");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
