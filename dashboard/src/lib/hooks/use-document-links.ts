"use client";

import { useState, useEffect, useCallback } from "react";

export interface DocumentLink {
  id: string;
  ownerId: string;
  token: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  message: string | null;
  requiredDocuments: string[] | null;
  maxUploads: number | null;
  uploadCount: number | null;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  lastAccessedAt: string | null;
  deliveryMethod: string | null;
  createdAt: string;
}

interface CreateLinkParams {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  message?: string;
  requiredDocuments?: string[];
  maxUploads?: number;
  expiresInDays?: number;
  deliveryMethod?: string;
}

export function useDocumentLinks() {
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/links");
      const data = await res.json();
      setLinks(data.links || []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, loading, refetch: fetchLinks };
}

export async function createDocumentLink(params: CreateLinkParams) {
  const res = await fetch("/api/dashboard/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function revokeDocumentLink(linkId: string) {
  const res = await fetch(`/api/dashboard/links/${linkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "revoked" }),
  });
  return res.json();
}

export async function deleteDocumentLink(linkId: string) {
  const res = await fetch(`/api/dashboard/links/${linkId}`, {
    method: "DELETE",
  });
  return res.json();
}
