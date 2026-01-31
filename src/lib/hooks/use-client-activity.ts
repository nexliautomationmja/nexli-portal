"use client";

import { useState, useEffect } from "react";

interface PageViewEvent {
  id: string;
  pageUrl: string;
  referrer: string | null;
  deviceType: string | null;
  country: string | null;
  createdAt: string;
}

interface LeadEvent {
  id: string;
  leadName: string | null;
  leadEmail: string | null;
  source: string | null;
  createdAt: string;
}

export interface ClientActivityData {
  recentPages: PageViewEvent[];
  recentLeads: LeadEvent[];
}

export function useClientActivity(clientId: string | null) {
  const [data, setData] = useState<ClientActivityData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/dashboard/admin/clients/${clientId}/activity`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [clientId]);

  return { data, loading };
}
