"use client";

import { useState, useEffect } from "react";

export interface PortalActivityItem {
  type: "document" | "payment" | "engagement" | "login";
  description: string;
  actorName: string | null;
  timestamp: string;
}

export function usePortalActivity() {
  const [data, setData] = useState<PortalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/portal-activity")
      .then((r) => r.json())
      .then((d) => setData(d.activities || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
