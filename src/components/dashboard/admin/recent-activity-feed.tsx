"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface PageViewEvent {
  id: string;
  pageUrl: string;
  referrer: string | null;
  deviceType: string | null;
  country: string | null;
  createdAt: string;
}

interface LeadEvent {
  id: string;
  leadName: string | null;
  leadEmail: string | null;
  source: string | null;
  createdAt: string;
}

interface RecentActivityFeedProps {
  recentPages: PageViewEvent[];
  recentLeads: LeadEvent[];
  loading: boolean;
}

type ActivityItem = {
  id: string;
  type: "pageView" | "lead";
  title: string;
  subtitle: string;
  createdAt: string;
  dotColor: string;
};

function EyeSmall({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UserPlusSmall({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function extractPath(url: string): string {
  try {
    const u = new URL(url, "https://x");
    return u.pathname || "/";
  } catch {
    return url;
  }
}

const filters = ["All", "Page Views", "Leads"] as const;

export function RecentActivityFeed({ recentPages, recentLeads, loading }: RecentActivityFeedProps) {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const allItems: ActivityItem[] = [
    ...recentPages.map((p) => ({
      id: p.id,
      type: "pageView" as const,
      title: extractPath(p.pageUrl),
      subtitle: [p.deviceType, p.country].filter(Boolean).join(" · ") || "Page view",
      createdAt: p.createdAt,
      dotColor: "#10B981",
    })),
    ...recentLeads.map((l) => ({
      id: l.id,
      type: "lead" as const,
      title: l.leadName || l.leadEmail || "New Lead",
      subtitle: l.source || "Unknown source",
      createdAt: l.createdAt,
      dotColor: "#3B82F6",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered =
    activeFilter === "All"
      ? allItems
      : activeFilter === "Page Views"
        ? allItems.filter((i) => i.type === "pageView")
        : allItems.filter((i) => i.type === "lead");

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          Recent Activity
        </h3>
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                activeFilter === f
                  ? "text-white"
                  : "hover:bg-[var(--glass-border)]"
              }`}
              style={{
                color: activeFilter === f ? undefined : "var(--text-muted)",
                background:
                  activeFilter === f
                    ? "linear-gradient(135deg, rgba(37,99,235,0.4), rgba(6,182,212,0.4))"
                    : undefined,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
          No activity yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl border border-[var(--glass-border)] hover:border-blue-500/20 transition-all duration-200 flex items-center gap-3"
              style={{ background: "var(--glass-bg)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${item.dotColor}15` }}
              >
                {item.type === "pageView" ? (
                  <EyeSmall className="w-3.5 h-3.5" style={{ color: item.dotColor }} />
                ) : (
                  <UserPlusSmall className="w-3.5 h-3.5" style={{ color: item.dotColor }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-main)" }}>
                  {item.title}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  {item.subtitle} · {timeAgo(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
