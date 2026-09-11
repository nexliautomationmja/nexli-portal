import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { leads } from "./schema";
import { db as primaryDb } from "./index";

/**
 * Read-only connection to the marketing site's (nexli.net) database.
 *
 * The `leads` table is written only by the marketing site. The portal runs on
 * its own database, so Ad Analytics needs a second connection pointed at the
 * marketing database. Set MARKETING_DATABASE_URL in the portal's Vercel project
 * to nexli.net's DATABASE_URL.
 *
 * If the env var is unset we fall back to the primary connection, which keeps
 * things working for a deployment that genuinely shares one database.
 */

const marketingSchema = { leads };

let _marketingDb: NeonHttpDatabase<typeof marketingSchema> | null = null;

export function isMarketingDbConfigured(): boolean {
  return Boolean(process.env.MARKETING_DATABASE_URL);
}

export function getMarketingDb(): NeonHttpDatabase<typeof marketingSchema> {
  const url = process.env.MARKETING_DATABASE_URL;
  if (!url) {
    // Shared-DB fallback: same behavior as before this connection existed.
    return primaryDb as unknown as NeonHttpDatabase<typeof marketingSchema>;
  }
  if (!_marketingDb) {
    _marketingDb = drizzle(neon(url), { schema: marketingSchema });
  }
  return _marketingDb;
}
