import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Link between a book-of-business row (an email on a signed engagement) and a
 * client dashboard account (`users`, role "client"). The email is the join
 * key: if an account already exists we return it, otherwise we create one
 * with an unusable random password — a real one is set later from the Client
 * Tracker detail page. Shared by the "Connect" button and the customer-
 * success crons, which need a users.id to hang surveys and updates on.
 */
export class ClientAccountError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClientAccountError";
    this.status = status;
  }
}

export async function ensureClientAccount(params: {
  email: string;
  name?: string | null;
  company?: string | null;
}): Promise<{ clientUserId: string; created: boolean }> {
  const email = params.email.trim().toLowerCase();
  const name = (params.name || "").trim().slice(0, 200);
  const company = (params.company || "").trim().slice(0, 200);
  if (!email || !email.includes("@")) {
    throw new ClientAccountError("A valid email is required.", 400);
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
      throw new ClientAccountError(
        "This email belongs to an admin account and can't be connected.",
        409
      );
    }
    return { clientUserId: existing.id, created: false };
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
    return { clientUserId: created.id, created: true };
  } catch (err) {
    // Unique-email race (double click / concurrent connect): fall back to
    // the row the other request created.
    const [raced] = await findExisting();
    if (raced?.role === "client") {
      return { clientUserId: raced.id, created: false };
    }
    throw err;
  }
}
