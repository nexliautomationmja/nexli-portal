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

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-main)" }}>
          Client Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Monitor all client websites and analytics from one view.
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Clients"
          value={loading ? "..." : String(data?.totalClients ?? 0)}
          accent="blue"
        />
        <StatCard
          label="Active Subs"
          value={loading ? "..." : String(data?.activeSubscriptions ?? 0)}
          accent="emerald"
        />
        <StatCard
          label="Total Leads"
          value={loading ? "..." : compactNumber(data?.totalLeads ?? 0)}
          delta="all businesses"
          deltaType="neutral"
          accent="cyan"
        />
        <StatCard
          label="Avg Leads / Biz"
          value={loading ? "..." : String(data?.avgLeadsPerBusiness ?? 0)}
          delta="30 days"
          deltaType="neutral"
          accent="teal"
        />
      </div>

      {/* Mobile client selector (shown below lg) */}
      <div className="lg:hidden mb-6">
        <select
          value={selectedClientId || ""}
          onChange={(e) => e.target.value && selectClient(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm font-medium border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50"
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
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{
                  background: "var(--glass-bg)",
                  color: "var(--text-main)",
                }}
              />
            </div>

            {/* Client cards */}
            <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl animate-pulse"
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
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
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
    </div>
  );
}
