"use client";

import { useEffect, useState } from "react";
import { NEXLI_GUARANTEE } from "@/lib/drs-pricing";

type GuaranteeStatus = "not_launched" | "on_track" | "behind" | "met" | "missed";

interface GuaranteeProgressData {
  launchedAt: string | null;
  target: number;
  leads: number;
  daysElapsed: number;
  daysRemaining: number;
  windowEndsAt: string | null;
  status: GuaranteeStatus;
  pipelineValueCents: number;
  avgEngagementCents: number;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

const BAR_CLASS: Record<GuaranteeStatus, string> = {
  not_launched: "bg-gradient-to-r from-blue-600 to-cyan-500",
  on_track: "bg-gradient-to-r from-emerald-600 to-emerald-400",
  met: "bg-gradient-to-r from-emerald-600 to-emerald-400",
  behind: "bg-gradient-to-r from-amber-600 to-amber-400",
  missed: "bg-gradient-to-r from-rose-600 to-rose-400",
};

const BADGE: Record<GuaranteeStatus, { label: string; cls: string } | null> = {
  not_launched: null,
  on_track: { label: "On track", cls: "badge-emerald" },
  met: { label: "Met ✓", cls: "badge-emerald" },
  behind: { label: "Behind pace", cls: "badge-amber" },
  missed: { label: "Working free", cls: "badge-rose" },
};

/**
 * "The Nexli Guarantee" — a client's progress toward the 50 qualified leads
 * promised in their engagement letter, on their dashboard Overview. Fetches
 * its own data and renders nothing for accounts without a DRS engagement.
 */
export function GuaranteeProgressCard() {
  const [data, setData] = useState<GuaranteeProgressData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/guarantee")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as GuaranteeProgressData;
      })
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const target = data.target || NEXLI_GUARANTEE.QUALIFIED_LEADS;
  const percent = Math.min(100, Math.round((data.leads / target) * 100));
  const badge = BADGE[data.status];
  const launched = data.status !== "not_launched";

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "var(--text-muted)" }}>
            The Nexli Guarantee
          </p>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            {NEXLI_GUARANTEE.QUALIFIED_LEADS} qualified leads in your first{" "}
            {NEXLI_GUARANTEE.LEAD_WINDOW_DAYS} days — or we keep working free
          </h2>
        </div>
        {badge && <span className={`badge ${badge.cls} shrink-0`}>{badge.label}</span>}
      </div>

      {!launched ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Your campaigns haven&apos;t launched yet — the {NEXLI_GUARANTEE.LEAD_WINDOW_DAYS}-day
          clock starts the day they go live.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
              {data.leads.toLocaleString("en-US")}{" "}
              <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                of {target} qualified leads
              </span>
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              {data.daysRemaining > 0
                ? `${data.daysRemaining} ${data.daysRemaining === 1 ? "day" : "days"} left`
                : "Window complete"}
            </p>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden"
            style={{ background: "var(--input-bg)" }}
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${BAR_CLASS[data.status]}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ≈{" "}
            <span className="font-bold" style={{ color: "var(--text-main)" }}>
              {money(data.pipelineValueCents)}
            </span>{" "}
            pipeline opportunity at a {money(data.avgEngagementCents)} average engagement
          </p>
          {data.status === "missed" && (
            <p className="text-sm font-semibold text-rose-400">
              We&apos;re still working at no platform charge until you reach {target}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
