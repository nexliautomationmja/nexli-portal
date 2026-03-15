import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
  const checks: Record<string, unknown> = {};

  // Check env vars (redact values, only show existence)
  checks.hasDbUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  checks.dbUrlVar = process.env.DATABASE_URL ? "DATABASE_URL" : process.env.POSTGRES_URL ? "POSTGRES_URL" : "NONE";
  checks.hasAuthSecret = !!process.env.AUTH_SECRET;
  checks.hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  checks.authSecretLength = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").length;
  checks.nextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "NOT SET";
  checks.vercelEnv = !!process.env.VERCEL;
  checks.nodeEnv = process.env.NODE_ENV;

  // Check DB connection
  try {
    const result = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.email, "mail@nexli.net"))
      .limit(1);

    checks.dbConnected = true;
    checks.userFound = result.length > 0;
    if (result[0]) {
      checks.userId = result[0].id;
      checks.userRole = result[0].role;
    }
  } catch (err) {
    checks.dbConnected = false;
    checks.dbError = err instanceof Error ? err.message : String(err);
  }

  // Check bcrypt
  try {
    const [user] = await db
      .select({ hashedPassword: users.hashedPassword })
      .from(users)
      .where(eq(users.email, "mail@nexli.net"))
      .limit(1);

    if (user) {
      checks.hashLength = user.hashedPassword.length;
      checks.hashPrefix = user.hashedPassword.substring(0, 7);
      const match = await bcrypt.compare("Babysteak12!", user.hashedPassword);
      checks.passwordMatch = match;
    }
  } catch (err) {
    checks.bcryptError = err instanceof Error ? err.message : String(err);
  }

  // Simulate what authorize() does — test the full flow
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, "mail@nexli.net"))
      .limit(1);
    const user = result[0];
    if (user) {
      const match = await bcrypt.compare("Babysteak12!", user.hashedPassword);
      checks.fullFlowResult = match ? "SUCCESS" : "PASSWORD_MISMATCH";
    } else {
      checks.fullFlowResult = "USER_NOT_FOUND";
    }
  } catch (err) {
    checks.fullFlowResult = "ERROR";
    checks.fullFlowError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return NextResponse.json(checks);
}
