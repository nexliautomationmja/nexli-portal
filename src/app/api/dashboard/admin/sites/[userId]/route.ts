import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  generateSiteForUser,
  getFirmSiteByOwner,
  getIntakeForUser,
  publishFirmSite,
  toFirmSiteSummary,
  unpublishFirmSite,
  updateFirmSite,
  type FirmSiteRow,
} from "@/lib/firm-sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ userId: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

function payload(row: FirmSiteRow | null) {
  return { site: toFirmSiteSummary(row), config: row?.config ?? null };
}

function handleError(where: string, err: unknown) {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: "Validation failed", errors: err.errors }, { status: 422 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  console.error(`[admin/sites ${where}] error:`, err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Request failed" },
    { status: 500 }
  );
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  try {
    const [user] = await db
      .select({ id: users.id, email: users.email, companyName: users.companyName, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [row, found] = await Promise.all([
      getFirmSiteByOwner(userId),
      getIntakeForUser(user.email),
    ]);

    return NextResponse.json({
      ...payload(row),
      intake: found?.intake ?? null,
      hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      user: { id: user.id, email: user.email, firmName: user.companyName || user.name || null },
    });
  } catch (err) {
    return handleError("GET", err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  let body: { config?: unknown; domain?: unknown };
  try {
    body = (await req.json()) as { config?: unknown; domain?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.config === undefined && body.domain === undefined) {
    return NextResponse.json({ error: "Provide config and/or domain" }, { status: 400 });
  }

  try {
    const row = await updateFirmSite(userId, { config: body.config, domain: body.domain });
    return NextResponse.json(payload(row));
  } catch (err) {
    return handleError("PATCH", err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  let body: { action?: unknown };
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body?.action;
  if (action !== "generate" && action !== "publish" && action !== "unpublish") {
    return NextResponse.json(
      { error: "action must be 'generate', 'publish' or 'unpublish'" },
      { status: 400 }
    );
  }

  try {
    const row =
      action === "generate"
        ? await generateSiteForUser(userId)
        : action === "publish"
          ? await publishFirmSite(userId)
          : await unpublishFirmSite(userId);
    return NextResponse.json(payload(row));
  } catch (err) {
    return handleError(`POST ${action}`, err);
  }
}
