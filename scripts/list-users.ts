import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) { console.error("No DATABASE_URL"); process.exit(1); }
const sql = neon(dbUrl);
const db = drizzle(sql);

async function main() {
  const all = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users);
  for (const u of all) {
    console.log(`${u.role}\t${u.email}\t${u.name || "(no name)"}\t${u.id}`);
  }
}
main().catch(console.error);
