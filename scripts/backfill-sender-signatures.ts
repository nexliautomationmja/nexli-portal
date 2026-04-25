/**
 * Backfill auto-generated sender signatures on existing engagementSigners
 * rows where order=0 (the CPA/sender) but no signature was attached.
 *
 * Run with: npx tsx dashboard/scripts/backfill-sender-signatures.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { engagementSigners } from "../src/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateSenderSignatureSvgDataUrl } from "../src/lib/signature";

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL");
  process.exit(1);
}
const sql = neon(dbUrl);
const db = drizzle(sql);

async function main() {
  const rows = await db
    .select()
    .from(engagementSigners)
    .where(and(eq(engagementSigners.order, 0), isNull(engagementSigners.signatureData)));

  console.log(`Found ${rows.length} sender signers to backfill`);

  for (const row of rows) {
    const svg = generateSenderSignatureSvgDataUrl(row.name || "Authorized Representative");
    const now = new Date();
    await db
      .update(engagementSigners)
      .set({
        status: "signed",
        signedAt: row.signedAt || now,
        signatureData: svg,
        signatureIp: row.signatureIp || "system",
        signatureUserAgent:
          row.signatureUserAgent || "Backfilled by sender-signature migration",
      })
      .where(eq(engagementSigners.id, row.id));
    console.log(`  Backfilled ${row.name} (${row.email})`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
