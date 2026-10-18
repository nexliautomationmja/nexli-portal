"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { buildTrackingSnippet } from "@/lib/tracking-snippet";
import {
  SCALE_QUESTION_IDS,
  npsColor,
  scaleColor,
  scaleQuestionLabel,
  valueAnswerLabel,
  type SurveyAnswers,
} from "@/lib/survey-questions";
import { relativeDay, weekdayDate } from "@/lib/format";

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
  /** Campaign progress tracker; null when they have no DRS engagement (or GHL was down). */
  campaign: {
    launchedAt: string | null;
    leads: number;
    daysSinceLaunch: number;
    pipelineValueCents: number;
    avgEngagementCents: number;
    status: "not_launched" | "live";
    source: "ghl" | "notifications" | "none";
    computedAt: string;
  } | null;
  traffic: {
    pageViews30d: number;
    uniqueVisitors30d: number;
    daily: { date: string; pageViews: number; uniqueVisitors: number }[];
  };
  youCollect: {
    revenue: number;
    mrr: number;
    outstanding: number;
    adSpendCollected?: number;
  } | null;
  activity: {
    at: string;
    type: "payment" | "invoice" | "engagement" | "lead" | "portal_login";
    message: string;
  }[];
  surveys?: SurveyItem[];
  weeklyUpdates?: WeeklyUpdateItem[];
  /** Where things stand right now; null members when the success tables are unavailable. */
  status?: {
    update: UpdateStatusItem | null;
    nps: NpsStatusItem | null;
  };
}

interface SurveyItem {
  id: string;
  weekStart: string;
  /** NPS 0–10; null for legacy (pre-NPS) submissions and unanswered surveys. */
  npsScore: number | null;
  /** Legacy 1–5 confidence score from the old single-question survey. */
  legacyScore: number | null;
  /** 1–5 answers to the four rated questions. */
  answers: SurveyAnswers | null;
  valueAnswer: string | null;
  comment: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
}

interface UpdateStatusItem {
  lastSentAt: string | null;
  lastViewedAt: string | null;
  thisWeekStatus: "sent" | "draft" | null;
  daysSinceSent: number | null;
  state: "sent" | "due" | "overdue" | "never" | "pending";
}

interface NpsStatusItem {
  score: number | null;
  legacyScore: number | null;
  sentAt: string | null;
  viewedAt: string | null;
  answeredAt: string | null;
  expiresAt: string | null;
  state: "not_sent" | "awaiting" | "answered" | "expired";
}

const AMBER = "#f59e0b";

/** Survey link lapsed without an answer (helper keeps the clock out of render). */
function surveyExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt) && new Date(expiresAt as string).getTime() < Date.now();
}

interface WeeklyUpdateItem {
  id: string;
  weekStart: string;
  headline: string | null;
  body: string;
  adSpendCents: number | null;
  status: string;
  sentAt: string | null;
  viewedAt: string | null;
  updatedAt: string;
}

// Monday (UTC, YYYY-MM-DD) of the week containing `d` — mirrors
// weekStartOf() in src/lib/client-success-tables.ts for the week picker.
function mondayOf(d: Date = new Date()): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return day.toISOString().slice(0, 10);
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Legacy 1–5 confidence score → traffic light (old single-question survey). */
function legacyColor(score: number): string {
  return scaleColor(score);
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

function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  window.crypto.getRandomValues(bytes);
  let pw = "";
  for (const b of bytes) pw += alphabet[b % alphabet.length];
  return pw;
}

