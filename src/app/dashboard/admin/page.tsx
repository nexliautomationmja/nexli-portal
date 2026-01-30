"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { compactNumber } from "@/lib/format";

interface ClientRow {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  websiteUrl: string | null;
  createdAt: string;
  active: boolean;
  pageViews30d: number;
}

interface AdminData {
  clients: ClientRow[];
  totalClients: number;
  activeSubscriptions: number;
  totalPageViews: number;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/admin/clients")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          Client Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Monitor all client websites and automation metrics from one view.
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={loading ? "..." : String(data?.totalClients ?? 0)}
          accent="blue"
        />
        <StatCard
          label="Active Subscriptions"
          value={loading ? "..." : String(data?.activeSubscriptions ?? 0)}
          accent="emerald"
        />
        <StatCard
          label="Total Page Views"
          value={loading ? "..." : compactNumber(data?.totalPageViews ?? 0)}
          delta="last 30 days"
          deltaType="neutral"
          accent="cyan"
        />
        <StatCard label="Total Leads" value="--" delta="GHL" deltaType="neutral" accent="teal" />
      </div>

      {/* Client list */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Clients
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl animate-pulse"
                style={{ background: "var(--glass-border)" }}
              />
            ))}
          </div>
        ) : !data?.clients.length ? (
          <div
            className="text-sm py-12 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            No clients yet. Clients are auto-created when they subscribe via
            Stripe.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--glass-border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Client
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Website
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Views (30d)
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/admin/clients/${client.id}`}
                        className="hover:text-blue-400 transition-colors"
                      >
                        <span
                          className="font-medium block"
                          style={{ color: "var(--text-main)" }}
                        >
                          {client.name || client.companyName || "Unnamed"}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {client.email}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-xs truncate max-w-[150px] inline-block"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {client.websiteUrl || "--"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${
                          client.active
                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {client.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 text-right font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {compactNumber(client.pageViews30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
