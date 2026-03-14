"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { ClientListCard } from "@/components/dashboard/admin/client-list-card";
import { ClientDetailPanel } from "@/components/dashboard/admin/client-detail-panel";
import { compactNumber } from "@/lib/format";

interface ClientRow {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  websiteUrl: string | null;
  ghlLocationId: string | null;
  createdAt: string;
  active: boolean;
  pageViews30d: number;
  uniqueVisitors30d: number;
}

interface AdminData {
  clients: ClientRow[];
  totalClients: number;
  activeSubscriptions: number;
  totalPageViews: number;
  totalUniqueVisitors: number;
  totalLeads: number;
  avgLeadsPerBusiness: number;
}

function SearchIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

interface PortalSession {
  id: string;
  email: string;
  clientName: string | null;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface PortalSessionsData {
  stats: { totalActive: number; uniqueClients7d: number };
  sessions: PortalSession[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [portalData, setPortalData] = useState<PortalSessionsData | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedClientId = searchParams.get("client");

  useEffect(() => {
    fetch("/api/dashboard/admin/clients")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    fetch("/api/dashboard/portal-sessions")
      .then((r) => r.json())
      .then(setPortalData)
      .catch(() => setPortalData(null))
      .finally(() => setPortalLoading(false));
  }, []);

  function selectClient(clientId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("client", clientId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const selectedClient = data?.clients.find((c) => c.id === selectedClientId) ?? null;

  const filteredClients =
    data?.clients.filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.companyName?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Client Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Monitor all client websites and analytics from one view.
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Clients"
          value={loading ? "..." : String(data?.totalClients ?? 0)}
        />
        <StatCard
          label="Active Subs"
          value={loading ? "..." : String(data?.activeSubscriptions ?? 0)}
        />
        <StatCard
          label="Total Leads"
          value={loading ? "..." : compactNumber(data?.totalLeads ?? 0)}
          delta="all businesses"
          deltaType="neutral"
        />
        <StatCard
          label="Avg Leads / Biz"
          value={loading ? "..." : String(data?.avgLeadsPerBusiness ?? 0)}
          delta="30 days"
          deltaType="neutral"
        />
      </div>

      {/* Mobile client selector (shown below lg) */}
      <div className="lg:hidden mb-6">
        <select
          value={selectedClientId || ""}
          onChange={(e) => e.target.value && selectClient(e.target.value)}
          className="w-full px-4 py-3 rounded-lg text-sm font-medium border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50"
          style={{
            background: "var(--glass-bg)",
            color: "var(--text-main)",
          }}
        >
          <option value="">Select a client...</option>
          {(data?.clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName || c.name || c.email}
            </option>
          ))}
        </select>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Client list (hidden on mobile — replaced by dropdown above) */}
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
          <GlassCard>
            {/* Search input */}
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-xs border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{
                  background: "var(--glass-bg)",
                  color: "var(--text-main)",
                }}
              />
            </div>

            {/* Client cards */}
            <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 no-scrollbar">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-lg animate-pulse"
                    style={{ background: "var(--glass-border)" }}
                  />
                ))
              ) : filteredClients.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
                  {search ? "No clients match your search." : "No clients yet."}
                </p>
              ) : (
                filteredClients.map((client) => (
                  <ClientListCard
                    key={client.id}
                    client={client}
                    isSelected={client.id === selectedClientId}
                    onClick={() => selectClient(client.id)}
                  />
                ))
              )}
            </div>
          </GlassCard>
        </aside>

        {/* RIGHT: Detail panel */}
        <main className="lg:col-span-8 xl:col-span-9">
          {selectedClient ? (
            <ClientDetailPanel client={selectedClient} />
          ) : (
            <GlassCard>
              <div className="py-24 text-center">
                <div
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(6,182,212,0.1))" }}
                >
                  <SearchIcon className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                  Select a client
                </p>
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  Choose a client from the list to view their analytics dashboard.
                </p>
              </div>
            </GlassCard>
          )}
        </main>
      </div>

      {/* Portal Sessions */}
      <div className="mt-8">
        <p className="section-header">Portal Sessions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Active Sessions"
            value={portalLoading ? "..." : String(portalData?.stats.totalActive ?? 0)}
          />
          <StatCard
            label="Unique Clients"
            value={portalLoading ? "..." : String(portalData?.stats.uniqueClients7d ?? 0)}
            delta="7 days"
            deltaType="neutral"
          />
        </div>

        <GlassCard>
          {portalLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !portalData || portalData.sessions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No portal sessions yet. Clients will appear here when they sign in via magic link.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Signed In</th>
                    <th>Expires</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {portalData.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                          {s.clientName || "—"}
                        </p>
                      </td>
                      <td>
                        <p className="text-sm" style={{ color: "var(--text-main)" }}>
                          {s.email}
                        </p>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {timeAgo(s.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {new Date(s.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.isActive ? "badge-emerald" : "badge-gray"}`}>
                          {s.isActive ? "Active" : "Expired"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
