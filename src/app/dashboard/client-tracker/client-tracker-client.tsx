"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UsersIcon } from "@/components/ui/icons";
import { npsColor } from "@/lib/survey-questions";
import { relativeDay, weekdayDate } from "@/lib/format";
import { UtmBuilder } from "@/components/dashboard/utm-builder";
import { AdAnalyticsSection } from "./ad-analytics-section";

interface Kpis {
  totalClients: number;
  totalDeals: number;
  totalRevenue: number;
  totalMrr: number;
  totalOutstanding: number;
  totalClientRevenue?: number;
  totalAdSpend?: number;
  /** Admin only: linked clients whose weekly update is due, overdue or never sent. */
  updatesDue?: number;
}

/** Newest SENT biweekly NPS survey for a linked client (null when unlinked). */
interface NpsStatus {
  score: number | null;
  legacyScore: number | null;
  sentAt: string | null;
  answeredAt: string | null;
  expiresAt: string | null;
  state: "not_sent" | "awaiting" | "answered" | "expired";
}

/** Weekly update cadence for a linked client (null when unlinked). */
interface UpdateStatus {
  lastSentAt: string | null;
  lastViewedAt: string | null;
  daysSinceSent: number | null;
  state: "sent" | "due" | "overdue" | "never" | "pending";
}

interface ClientRow {
  email: string;
  name: string;
  company: string | null;
  billingPlan: "monthly" | "annual" | "enterprise" | null;
  signedAt: string | null;
  startDate: string | null;
  termEnd?: string | null;
  dealsCount: number;
  revenue: number;
  adSpendCollected?: number;
  mrr: number;
  outstanding: number;
  lastPaymentAt: string | null;
  status: "active" | "signed";
  clientUserId?: string | null;
  websiteUrl?: string | null;
  theirRevenue?: number | null;
  nps?: NpsStatus | null;
  update?: UpdateStatus | null;
}

const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const EMERALD = "#10b981";

function NpsCell({ nps }: { nps: NpsStatus | null | undefined }) {
  const muted = { color: "var(--text-muted)" };
  if (!nps || nps.state === "not_sent") {
    return (
      <span className="text-sm" style={muted} title="No survey sent yet — surveys go out every other Monday">
        —
      </span>
    );
  }
  if (nps.state === "answered") {
    const when = nps.answeredAt ? `answered ${relativeDay(nps.answeredAt)}` : "answered";
    if (nps.score != null) {
      return (
        <span
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: "var(--text-main)" }}
          title={`NPS ${nps.score}/10 · ${when}`}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: npsColor(nps.score) }} />
          {nps.score}
        </span>
      );
    }
    if (nps.legacyScore != null) {
      return (
        <span className="text-sm" style={muted} title={`Legacy 1–5 score · ${when}`}>
          {nps.legacyScore}/5
        </span>
      );
    }
    return (
      <span className="text-sm" style={muted} title={when}>
        Answered
      </span>
    );
  }
  if (nps.state === "expired") {
    return (
      <span
        className="text-xs font-medium"
        style={{ color: AMBER }}
        title={nps.sentAt ? `Sent ${weekdayDate(nps.sentAt)} · link expired without a response` : "Link expired without a response"}
      >
        Expired · no answer
      </span>
    );
  }
  // awaiting
  return (
    <span
      className="text-xs"
      style={muted}
      title={nps.expiresAt ? `Link open until ${weekdayDate(nps.expiresAt)}` : "Waiting for a response"}
    >
      {nps.sentAt ? `Sent ${weekdayDate(nps.sentAt).split(" ")[0]}` : "Sent"} · awaiting
    </span>
  );
}

