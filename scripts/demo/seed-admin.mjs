#!/usr/bin/env node
/**
 * Seed (or reset the password of) the Nexli admin user for local demos.
 *
 * Usage, from the dashboard directory:
 *
 *   node scripts/demo/seed-admin.mjs --env .env.local
 *   node scripts/demo/seed-admin.mjs --env .env.local --reset-password
 *
 * Reads DATABASE_URL and ADMIN_INITIAL_PASSWORD (required) and
 * NEXLI_ADMIN_EMAIL (optional, defaults to mail@nexli.net) from the env file
 * given with --env, or from the current environment when --env is omitted.
 *
 * Without --reset-password the insert is a no-op if the admin already exists.
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const USAGE = `Usage: node scripts/demo/seed-admin.mjs --env .env.local [--reset-password]

Required env vars (from --env file or the environment):
  DATABASE_URL             Neon / Postgres connection string
  ADMIN_INITIAL_PASSWORD   Password for the admin login at /login
Optional:
  NEXLI_ADMIN_EMAIL        Admin email (default: mail@nexli.net)`;

function fail(message) {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

// ── Parse args ───────────────────────────────────────────
const args = process.argv.slice(2);
let envFile = null;
let resetPassword = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--env") {
    envFile = args[i + 1];
    if (!envFile) fail("--env requires a file path");
    i++;
  } else if (a.startsWith("--env=")) {
    envFile = a.slice("--env=".length);
  } else if (a === "--reset-password") {
    resetPassword = true;
  } else if (a === "-h" || a === "--help") {
    console.log(USAGE);
    process.exit(0);
  } else {
    fail(`Unknown argument: ${a}`);
  }
}

if (envFile) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    fail(`Could not load env file "${envFile}": ${err?.message ?? err}`);
  }
}

const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
const adminEmail = (process.env.NEXLI_ADMIN_EMAIL || "mail@nexli.net")
  .toLowerCase()
  .trim();

if (!databaseUrl) fail("DATABASE_URL is not set");
if (!adminPassword) fail("ADMIN_INITIAL_PASSWORD is not set");
if (adminPassword.length < 8) {
  fail("ADMIN_INITIAL_PASSWORD must be at least 8 characters");
}

// ── Seed ─────────────────────────────────────────────────
const sql = neon(databaseUrl);
const hashedPassword = await bcrypt.hash(adminPassword, 12);

try {
  if (resetPassword) {
    const rows = await sql`
      UPDATE users
      SET hashed_password = ${hashedPassword}, updated_at = now()
      WHERE lower(email) = ${adminEmail} AND role = 'admin'
      RETURNING id
    `;
    if (rows.length === 0) {
      console.error(
        `No admin user found for ${adminEmail}. Run without --reset-password to create it.`
      );
      process.exit(1);
    }
    console.log(`Password reset for admin ${adminEmail} (id ${rows[0].id}).`);
  } else {
    const rows = await sql`
      INSERT INTO users (email, name, hashed_password, role, company_name)
      VALUES (${adminEmail}, 'Marcel Allen', ${hashedPassword}, 'admin', 'Nexli Automation')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 0) {
      console.log(
        `Admin ${adminEmail} already exists; nothing changed. Use --reset-password to set a new password.`
      );
    } else {
      console.log(`Admin user created: ${adminEmail} (id ${rows[0].id}).`);
    }
  }
  console.log(`Sign in at <NEXTAUTH_URL>/login as ${adminEmail}.`);
  process.exit(0);
} catch (err) {
  console.error("Seed failed:", err?.message ?? err);
  process.exit(1);
}
