"use client";

import { useEffect, useState } from "react";

type CampaignStatus = "not_launched" | "live";

interface CampaignProgressData {
  launchedAt: string | null;
  leads: number;
  daysSinceLaunch: number;
  pipelineValueCents: number;
  avgEngagementCents: number;
  status: CampaignStatus;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * "Campaign progress" — the leads a client's campaigns have generated since
 * launch, on their dashboard Overview. Fetches its own data and renders
 * nothing for accounts without a DRS engagement.
 */
export function CampaignProgressCard() {
  const [data, setData] = useState<CampaignProgressData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/campaign-progress")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as CampaignProgressData;
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

  const launched = data.status === "live";
  const days = data.daysSinceLaunch;

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "var(--text-muted)" }}>
          Campaign progress
        </p>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
          Leads your campaigns have generated since launch
        </h2>
      </div>

      {!launched ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Your campaigns haven&apos;t launched yet — progress shows here the day they go live.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
              {data.leads.toLocaleString("en-US")}{" "}
              <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                leads since launch
              </span>
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              {days} {days === 1 ? "day" : "days"} live
            </p>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ≈{" "}
            <span className="font-bold" style={{ color: "var(--text-main)" }}>
              {money(data.pipelineValueCents)}
            </span>{" "}
            of pipeline at a {money(data.avgEngagementCents)} average engagement
          </p>
        </div>
      )}
    </div>
  );
}
