import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ClientAccountError, ensureClientAccount } from "@/lib/client-accounts";

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

  const email = typeof body.email === "string" ? body.email : "";
  const name = typeof body.name === "string" ? body.name : "";
  const company = typeof body.company === "string" ? body.company : "";

  try {
    const result = await ensureClientAccount({ email, name, company });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ClientAccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Connect dashboard failed:", err);
    return NextResponse.json(
      { error: "Couldn't connect the dashboard. Please try again." },
      { status: 500 }
    );
  }
}
