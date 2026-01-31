"use client";

import { useState, useEffect } from "react";
import type { GHLMetricsData } from "@/lib/types/ghl-metrics";

export function useGHLMetrics(range: string = "7d") {
  const [data, setData] = useState<GHLMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ range });

    fetch(`/api/dashboard/ghl-metrics?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [range]);

  return { data, loading };
}
