"use client";

import { useEffect, useState } from "react";
import { useGHL } from "@/lib/hooks/use-ghl";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
import { useInvoiceAnalytics } from "@/lib/hooks/use-invoice-analytics";
import { usePortalActivity } from "@/lib/hooks/use-portal-activity";
import { AdsOverview } from "@/components/dashboard/ads-overview";
import { useHashScroll } from "@/components/rainmaker";
import { OverviewView, type OverviewRole } from "./overview-view";

interface OverviewProps {
  firstName: string;
  role: OverviewRole;
  ghlConnected: boolean;
  docStats: { total: number; new: number; reviewed: number; archived: number };
  thisWeek?: React.ReactNode;
  campaign?: React.ReactNode;
  build?: React.ReactNode;
}

// TEMPORARY placeholder (per Marcel, Sep 2026): Conversion Rate is pinned
// at 2% until real GHL booking data is flowing. Delete this constant + its
// use below to go back to the live GHL number
// (ghlMetrics.conversion.conversionRate from useGHLMetrics).
// (Pipeline Value is REAL now — sum of open leads in /dashboard/pipeline.)
const PLACEHOLDER_CONVERSION_RATE = 2; // %

/** The Overview: loads the dashboard numbers; OverviewView draws them. */
export function OverviewClient({ firstName, role, ghlConnected, docStats, thisWeek, campaign, build }: OverviewProps) {
  const ghl = useGHL();
  const metrics = useGHLMetrics("7d");
  const analytics = useInvoiceAnalytics();
  const activity = usePortalActivity();
  // null = loading, undefined = failed.
  const [pipelineValueCents, setPipelineValueCents] = useState<number | null | undefined>(null);

  useEffect(() => {
    fetch("/api/dashboard/pipeline?summary=1")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setPipelineValueCents(data.kpis?.openValueCents ?? 0))
      .catch(() => setPipelineValueCents(undefined));
  }, []);

  useHashScroll(!analytics.loading);

  return (
    <OverviewView
      firstName={firstName}
      role={role}
      ghlConnected={ghlConnected}
      docStats={docStats}
      ghl={ghl}
      metrics={metrics}
      analytics={analytics}
      activity={activity}
      pipelineValueCents={pipelineValueCents}
      conversionRate={PLACEHOLDER_CONVERSION_RATE}
      thisWeek={thisWeek}
      campaign={campaign}
      build={build}
      ads={role === "admin" ? <AdsOverview /> : undefined}
    />
  );
}