function ClientSetupPanel({
  client,
  onWebsiteSaved,
}: {
  client: DetailData["client"];
  onWebsiteSaved: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [url, setUrl] = useState(client.websiteUrl || "");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snippet = buildTrackingSnippet(client.id);

  function copy(text: string, done: (v: boolean) => void) {
    try {
      navigator.clipboard?.writeText(text);
      done(true);
      setTimeout(() => done(false), 2000);
    } catch {
      // Clipboard unavailable (non-secure context) — text stays selectable.
    }
  }

  async function patch(
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; websiteUrl?: string | null }> {
    const res = await fetch(`/api/dashboard/client-tracker/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      return { ok: false };
    }
    setError(null);
    return { ok: true, websiteUrl: data.websiteUrl ?? null };
  }

  async function saveUrl() {
    setUrlBusy(true);
    setUrlSaved(false);
    try {
      const result = await patch({ websiteUrl: url.trim() || null });
      if (result.ok) {
        // Use the server-normalized URL (https:// prepended etc.), not the raw input.
        const normalized = result.websiteUrl ?? null;
        setUrl(normalized || "");
        onWebsiteSaved(normalized);
        setUrlSaved(true);
        setTimeout(() => setUrlSaved(false), 2500);
      }
    } finally {
      setUrlBusy(false);
    }
  }

  async function savePassword() {
    if (!password) return;
    setPwBusy(true);
    try {
      const result = await patch({ newPassword: password });
      if (result.ok) setPwSaved(true);
    } finally {
      setPwBusy(false);
    }
  }

  const labelCls = "text-[10px] font-black uppercase tracking-[0.2em]";

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2">
          <span className="icon-chip icon-chip-teal w-7 h-7 text-sm">🔧</span>
          <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
            Client Setup
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            — tracking snippet, website &amp; portal login
          </span>
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5 border-t border-[var(--card-border)] pt-4">
          {/* Tracking snippet */}
          <div className="space-y-2">
            <p className={labelCls} style={{ color: "var(--text-muted)" }}>
              1 · Tracking snippet
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Paste this on their website (before <code>&lt;/body&gt;</code>) when you
              build it — every visit reports back to your portal under this client.
            </p>
            <div className="relative">
              <pre
                className="p-3 pr-20 rounded-xl border border-[var(--card-border)] text-xs overflow-x-auto"
                style={{ background: "var(--input-bg)", color: "var(--text-main)" }}
              >
                {snippet}
              </pre>
              <button
                onClick={() => copy(snippet, setSnippetCopied)}
                className="btn-primary absolute top-2 right-2 px-3 py-1.5 text-[10px] uppercase tracking-wider"
              >
                {snippetCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <p className={labelCls} style={{ color: "var(--text-muted)" }}>
              2 · Their website
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://theirfirm.com"
                className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-sm border border-[var(--card-border)]"
                style={{ background: "var(--input-bg)", color: "var(--text-main)" }}
              />
              <button
                onClick={saveUrl}
                disabled={urlBusy}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {urlBusy ? "Saving…" : urlSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
          </div>

          {/* Portal login */}
          <div className="space-y-2">
            <p className={labelCls} style={{ color: "var(--text-muted)" }}>
              3 · Their portal login
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Login email: <span className="font-semibold" style={{ color: "var(--text-main)" }}>{client.email}</span>
            </p>
            {!password ? (
              <button
                onClick={() => {
                  setPassword(generatePassword());
                  setPwSaved(false);
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                Generate new password
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code
                    className="px-3 py-2 rounded-lg text-sm border border-amber-400/30 bg-amber-400/[0.06] font-mono"
                    style={{ color: "var(--text-main)" }}
                  >
                    {password}
                  </code>
                  <button
                    onClick={() => copy(password, setPwCopied)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                    style={{ color: "var(--text-main)" }}
                  >
                    {pwCopied ? "Copied!" : "Copy"}
                  </button>
                  {!pwSaved ? (
                    <button
                      onClick={savePassword}
                      disabled={pwBusy}
                      className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {pwBusy ? "Setting…" : "Set as their password"}
                    </button>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-emerald-400">
                        Password set ✓
                      </span>
                      <button
                        onClick={() => {
                          setPassword(generatePassword());
                          setPwSaved(false);
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Generate another
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Copy it now — it won&apos;t be shown again. Share it with the client
                  when you hand over their dashboard.
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
        </div>
      )}
    </div>
  );
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

  const campaign = data.campaign;
  const campaignCard = campaign
    ? {
        label: "Leads since launch",
        value: String(campaign.leads),
        sub:
          campaign.status === "not_launched"
            ? "Not launched"
            : `${campaign.daysSinceLaunch} ${campaign.daysSinceLaunch === 1 ? "day" : "days"} live`,
        accent: campaign.status === "not_launched" ? "icon-chip-neutral" : "icon-chip-cyan",
        emoji: "🚀",
      }
    : null;

  const statCards: { label: string; value: string; sub?: string; accent: string; emoji: string }[] = [
    { label: "Their Revenue", value: money(theirBook.kpis.totalRevenue), accent: "icon-chip-emerald", emoji: "💰" },
    { label: "Their MRR", value: money(theirBook.kpis.totalMrr), accent: "icon-chip-cyan", emoji: "🔁" },
    { label: "Their Clients", value: String(theirBook.kpis.totalClients), accent: "icon-chip-violet", emoji: "🤝" },
    { label: "Leads (30d)", value: String(data.leads30d), accent: "icon-chip-amber", emoji: "🧲" },
    ...(campaignCard ? [campaignCard] : []),
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

      {/* Client setup: snippet, website, login */}
      <ClientSetupPanel
        client={client}
        onWebsiteSaved={(url) =>
          setData((prev) =>
            prev ? { ...prev, client: { ...prev.client, websiteUrl: url } } : prev
          )
        }
      />

      {/* Their KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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
            {s.sub && (
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                {s.sub}
              </p>
            )}
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
          {(youCollect.adSpendCollected ?? 0) > 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }} title="Ad budget passed through to ads — not counted in revenue">
              <span className="font-bold" style={{ color: "var(--text-main)" }}>
                {money(youCollect.adSpendCollected ?? 0)}
              </span>{" "}
              ad spend collected
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

      {/* Customer success: weekly update composer + pulse-check history */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <WeeklyUpdatePanel
          clientId={client.id}
          clientLabel={displayName}
          updates={data.weeklyUpdates || []}
          status={data.status?.update ?? null}
          onChange={(updates) => setData((prev) => (prev ? { ...prev, weeklyUpdates: updates } : prev))}
        />
        <CustomerSuccessPanel surveys={data.surveys || []} status={data.status?.nps ?? null} />
      </div>
    </div>
  );
}

// ── Weekly Update composer ───────────────────────────────

/**
 * Status line + badge for the Weekly Update panel header. Once Marcel sends
 * this week's update from the composer the server status is stale, so the
 * local `updates` list wins when it has a sent row for the current week.
 */
function updateHeaderStatus(
  status: UpdateStatusItem | null,
  updates: WeeklyUpdateItem[]
): { line: string | null; badge: { label: string; cls: string } } {
  const thisWeek = mondayOf();
  const sentThisWeek = updates.find((u) => u.weekStart === thisWeek && u.status === "sent" && u.sentAt);
  const lastSent =
    sentThisWeek ??
    updates
      .filter((u) => u.status === "sent" && u.sentAt)
      .sort((a, b) => (b.sentAt as string).localeCompare(a.sentAt as string))[0] ??
    null;
  const lastSentAt = lastSent?.sentAt ?? status?.lastSentAt ?? null;
  const lastViewedAt = lastSent ? lastSent.viewedAt : status?.lastViewedAt ?? null;

  const line = lastSentAt
    ? `Last sent ${weekdayDate(lastSentAt)} · ${relativeDay(lastSentAt)}${lastViewedAt ? " · opened" : " · not opened yet"}`
    : null;

  let state = status?.state ?? null;
  if (sentThisWeek) state = "sent";
  if (!state) return { line, badge: { label: "", cls: "" } };

  switch (state) {
    case "sent":
      return { line, badge: { label: "Sent this week ✓", cls: "badge-emerald" } };
    case "due":
      return { line, badge: { label: "Due now", cls: "badge-amber" } };
    case "overdue":
      return { line, badge: { label: "Overdue", cls: "badge-rose" } };
    case "never":
      return { line: line ?? "No weekly update has gone out yet", badge: { label: "Never sent", cls: "badge-rose" } };
    case "pending":
      return { line: line ?? "New client — first update isn't due yet", badge: { label: "New client", cls: "badge-gray" } };
  }
}

function WeeklyUpdatePanel({
  clientId,
  clientLabel,
  updates,
  status,
  onChange,
}: {
  clientId: string;
  clientLabel: string;
  updates: WeeklyUpdateItem[];
  status: UpdateStatusItem | null;
  onChange: (updates: WeeklyUpdateItem[]) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf());
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [adSpend, setAdSpend] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  const existingForWeek = updates.find((u) => u.weekStart === weekStart) || null;

  // Load the chosen week's note into the composer so Marcel edits in place.
  useEffect(() => {
    setMessage(null);
    if (existingForWeek) {
      setHeadline(existingForWeek.headline || "");
      setBody(existingForWeek.body);
      setAdSpend(
        existingForWeek.adSpendCents != null ? String(Math.round(existingForWeek.adSpendCents / 100)) : ""
      );
    } else {
      setHeadline("");
      setBody("");
      setAdSpend("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, existingForWeek?.id]);

  async function submit(action: "draft" | "send") {
    if (!body.trim()) {
      setMessage({ kind: "error", text: "Write the update first." });
      return;
    }
    if (action === "send" && !window.confirm(`Email this update to ${clientLabel} now?`)) return;
    setBusy(action);
    setMessage(null);
    try {
      const dollars = adSpend.trim() === "" ? null : Number(adSpend);
      const res = await fetch(`/api/dashboard/client-tracker/${clientId}/weekly-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          headline: headline.trim() || null,
          body,
          adSpendCents: dollars == null || Number.isNaN(dollars) ? null : Math.round(dollars * 100),
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error || "Couldn't save. Please try again." });
        return;
      }
      const saved = data.update as WeeklyUpdateItem;
      const next = [saved, ...updates.filter((u) => u.id !== saved.id)].sort((a, b) =>
        b.weekStart.localeCompare(a.weekStart)
      );
      onChange(next);
      if (data.warning) {
        setMessage({ kind: "warn", text: data.warning });
      } else {
        setMessage({
          kind: "ok",
          text: action === "send" ? `Sent to ${clientLabel}.` : "Draft saved.",
        });
      }
    } catch {
      setMessage({ kind: "error", text: "Couldn't save. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const textareaCls =
    "w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 resize-none transition-colors";

  const header = updateHeaderStatus(status, updates);

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-[var(--card-border)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-header mb-0">Weekly Update</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {header.line ?? "Emailed + shown on their Overview"}
          </p>
        </div>
        {header.badge.label && (
          <span className={`badge shrink-0 ${header.badge.cls}`}>{header.badge.label}</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Week of
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setWeekStart(mondayOf(new Date(`${v}T00:00:00Z`)));
              }}
              className="glass-input"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Ad budget deployed ($, optional)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={adSpend}
              onChange={(e) => setAdSpend(e.target.value)}
              placeholder="e.g. 2500"
              className="glass-input"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Headline (optional)
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value.slice(0, 200))}
            placeholder="e.g. New landing page live, 3 booked calls"
            className="glass-input"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            What the team worked on
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10_000))}
            placeholder={"What we did this week, what's next, anything we need from them.\n\nBlank lines become paragraphs."}
            className={`${textareaCls} h-36`}
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {existingForWeek?.status === "sent" && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This week&apos;s update was sent {shortDate(existingForWeek.sentAt)}
            {existingForWeek.viewedAt ? ` · opened ${shortDate(existingForWeek.viewedAt)}` : " · not opened yet"}.
            Sending again re-emails the edited version.
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)] disabled:opacity-50"
            style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
          >
            {busy === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => submit("send")}
            disabled={busy !== null}
            className="btn-primary px-5 py-2 text-sm"
          >
            {busy === "send" ? "Sending…" : "Send to client"}
          </button>
          {message && (
            <span
              className="text-xs font-medium"
              style={{
                color:
                  message.kind === "ok" ? "#10b981" : message.kind === "warn" ? "#f59e0b" : "#f43f5e",
              }}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>

      {updates.length > 0 && (
        <div className="border-t border-[var(--card-border)]">
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            History
          </p>
          <div className="divide-y divide-[var(--card-border)]">
            {updates.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setWeekStart(u.weekStart)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--input-bg)] ${
                  u.weekStart === weekStart ? "bg-[var(--input-bg)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                    {u.headline || `Week of ${weekLabel(u.weekStart)}`}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    Week of {weekLabel(u.weekStart)}
                    {u.adSpendCents ? ` · ${money(u.adSpendCents)} ads` : ""}
                    {u.status === "sent" ? ` · sent ${shortDate(u.sentAt)}` : ` · edited ${shortDate(u.updatedAt)}`}
                    {u.viewedAt ? " · opened" : ""}
                  </p>
                </div>
                <span className={`badge shrink-0 ${u.status === "sent" ? "badge-emerald" : "badge-gray"}`}>
                  {u.status === "sent" ? "Sent" : "Draft"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Customer Success (pulse-check history) ──────────────

function npsHeader(status: NpsStatusItem | null): { text: string; color: string; dot: string | null } {
  const muted = "var(--text-muted)";
  if (!status || status.state === "not_sent") return { text: "Not sent yet", color: muted, dot: null };
  if (status.state === "answered") {
    const when = status.answeredAt ? ` · answered ${relativeDay(status.answeredAt)}` : "";
    if (status.score != null) {
      const c = npsColor(status.score);
      return { text: `NPS ${status.score}${when}`, color: c, dot: c };
    }
    if (status.legacyScore != null) {
      return { text: `${status.legacyScore}/5 (legacy)${when}`, color: muted, dot: legacyColor(status.legacyScore) };
    }
    return { text: `Answered${when}`, color: muted, dot: null };
  }
  if (status.state === "expired") return { text: "Expired, no answer", color: AMBER, dot: AMBER };
  return {
    text: `Sent ${status.sentAt ? weekdayDate(status.sentAt) : ""} · not answered yet`.replace("  ", " "),
    color: muted,
    dot: null,
  };
}

function CustomerSuccessPanel({ surveys, status }: { surveys: SurveyItem[]; status: NpsStatusItem | null }) {
  const header = npsHeader(status);

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-[var(--card-border)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="section-header mb-0">Customer Success</p>
            <a
              href="/survey/preview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-cyan-400 hover:underline"
              title="Opens the exact page clients see (nothing is saved)"
            >
              Preview the survey ↗
            </a>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold mt-0.5" style={{ color: header.color }}>
            {header.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: header.dot }} />}
            {header.text}
          </p>
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          Every other Monday
        </span>
      </div>
      {surveys.length === 0 ? (
        <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          No responses yet — surveys go out every other Monday.
        </p>
      ) : (
        <div className="divide-y divide-[var(--card-border)]">
          {surveys.map((s) => {
            const answered = Boolean(s.submittedAt);
            const isNps = answered && s.npsScore != null;
            const isLegacy = answered && !isNps && s.legacyScore != null;
            const dot = isNps
              ? npsColor(s.npsScore as number)
              : isLegacy
                ? legacyColor(s.legacyScore as number)
                : "var(--card-border)";
            const expired = !answered && surveyExpired(s.expiresAt);
            const rated = SCALE_QUESTION_IDS.filter((id) => typeof s.answers?.[id] === "number");

            let headline: React.ReactNode;
            if (isNps) {
              headline = (
                <>
                  <span style={{ color: npsColor(s.npsScore as number) }}>NPS {s.npsScore}</span>
                  {s.valueAnswer && (
                    <span style={{ color: "var(--text-main)" }}> · Getting value: {valueAnswerLabel(s.valueAnswer)}</span>
                  )}
                </>
              );
            } else if (isLegacy) {
              headline = (
                <>
                  {s.legacyScore}/5 <span style={{ color: "var(--text-muted)" }}>(legacy)</span>
                  {s.valueAnswer && ` · Getting value: ${valueAnswerLabel(s.valueAnswer)}`}
                </>
              );
            } else if (answered) {
              headline = "Answered";
            } else if (!s.sentAt) {
              headline = "Not sent";
            } else {
              headline = expired ? "Expired · no answer" : "Awaiting answer";
            }

            const when = answered
              ? `answered ${shortDate(s.submittedAt)}`
              : s.sentAt
                ? `sent ${shortDate(s.sentAt)}${s.viewedAt ? " · opened" : ""}`
                : "not sent";

            return (
              <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-sm font-medium"
                      style={{ color: answered ? "var(--text-main)" : expired ? AMBER : "var(--text-muted)" }}
                    >
                      {headline}
                    </p>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {when}
                    </span>
                  </div>
                  {rated.length > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {rated.map((id, i) => (
                        <span key={id}>
                          {i > 0 && " · "}
                          {scaleQuestionLabel(id)}{" "}
                          <span className="font-semibold" style={{ color: scaleColor(s.answers?.[id] as number) }}>
                            {s.answers?.[id]}
                          </span>
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Week of {weekLabel(s.weekStart)}
                  </p>
                  {s.comment && (
                    <p className="mt-1.5 text-sm whitespace-pre-wrap" style={{ color: "var(--text-main)" }}>
                      &ldquo;{s.comment}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
