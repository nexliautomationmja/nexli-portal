"use client";

import { useState, useEffect, useCallback } from "react";

export interface Document {
  id: string;
  ownerId: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  linkId: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  storageUrl: string | null;
  status: "new" | "reviewed" | "archived";
  category: string | null;
  taxYear: string | null;
  notes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStats {
  total: number;
  new: number;
  reviewed: number;
  archived: number;
  thisMonth: number;
}

interface UseDocumentsOptions {
  status?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.category) params.set("category", options.category);
    if (options.search) params.set("search", options.search);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));

    try {
      const res = await fetch(`/api/dashboard/documents?${params}`);
      const data = await res.json();
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
    } catch {
      setDocuments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [options.status, options.category, options.search, options.limit, options.offset]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, total, loading, refetch: fetchDocuments };
}

export function useDocumentStats() {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/documents/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

export async function updateDocument(
  docId: string,
  updates: { status?: string; notes?: string; category?: string }
) {
  const res = await fetch(`/api/dashboard/documents/${docId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteDocument(docId: string) {
  const res = await fetch(`/api/dashboard/documents/${docId}`, {
    method: "DELETE",
  });
  return res.json();
}
