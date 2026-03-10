"use client";

import { useState, useEffect, useCallback } from "react";

export interface MarketingVideo {
  id: string;
  createdBy: string;
  title: string;
  script: string;
  visualPrompt: string | null;
  avatarUrl: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  status: "draft" | "generating" | "completed" | "failed";
  durationSeconds: number | null;
  resolution: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useMarketingVideos() {
  const [videos, setVideos] = useState<MarketingVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard/marketing")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { videos, loading, refetch };
}
