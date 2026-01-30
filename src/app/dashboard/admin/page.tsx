import { SectionBadge } from "@/components/ui/section-badge";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <SectionBadge>Admin</SectionBadge>
        <h1
          className="text-3xl md:text-4xl font-bold mt-4"
          style={{ color: "var(--text-main)" }}
        >
          Client Overview
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Monitor all client websites and automation metrics from one view.
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value="--" />
        <StatCard label="Active Subscriptions" value="--" />
        <StatCard label="Total Page Views" value="--" />
        <StatCard label="Total Leads" value="--" />
      </div>

      {/* Client list placeholder */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Clients
        </h3>

        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 pb-3 border-b border-[var(--glass-border)]">
          {["Client", "Website", "Status", "Leads"].map((col) => (
            <span
              key={col}
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Placeholder rows */}
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 py-4 border-b border-[var(--glass-border)] last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20" />
                <div
                  className="h-3 w-24 rounded-full"
                  style={{ background: "var(--glass-border)" }}
                />
              </div>
              <div
                className="h-3 w-20 rounded-full self-center"
                style={{ background: "var(--glass-border)", opacity: 0.5 }}
              />
              <div className="self-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] bg-green-500/10 border border-green-500/20 text-green-400">
                  Active
                </span>
              </div>
              <div
                className="h-3 w-8 rounded-full self-center"
                style={{ background: "var(--glass-border)", opacity: 0.5 }}
              />
            </div>
          ))}
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Client data will populate once accounts are created via Stripe
        </p>
      </GlassCard>
    </div>
  );
}
