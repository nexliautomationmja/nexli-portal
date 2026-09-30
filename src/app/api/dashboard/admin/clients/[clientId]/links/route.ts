import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementSigners, users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { createPasswordSetupToken } from "@/lib/password-setup";
import { getEngageUrl } from "@/lib/engagements";
import { getPortalUrl } from "@/lib/foundation-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST → fresh onboarding links for an admin to hand to a client directly.
 *
 * Note: creating a set-password token invalidates any earlier unused token
 * for the user, including the one in the welcome email.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  try {
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        foundationAgreementEngagementId: users.foundationAgreementEngagementId,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role !== "client") {
      return NextResponse.json({ error: "Links can only be issued for client users" }, { status: 400 });
    }

    const { setupUrl, expiresAt } = await createPasswordSetupToken(user.id);

    let agreementUrl: string | null = null;
    if (user.foundationAgreementEngagementId) {
      const [signer] = await db
        .select({ token: engagementSigners.token })
        .from(engagementSigners)
        .where(
          and(
            eq(engagementSigners.engagementId, user.foundationAgreementEngagementId),
            eq(engagementSigners.order, 1),
            ne(engagementSigners.status, "signed")
          )
        )
        .limit(1);
      if (signer) agreementUrl = getEngageUrl(signer.token);
    }

    return NextResponse.json({
      setupUrl,
      setupExpiresAt: expiresAt.toISOString(),
      agreementUrl,
      portalUrl: `${getPortalUrl()}/portal`,
    });
  } catch (err) {
    console.error("[admin/clients/links] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create links" },
      { status: 500 }
    );
  }
}
