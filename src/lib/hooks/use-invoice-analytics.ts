"use client";

import { useState, useEffect } from "react";

export interface InvoiceAnalytics {
  stats: {
    totalCollected: number;
    totalOutstanding: number;
    overdueCount: number;
    avgDaysToPay: number;
  };
  chartData: { month: string; revenue: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}

export function useInvoiceAnalytics() {
  const [data, setData] = useState<InvoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/invoice-analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
