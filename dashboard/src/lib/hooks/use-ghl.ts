"use client";

import { useState, useEffect } from "react";

export interface GHLData {
  leadsCount: number;
  recentLeads: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateAdded: string;
    source?: string;
  }[];
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  pipelineValue: number;
}

export function useGHL() {
  const [data, setData] = useState<GHLData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/ghl")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
