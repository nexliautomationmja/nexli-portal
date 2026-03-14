"use client";

import { useState, useEffect } from "react";

interface DeltaInfo {
  value: string;
  type: "positive" | "negative" | "neutral";
}

export interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  pageViewsDelta: DeltaInfo;
  uniqueVisitorsDelta: DeltaInfo;
  dailyData: { date: string; pageViews: number; uniqueVisitors: number }[];
  topPages: { url: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  deviceBreakdown: { deviceType: string; count: number }[];
}

export function useAnalytics(range: string = "7d", clientId?: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (clientId) params.set("clientId", clientId);

    fetch(`/api/dashboard/analytics?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [range, clientId]);

  return { data, loading };
}
