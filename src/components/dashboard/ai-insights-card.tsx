"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { useInsights } from "@/lib/hooks/use-insights";

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface AIInsightsCardProps {
  range: string;
  clientId?: string;
}

export function AIInsightsCard({ range, clientId }: AIInsightsCardProps) {
  const { data, loading, refresh } = useInsights(range, clientId);
  const [cooldown, setCooldown] = useState(false);

  function handleRefresh() {
    if (cooldown) return;
    setCooldown(true);
    refresh();
    setTimeout(() => setCooldown(false), 5000);
  }

  const isEmpty =
    !data ||
    (data.strengths.length === 0 &&
      data.issues.length === 0 &&
      data.actionPlan.length === 0);

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(147,51,234,0.15), rgba(59,130,246,0.15))" }}
          >
            <SparklesIcon className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
              AI Business Insights
            </h3>
            {data?.generatedAt && (
              <p className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                Generated {getRelativeTime(data.generatedAt)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || cooldown}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "var(--text-muted)",
            opacity: loading || cooldown ? 0.3 : 0.7,
            cursor: loading || cooldown ? "not-allowed" : "pointer",
          }}
          title="Regenerate insights"
        >
          <RefreshIcon
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div
                className="h-3 w-32 rounded animate-pulse mb-3"
                style={{ background: "var(--glass-border)" }}
              />
              <div className="space-y-2">
                <div
                  className="h-12 rounded-xl animate-pulse"
                  style={{ background: "var(--glass-border)" }}
                />
                <div
                  className="h-12 rounded-xl animate-pulse"
                  style={{ background: "var(--glass-border)" }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="py-8 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Not enough data to generate insights yet. Check back after your site receives more traffic and leads.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* What's Working */}
          {data!.strengths.length > 0 && (
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.15em] mb-2.5"
                style={{ color: "rgba(74,222,128,0.7)" }}
              >
                What&apos;s Working
              </p>
              <div className="space-y-2">
                {data!.strengths.map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 p-3 rounded-xl"
                    style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.08)" }}
                  >
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-400/70" />
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                        {item.title}
                      </p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Needs Attention */}
          {data!.issues.length > 0 && (
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.15em] mb-2.5"
                style={{ color: "rgba(251,191,36,0.7)" }}
              >
                Needs Attention
              </p>
              <div className="space-y-2">
                {data!.issues.map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 p-3 rounded-xl"
                    style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.08)" }}
                  >
                    <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400/70" />
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                        {item.title}
                      </p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan */}
          {data!.actionPlan.length > 0 && (
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.15em] mb-2.5"
                style={{ color: "rgba(96,165,250,0.7)" }}
              >
                Action Plan
              </p>
              <div className="space-y-2">
                {data!.actionPlan.map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 p-3 rounded-xl"
                    style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.08)" }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{
                        background: "rgba(96,165,250,0.12)",
                        color: "rgba(96,165,250,0.8)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                        {item.title}
                      </p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
