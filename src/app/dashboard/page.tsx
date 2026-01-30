import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SectionBadge } from "@/components/ui/section-badge";
import { StatCard } from "@/components/ui/stat-card";
import { GlassCard } from "@/components/ui/glass-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <SectionBadge>Dashboard</SectionBadge>
        <h1
          className="text-3xl md:text-4xl font-bold mt-4"
          style={{ color: "var(--text-main)" }}
        >
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Here&apos;s an overview of your website and automation performance.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value="--"
          delta="--"
          deltaType="neutral"
        />
        <StatCard
          label="Unique Visitors"
          value="--"
          delta="--"
          deltaType="neutral"
        />
        <StatCard
          label="New Leads"
          value="--"
          delta="--"
          deltaType="neutral"
        />
        <StatCard
          label="Automations Run"
          value="--"
          delta="--"
          deltaType="neutral"
        />
      </div>

      {/* Placeholder charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Website Traffic
          </h3>
          <div
            className="h-48 rounded-xl flex items-center justify-center border border-[var(--glass-border)]"
            style={{ background: "var(--glass-bg)" }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              Connect Vercel Analytics to view traffic data
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Lead Generation
          </h3>
          <div
            className="h-48 rounded-xl flex items-center justify-center border border-[var(--glass-border)]"
            style={{ background: "var(--glass-bg)" }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              Connect GoHighLevel to view lead data
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Recent activity placeholder */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3 border-b border-[var(--glass-border)] last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20" />
              <div className="flex-1">
                <div
                  className="h-3 w-32 rounded-full"
                  style={{ background: "var(--glass-border)" }}
                />
                <div
                  className="h-2 w-20 rounded-full mt-2"
                  style={{ background: "var(--glass-border)", opacity: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
