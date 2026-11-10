"use client";

import { useEffect, useState } from "react";
import { BIG_NUM, Chip, FeatureCard } from "@/components/rainmaker";
import { moneyWhole } from "@/lib/format";

type CampaignStatus = "not_launched" | "live";

export interface CampaignProgressData {
  launchedAt: string | null;
  leads: number;
  daysSinceLaunch: number;
  pipelineValueCents: number;
  avgEngagementCents: number;
  status: CampaignStatus;
}

/** The card itself (no fetching), so it can be shown with any data. */
export function CampaignProgressView({ data }: { data: CampaignProgressData }) {
  const launched = data.status === "live";
  const days = data.daysSinceLaunch;
  return (
    <FeatureCard
      tone="emerald"
      eyebrow="Campaign progress"
      title="Leads your campaigns have generated since launch"
      right={
        <Chip tone={launched ? "green" : "neutral"} size="xs" dot>
          {launched ? `${days} ${days === 1 ? "day" : "days"} live` : "Not launched yet"}
        </Chip>
      }
    >
      {!launched ? (
        <p className="text-sm leading-relaxed text-neutral-300">Your campaigns haven&apos;t launched yet. Progress shows here the day they go live.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="text-4xl font-extrabold leading-none text-white" style={BIG_NUM}>
              {data.leads.toLocaleString("en-US")}
            </div>
            <div className="mt-1 text-xs text-neutral-400">leads since launch</div>
          </div>
          <div className="text-sm text-neutral-300">
            ≈ <span className="font-bold text-emerald-300">{moneyWhole(data.pipelineValueCents)}</span> of pipeline at a {moneyWhole(data.avgEngagementCents)} average engagement
          </div>
        </div>
      )}
    </FeatureCard>
  );
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
  return <CampaignProgressView data={data} />;
}
