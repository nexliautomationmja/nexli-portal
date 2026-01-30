import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_INITIAL_PASSWORD is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await db
    .insert(users)
    .values({
      email: "mail@nexli.net",
      name: "Marcel Allen",
      hashedPassword,
      role: "admin",
      companyName: "Nexli Automation",
    })
    .onConflictDoNothing({ target: users.email });

  console.log("Admin user seeded: mail@nexli.net");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
