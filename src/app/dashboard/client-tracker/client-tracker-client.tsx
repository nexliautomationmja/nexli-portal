"use client";

import { useState, useEffect } from "react";
import { UsersIcon } from "@/components/ui/icons";
import { UtmBuilder } from "@/components/dashboard/utm-builder";
import { AdAnalyticsSection } from "./ad-analytics-section";

interface Kpis {
  totalClients: number;
  totalDeals: number;
  totalRevenue: number;
  totalMrr: number;
  totalOutstanding: number;
}

interface ClientRow {
  email: string;
  name: string;
  company: string | null;
  billingPlan: "monthly" | "annual" | null;
  signedAt: string | null;
  dealsCount: number;
  revenue: number;
  mrr: number;
  outstanding: number;
  lastPaymentAt: string | null;
  status: "active" | "signed";
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ClientTrackerClient() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    totalClients: 0,
    totalDeals: 0,
    totalRevenue: 0,
    totalMrr: 0,
    totalOutstanding: 0,
  });
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [hasDemo, setHasDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  function loadAll() {
    return Promise.all([
      fetch("/api/dashboard/client-tracker")
        .then((r) => r.json())
        .then((data) => {
          if (data.kpis) setKpis(data.kpis);
          setClients(data.clients || []);
        })
        .catch(() => setClients([])),
      fetch("/api/dashboard/demo-data")
        .then((r) => r.json())
        .then((data) => setHasDemo(Boolean(data.hasDemo)))
        .catch(() => {}),
    ]);
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDemo() {
    setDemoBusy(true);
    try {
      const res = await fetch("/api/dashboard/demo-data", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Demo seeding failed. Please try again.");
      }
      await loadAll();
    } finally {
      setDemoBusy(false);
    }
  }

  async function removeDemo() {
    setDemoBusy(true);
    try {
      await fetch("/api/dashboard/demo-data", { method: "DELETE" });
      await loadAll();
    } finally {
      setDemoBusy(false);
    }
  }

  const statCards = [
    { label: "Clients", value: String(kpis.totalClients) },
    { label: "Deals Closed", value: String(kpis.totalDeals) },
    { label: "Revenue", value: money(kpis.totalRevenue) },
    { label: "Active MRR", value: money(kpis.totalMrr) },
    { label: "Outstanding", value: money(kpis.totalOutstanding) },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
              Client Tracker
            </h1>
            {hasDemo && <span className="badge badge-amber">Demo data</span>}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Your book of business — signed engagements and paid invoices. See what deals are closing and how much.
          </p>
        </div>
        {!loading &&
          (hasDemo ? (
            <button
              onClick={removeDemo}
              disabled={demoBusy}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)] disabled:opacity-50"
              style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
            >
              {demoBusy ? "Removing…" : "Remove demo data"}
            </button>
          ) : (
            clients.length === 0 && (
              <button
                onClick={createDemo}
                disabled={demoBusy}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                {demoBusy ? "Creating…" : "Create demo clients ✨"}
              </button>
            )
          ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              {s.label}
            </p>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {loading ? "..." : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Client roster */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">Clients</p>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 w-10 h-10" style={{ color: "var(--text-muted)" }}>
              <UsersIcon className="w-10 h-10" />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              No clients yet
            </p>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
              A client appears here once they&apos;ve signed an engagement and paid their invoice.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Client", "Plan", "Signed", "Deals", "Revenue", "MRR", "Outstanding", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.email} className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {c.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {c.company || c.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {c.billingPlan ? (
                        <span className={`badge ${c.billingPlan === "annual" ? "badge-violet" : "badge-blue"}`}>
                          {c.billingPlan === "annual" ? "Annual" : "Monthly"}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatDate(c.signedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {c.dealsCount}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                      {money(c.revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {c.mrr > 0 ? `${money(c.mrr)}/mo` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: c.outstanding > 0 ? "#f43f5e" : "var(--text-muted)" }}>
                      {c.outstanding > 0 ? money(c.outstanding) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${c.status === "active" ? "badge-emerald" : "badge-gray"}`}>
                        {c.status === "active" ? "Active" : "Signed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UTM builder */}
      <UtmBuilder />

      {/* Ad analytics */}
      <div className="section-divider" />
      <AdAnalyticsSection />
    </div>
  );
}
