import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Connect a Client Tracker row to a client dashboard account. The link is the
 * email match — if an account with this email already exists we just return
 * it, otherwise we create one (role "client") with an unusable random
 * password; a real password gets set when their dashboard is built out.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const company =
    typeof body.company === "string" ? body.company.trim().slice(0, 200) : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const findExisting = () =>
    db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1);

  const [existing] = await findExisting();
  if (existing) {
    if (existing.role !== "client") {
      return NextResponse.json(
        { error: "This email belongs to an admin account and can't be connected." },
        { status: 409 }
      );
    }
    return NextResponse.json({ clientUserId: existing.id, created: false });
  }

  const hashedPassword = await bcrypt.hash(randomUUID(), 12);
  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: name || null,
        companyName: company || null,
        role: "client",
        hashedPassword,
      })
      .returning({ id: users.id });
    return NextResponse.json({ clientUserId: created.id, created: true });
  } catch (err) {
    // Unique-email race (double click / concurrent connect): fall back to
    // the row the other request created.
    const [raced] = await findExisting();
    if (raced?.role === "client") {
      return NextResponse.json({ clientUserId: raced.id, created: false });
    }
    console.error("Connect dashboard failed:", err);
    return NextResponse.json(
      { error: "Couldn't connect the dashboard. Please try again." },
      { status: 500 }
    );
  }
}
