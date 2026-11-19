import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { firmStatements } from "@/lib/performance/service";

/**
 * A client firm's own Performance Pay statements (Nov 19 2026 pricing): the
 * months Nexli has sent or closed, each with its client-by-client list. The
 * emailed invoice page only shows totals; the names stay behind the login.
 * Empty for anyone not on that pricing.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ statements: await firmStatements(session.user.id) });
  } catch (err) {
    console.error("[performance] firm statements failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ statements: [] });
  }
}
