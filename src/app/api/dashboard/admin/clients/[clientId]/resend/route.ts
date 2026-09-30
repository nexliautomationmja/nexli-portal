import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resendFoundationEmail, type ResendWhat } from "@/lib/provision-firm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  let body: { what?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const what = body?.what;
  if (what !== "welcome" && what !== "agreement") {
    return NextResponse.json(
      { error: "what must be 'welcome' or 'agreement'" },
      { status: 400 }
    );
  }

  try {
    const result = await resendFoundationEmail(clientId, what as ResendWhat);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    console.error("[admin/clients/resend] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resend failed" },
      { status: 500 }
    );
  }
}
