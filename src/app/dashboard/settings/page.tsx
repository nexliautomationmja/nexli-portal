import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { PasswordForm } from "@/components/dashboard/settings/password-form";
import { TrackingSnippet } from "@/components/dashboard/settings/tracking-snippet";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
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
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Profile
        </h3>
        <div className="space-y-3">
          <div>
            <span
              className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Name
            </span>
            <p className="text-sm" style={{ color: "var(--text-main)" }}>
              {session.user.name || "Not set"}
            </p>
          </div>
          <div>
            <span
              className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Email
            </span>
            <p className="text-sm" style={{ color: "var(--text-main)" }}>
              {session.user.email}
            </p>
          </div>
          <div>
            <span
              className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Role
            </span>
            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {session.user.role}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Change Password */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Change Password
        </h3>
        <PasswordForm />
      </GlassCard>

      {/* Tracking Snippet */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Tracking Script
        </h3>
        <TrackingSnippet clientId={session.user.id!} />
      </GlassCard>
    </div>
  );
}
