"use client";

import { useState, useEffect, useCallback } from "react";

export interface ESignature {
  id: string;
  documentId: string;
  ownerId: string;
  signerName: string;
  signerEmail: string;
  status: "pending" | "sent" | "viewed" | "signed" | "declined" | "expired";
  token: string;
  signedAt: string | null;
  signatureData: string | null;
  signatureIp: string | null;
  expiresAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  createdAt: string;
  documentName?: string;
  senderName?: string;
  senderCompany?: string;
  senderEmail?: string;
}

interface CreateEsignParams {
  documentId: string;
  signerName: string;
  signerEmail: string;
  expiresInDays?: number;
}

export function useESignatures(statusFilter?: string) {
  const [esignatures, setEsignatures] = useState<ESignature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEsignatures = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/dashboard/esign?status=${statusFilter}`
        : "/api/dashboard/esign";
      const res = await fetch(url);
      const data = await res.json();
      setEsignatures(data.esignatures || []);
    } catch {
      setEsignatures([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEsignatures();
  }, [fetchEsignatures]);

  return { esignatures, loading, refetch: fetchEsignatures };
}

export async function createEsignRequest(params: CreateEsignParams) {
  const res = await fetch("/api/dashboard/esign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function voidEsignRequest(esignId: string) {
  const res = await fetch(`/api/dashboard/esign/${esignId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "void" }),
  });
  return res.json();
}
