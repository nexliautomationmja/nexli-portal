import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { ensureCoreSchema } from "@/lib/schema-bootstrap";

/**
 * Team members: people who sign in with their own email + password and work
 * inside the owner's workspace (users.workspace_owner_id = owner). Only the
 * workspace owner (an admin signed in as themselves) can manage the team.
 */

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  lastLoginAt: string | null;
  createdAt: string | null;
}

async function ownerSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "admin" || session.user.memberId) {
    return { error: NextResponse.json({ error: "Only the workspace owner can manage the team" }, { status: 403 }) };
  }
  await ensureCoreSchema();
  return { ownerId: session.user.id };
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { rows?: unknown[] })?.rows ?? []) as Record<string, unknown>[];
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function GET() {
  const s = await ownerSession();
  if ("error" in s) return s.error;
  const r = await db.execute(sql`
    SELECT id, name, email, last_login_at, created_at
    FROM users WHERE workspace_owner_id = ${s.ownerId}
    ORDER BY created_at ASC
  `);
  const members: TeamMember[] = rowsOf(r).map((m) => ({
    id: String(m.id),
    name: (m.name as string | null) ?? null,
    email: String(m.email),
    lastLoginAt: iso(m.last_login_at),
    createdAt: iso(m.created_at),
  }));
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const s = await ownerSession();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null;
  const name = (body?.name || "").trim() || null;
  const email = (body?.email || "").toLowerCase().trim();
  const password = body?.password || "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "That email already has a portal login" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  // One statement so a member can never exist without its workspace link.
  const r = await db.execute(sql`
    INSERT INTO users (email, name, hashed_password, role, workspace_owner_id)
    VALUES (${email}, ${name}, ${hashedPassword}, 'admin', ${s.ownerId})
    RETURNING id
  `);
  return NextResponse.json({ ok: true, id: String(rowsOf(r)[0]?.id ?? "") });
}

export async function DELETE(req: NextRequest) {
  const s = await ownerSession();
  if ("error" in s) return s.error;
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  }
  const r = await db.execute(sql`
    DELETE FROM users WHERE id = ${id} AND workspace_owner_id = ${s.ownerId} RETURNING id
  `);
  if (rowsOf(r).length === 0) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