function UpdateCell({ update }: { update: UpdateStatus | null | undefined }) {
  const muted = { color: "var(--text-muted)" };
  if (!update) {
    return (
      <span className="text-sm" style={muted}>
        —
      </span>
    );
  }
  switch (update.state) {
    case "sent":
      return (
        <span
          className="text-xs font-medium"
          style={{ color: EMERALD }}
          title={update.lastSentAt ? `Last update sent ${weekdayDate(update.lastSentAt)}` : undefined}
        >
          {update.lastSentAt ? `Sent ${relativeDay(update.lastSentAt)}` : "Sent"}
          {update.lastViewedAt && (
            <span className="ml-1 font-normal" style={muted} title={`Opened ${relativeDay(update.lastViewedAt)}`}>
              · opened
            </span>
          )}
        </span>
      );
    case "due":
      return (
        <span className="text-xs font-semibold" style={{ color: AMBER }} title="It's been a week — send this week's update">
          Due · {update.daysSinceSent ?? 7}d since last
        </span>
      );
    case "overdue":
      return (
        <span className="text-xs font-semibold" style={{ color: ROSE }} title="More than 10 days since the last update">
          Overdue · {update.daysSinceSent ?? "10+"}d
        </span>
      );
    case "never":
      return (
        <span className="text-xs font-semibold" style={{ color: ROSE }} title="This client has never received a weekly update">
          Never sent
        </span>
      );
    case "pending":
      return (
        <span className="text-xs" style={muted} title="Started less than a week ago — first update isn't due yet">
          New client
        </span>
      );
  }
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    totalClients: 0,
    totalDeals: 0,
    totalRevenue: 0,
    totalMrr: 0,
    totalOutstanding: 0,
    totalClientRevenue: 0,
  });
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [dueClients, setDueClients] = useState<{ name: string; clientUserId: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasDemo, setHasDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  function loadAll() {
    return Promise.all([
      fetch("/api/dashboard/client-tracker")
        .then((r) => r.json())
        .then((data) => {
          if (data.kpis) setKpis(data.kpis);
          setClients(data.clients || []);
          setDueClients(data.dueClients || []);
          setIsAdmin(Boolean(data.isAdmin));
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

  async function connectDashboard(c: ClientRow) {
    setConnecting(c.email);
    try {
      const res = await fetch("/api/dashboard/client-tracker/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c.email, name: c.name, company: c.company }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Couldn't connect the dashboard. Please try again.");
        return;
      }
      await loadAll();
    } finally {
      setConnecting(null);
    }
  }

  const statCards = [
    { label: "Clients", value: String(kpis.totalClients) },
    { label: "Deals Closed", value: String(kpis.totalDeals) },
    ...(isAdmin
      ? [{ label: "Clients' Revenue", value: money(kpis.totalClientRevenue || 0) }]
      : []),
    { label: "You Collected", value: money(kpis.totalRevenue) },
    { label: "Ad Spend Collected", value: money(kpis.totalAdSpend || 0) },
    { label: "Active MRR", value: money(kpis.totalMrr) },
    { label: "Outstanding", value: money(kpis.totalOutstanding) },
  ];
  const statGridCls =
    statCards.length >= 7
      ? "md:grid-cols-4 lg:grid-cols-7"
      : statCards.length === 6
        ? "md:grid-cols-3 lg:grid-cols-6"
        : "md:grid-cols-5";

  // Keep in sync with the <td> sequence in the table body below.
  const headers = [
    "Client",
    "Plan",
    "Started",
    "Term Ends",
    "Deals",
    ...(isAdmin ? ["Their Revenue"] : []),
    "You Collect",
    "Ad Spend",
    "Your MRR",
    "Outstanding",
    ...(isAdmin ? ["NPS", "Update"] : []),
    "Status",
  ];

  const updatesDue = kpis.updatesDue || 0;

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
            Your book of business — and what each client&apos;s own dashboard is producing. Click a connected client to see inside.
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
      <div className={`grid grid-cols-2 gap-4 ${statGridCls}`}>
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

      {/* Weekly updates due — admin only, never dismissable */}
      {isAdmin && !loading && updatesDue > 0 && (
        <div
          className="rounded-xl border px-4 py-3 text-sm flex items-start gap-3"
          style={{ borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.08)" }}
          role="status"
        >
          <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: AMBER }} />
          <p style={{ color: "var(--text-main)" }}>
            <span className="font-semibold" style={{ color: AMBER }}>
              {updatesDue} weekly update{updatesDue === 1 ? "" : "s"} due
            </span>
            {dueClients.length > 0 && (
              <>
                {" — "}
                {dueClients.map((d, i) => (
                  <span key={d.clientUserId}>
                    {i > 0 && ", "}
                    <Link
                      href={`/dashboard/client-tracker/${d.clientUserId}`}
                      className="font-medium underline-offset-2 hover:underline"
                      style={{ color: "var(--text-main)" }}
                    >
                      {d.name}
                    </Link>
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
      )}

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
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const linked = Boolean(c.clientUserId);
                  return (
                    <tr
                      key={c.email}
                      onClick={() => {
                        if (linked) router.push(`/dashboard/client-tracker/${c.clientUserId}`);
                      }}
                      className={`border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors ${linked ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--text-main)" }}>
                          {c.name}
                          {linked && (
                            <span className="text-[10px] font-bold text-cyan-400" title="Dashboard connected — click to view">
                              ↗
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {c.company || c.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {c.billingPlan ? (
                          <span
                            className={`badge ${
                              c.billingPlan === "enterprise"
                                ? "badge-amber"
                                : c.billingPlan === "annual"
                                  ? "badge-violet"
                                  : "badge-blue"
                            }`}
                          >
                            {c.billingPlan === "enterprise"
                              ? "Enterprise"
                              : c.billingPlan === "annual"
                                ? "Annual"
                                : "Monthly"}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-main)" }} title="Day the client started with you (engagement execution date)">
                        {formatDate(c.startDate ?? c.signedAt)}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--text-muted)" }}
                        title="End of the current engagement term"
                      >
                        {formatDate(c.termEnd ?? null)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {c.dealsCount}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {linked ? (
                            <span className="text-sm font-semibold text-cyan-400">
                              {money(c.theirRevenue || 0)}
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                connectDashboard(c);
                              }}
                              disabled={connecting === c.email}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 transition-colors disabled:opacity-50"
                            >
                              {connecting === c.email ? "Connecting…" : "Connect"}
                            </button>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                        {money(c.revenue)}
                      </td>
                      <td
                        className="px-4 py-3 text-sm"
                        style={{ color: "var(--text-muted)" }}
                        title="Ad budget collected from this client (passed through to ads, not revenue)"
                      >
                        {c.adSpendCollected && c.adSpendCollected > 0 ? money(c.adSpendCollected) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {c.mrr > 0 ? `${money(c.mrr)}/mo` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: c.outstanding > 0 ? "#f43f5e" : "var(--text-muted)" }}>
                        {c.outstanding > 0 ? money(c.outstanding) : "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <NpsCell nps={linked ? c.nps : null} />
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <UpdateCell update={linked ? c.update : null} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`badge ${c.status === "active" ? "badge-emerald" : "badge-gray"}`}>
                          {c.status === "active" ? "Active" : "Signed"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
