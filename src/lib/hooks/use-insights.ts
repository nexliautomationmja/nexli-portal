"use client";

import { useState, useEffect, useCallback } from "react";
import type { AIInsightsData } from "@/lib/types/ai-insights";

export function useInsights(range: string = "7d", clientId?: string) {
  const [data, setData] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(
    (force = false) => {
      setLoading(true);
      const params = new URLSearchParams({ range });
      if (clientId) params.set("clientId", clientId);
      if (force) params.set("force", "true");

      fetch(`/api/dashboard/insights?${params}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    },
    [range, clientId]
  );

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const refresh = useCallback(() => fetchInsights(true), [fetchInsights]);

  return { data, loading, refresh };
}
