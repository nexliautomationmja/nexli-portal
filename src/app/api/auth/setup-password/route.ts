/**
 * POST /api/auth/setup-password  { token, password }
 *
 * Consumes a password setup token (from the Foundation welcome email) and
 * sets the user's first password. Public route (see middleware).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumePasswordSetupToken } from "@/lib/password-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 200;

export async function POST(req: NextRequest) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return NextResponse.json({ error: "Password is too long" }, { status: 400 });
  }

  const consumed = await consumePasswordSetupToken(token);
  if (!consumed) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Ask for a new welcome email." },
      { status: 410 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await db
    .update(users)
    .set({ hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, consumed.userId));

  return NextResponse.json({ ok: true, redirect: "/login?setup=done" });
}
