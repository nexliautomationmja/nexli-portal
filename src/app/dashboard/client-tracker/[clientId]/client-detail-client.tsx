"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DetailData {
  client: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    websiteUrl: string | null;
    lastLoginAt: string | null;
  };
  theirBook: {
    kpis: {
      totalClients: number;
      totalDeals: number;
      totalRevenue: number;
      totalMrr: number;
      totalOutstanding: number;
    };
    topClients: {
      email: string;
      name: string;
      company: string | null;
      revenue: number;
      mrr: number;
      lastPaymentAt: string | null;
    }[];
  };
  leads30d: number;
  traffic: {
    pageViews30d: number;
    uniqueVisitors30d: number;
    daily: { date: string; pageViews: number; uniqueVisitors: number }[];
  };
  youCollect: { revenue: number; mrr: number; outstanding: number } | null;
  activity: {
    at: string;
    type: "payment" | "invoice" | "engagement" | "lead" | "portal_login";
    message: string;
  }[];
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTIVITY_META: Record<DetailData["activity"][number]["type"], { emoji: string; accent: string }> = {
  payment: { emoji: "💸", accent: "icon-chip-emerald" },
  invoice: { emoji: "🧾", accent: "icon-chip-blue" },
  engagement: { emoji: "✍️", accent: "icon-chip-violet" },
  lead: { emoji: "🧲", accent: "icon-chip-amber" },
  portal_login: { emoji: "🔑", accent: "icon-chip-cyan" },
};

export function ClientDetailClient({ clientId }: { clientId: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/client-tracker/${clientId}`)
      .then((r) => {
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      })
      .then(setData)
      .catch(() => setErrored(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }
  if (errored || !data) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
          Couldn&apos;t load this client&apos;s dashboard.
        </p>
        <Link href="/dashboard/client-tracker" className="text-sm text-cyan-400 font-semibold">
          ← Back to Client Tracker
        </Link>
      </div>
    );
  }

  const { client, theirBook, traffic, youCollect, activity } = data;
  const displayName = client.name || client.email.split("@")[0];

  const statCards = [
    { label: "Their Revenue", value: money(theirBook.kpis.totalRevenue), accent: "icon-chip-emerald", emoji: "💰" },
    { label: "Their MRR", value: money(theirBook.kpis.totalMrr), accent: "icon-chip-cyan", emoji: "🔁" },
    { label: "Their Clients", value: String(theirBook.kpis.totalClients), accent: "icon-chip-violet", emoji: "🤝" },
    { label: "Leads (30d)", value: String(data.leads30d), accent: "icon-chip-amber", emoji: "🧲" },
    { label: "Site Visitors (30d)", value: traffic.uniqueVisitors30d.toLocaleString("en-US"), accent: "icon-chip-blue", emoji: "🌐" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/dashboard/client-tracker"
          className="text-xs font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          ← Client Tracker
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
              {displayName}
              {client.company ? ` · ${client.company}` : ""}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Inside their dashboard — what their Digital Rainmaker System is producing.
              {client.websiteUrl && (
                <>
                  {" "}
                  <a
                    href={client.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 font-semibold"
                  >
                    {client.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </p>
          </div>
          <Link
            href={`/dashboard/admin?client=${client.id}`}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)]"
            style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
          >
            Full analytics →
          </Link>
        </div>
      </div>

      {/* Their KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <div key={s.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`icon-chip icon-chip-float w-7 h-7 text-sm ${s.accent}`}
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                {s.emoji}
              </span>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </p>
            </div>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* What you collect from them */}
      {youCollect && (
        <div className="glass-card p-4 flex items-center gap-6 flex-wrap">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Your side
          </p>
          <p className="text-sm" style={{ color: "var(--text-main)" }}>
            <span className="font-bold">{money(youCollect.revenue)}</span> collected from{" "}
            {displayName}
          </p>
          {youCollect.mrr > 0 && (
            <p className="text-sm" style={{ color: "var(--text-main)" }}>
              <span className="font-bold">{money(youCollect.mrr)}/mo</span> recurring
            </p>
          )}
          {youCollect.outstanding > 0 && (
            <p className="text-sm text-rose-400 font-semibold">
              {money(youCollect.outstanding)} outstanding
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Their top clients */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--card-border)]">
            <p className="section-header mb-0">Their Book of Business</p>
          </div>
          {theirBook.topClients.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              No signed-and-paid clients in their dashboard yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {theirBook.topClients.map((c) => (
                <div key={c.email} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                      {c.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {c.company || c.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                      {money(c.revenue)}
                    </p>
                    {c.mrr > 0 && (
                      <p className="text-xs text-cyan-400">{money(c.mrr)}/mo</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
            <p className="section-header mb-0">Dashboard Activity</p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {traffic.pageViews30d.toLocaleString("en-US")} site views · 30d
            </span>
          </div>
          {activity.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              No activity in their dashboard yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {activity.map((a, i) => {
                const meta = ACTIVITY_META[a.type];
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <span className={`icon-chip w-7 h-7 text-sm shrink-0 ${meta.accent}`}>
                      {meta.emoji}
                    </span>
                    <p className="text-sm flex-1 min-w-0" style={{ color: "var(--text-main)" }}>
                      {a.message}
                    </p>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {timeAgo(a.at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
