"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EngagementsView, type Engagement } from "./engagements-view";

/** Engagement letters: loads them and runs void / delete / onboarding; EngagementsView draws it. */
export function EngagementsClient() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [showDetail, setShowDetail] = useState<Engagement | null>(null);
  const [firmInfo, setFirmInfo] = useState<{ name: string; company: string }>({ name: "", company: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/engagements");
      if (!r.ok) throw new Error(String(r.status));
      const engData = await r.json();
      const list: Engagement[] = engData.engagements || [];
      setEngagements(list);
      if (engData.from) setFirmInfo(engData.from);
      // /dashboard/engagements?id=… opens that letter (Clients page, the composer's success screen).
      const id = new URLSearchParams(window.location.search).get("id");
      const linked = id ? list.find((e) => e.id === id) : undefined;
      if (linked) setShowDetail(linked);
      setState("ready");
    } catch {
      setEngagements([]);
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleVoid(id: string) {
    if (!confirm("Void this letter? The signing link stops working.")) return;
    await fetch(`/api/dashboard/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    setEngagements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "expired" as const, signers: e.signers.map((s) => ({ ...s, status: "expired" as const })) } : e))
    );
    setShowDetail(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this letter for good? This can't be undone.")) return;
    await fetch(`/api/dashboard/engagements/${id}`, { method: "DELETE" });
    setEngagements((prev) => prev.filter((e) => e.id !== id));
    setShowDetail(null);
  }

  async function startOnboarding(id: string) {
    await fetch(`/api/dashboard/engagements/${id}/onboarding`, { method: "POST" });
    router.push("/dashboard/onboarding");
  }

  return (
    <EngagementsView
      state={state}
      engagements={engagements}
      open={showDetail}
      firmInfo={firmInfo}
      onOpen={setShowDetail}
      onClose={() => setShowDetail(null)}
      onVoid={handleVoid}
      onDelete={handleDelete}
      onStartOnboarding={startOnboarding}
      onRetry={() => {
        setState("loading");
        void load();
      }}
    />
  );
}
