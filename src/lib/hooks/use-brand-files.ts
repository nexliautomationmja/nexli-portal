"use client";

import { useState, useEffect, useCallback } from "react";

export interface BrandFile {
  id: string;
  clientId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: "logo" | "brand_guideline" | "photo" | "design_file";
  storagePath: string;
  storageUrl: string;
  createdAt: string;
}

export function useBrandFiles(clientId?: string, category?: string) {
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (category) params.set("category", category);

    fetch(`/api/dashboard/brand-files?${params}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [clientId, category]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { files, loading, refetch };
}
