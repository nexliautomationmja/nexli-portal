import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Both current and new password are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Fetch current hash
  const [user] = await db
    .select({ hashedPassword: users.hashedPassword })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ hashedPassword: newHash, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
