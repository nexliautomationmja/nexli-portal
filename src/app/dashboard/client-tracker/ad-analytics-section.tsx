"use client";

import { useCallback, useEffect, useState } from "react";
import { AdAnalyticsView, EMPTY_AD_ANALYTICS, type AdAnalyticsData } from "./ad-analytics-view";

/** Ad analytics on the Client Tracker: fetches GHL UTM attribution; AdAnalyticsView draws it. */
export function AdAnalyticsSection() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [data, setData] = useState<AdAnalyticsData>(EMPTY_AD_ANALYTICS);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: string, refresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/ad-analytics?days=${range}${refresh ? "&refresh=1" : ""}`);
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.message || body.error || `Request failed (${r.status})`);
        setData({ ...EMPTY_AD_ANALYTICS, range });
        return;
      }
      setData(body as AdAnalyticsData);
    } catch {
      setError("Couldn't reach the analytics API. Check your connection and reload.");
      setData({ ...EMPTY_AD_ANALYTICS, range });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days, false);
  }, [days, load]);

  return <AdAnalyticsView days={days} data={data} loading={loading} error={error} onDays={setDays} onRefresh={() => load(days, true)} />;
}
