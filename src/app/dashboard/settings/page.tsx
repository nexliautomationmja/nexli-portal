import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, accountingConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass-card";
import { PasswordForm } from "@/components/dashboard/settings/password-form";
import { GHLConnection } from "@/components/dashboard/settings/ghl-connection";
import { TrackingSnippet } from "@/components/dashboard/settings/tracking-snippet";
import { AccountingConnections } from "@/components/dashboard/settings/accounting-connections";
import { EmailLog } from "@/components/dashboard/settings/email-log";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: connectError } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [user] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, session.user.id!));

  const acctConnections = await db
    .select()
    .from(accountingConnections)
    .where(eq(accountingConnections.userId, session.user.id!));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-main)" }}
        >
          Account Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your profile, security, and tracking configuration.
        </p>
      </div>

      {/* Profile Info */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          Profile
        </h3>
        <div className="space-y-4">
          <div>
            <span className="block section-header">
              Name
            </span>
            <p className="text-sm" style={{ color: "var(--text-main)" }}>
              {session.user.name || "Not set"}
            </p>
          </div>
          <div>
            <span className="block section-header">
              Email
            </span>
            <p className="text-sm" style={{ color: "var(--text-main)" }}>
              {session.user.email}
            </p>
          </div>
          <div>
            <span className="block section-header">
              Role
            </span>
            <span className="badge badge-blue uppercase">
              {session.user.role}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Change Password */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          Change Password
        </h3>
        <PasswordForm />
      </GlassCard>

      {/* Accounting Software */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          Accounting Software
        </h3>
        <AccountingConnections
          connections={acctConnections.map((c) => ({
            id: c.id,
            provider: c.provider,
            companyName: c.companyName,
            connectedAt: c.connectedAt.toISOString(),
            lastSyncAt: c.lastSyncAt?.toISOString() || null,
          }))}
          error={connectError}
        />
      </GlassCard>

      {/* GoHighLevel Integration */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          GoHighLevel
        </h3>
        <GHLConnection currentLocationId={user?.ghlLocationId ?? null} />
      </GlassCard>

      {/* Tracking Snippet */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          Tracking Script
        </h3>
        <TrackingSnippet clientId={session.user.id!} />
      </GlassCard>

      {/* Email History */}
      <GlassCard>
        <h3
          className="text-sm font-semibold mb-5"
          style={{ color: "var(--text-main)" }}
        >
          Email History
        </h3>
        <EmailLog />
      </GlassCard>
    </div>
  );
}
