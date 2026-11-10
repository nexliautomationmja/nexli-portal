"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHashScroll } from "@/components/rainmaker";
import { UtmBuilder } from "@/components/dashboard/utm-builder";
import { AdAnalyticsSection } from "./ad-analytics-section";
import { TrackerView } from "./tracker-view";
import { EMPTY_KPIS, type ClientRow, type DueClient, type Kpis } from "./tracker-types";

/** Client Tracker: loads the book of business and runs the page's actions; TrackerView draws it. */
export function ClientTrackerClient() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis>(EMPTY_KPIS);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [dueClients, setDueClients] = useState<DueClient[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasDemo, setHasDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [trackerError] = await Promise.all([
      fetch("/api/dashboard/client-tracker")
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || `The server answered ${r.status}.`);
          if (data.kpis) setKpis(data.kpis);
          setClients(data.clients || []);
          setDueClients(data.dueClients || []);
          setIsAdmin(Boolean(data.isAdmin));
          return null;
        })
        .catch((err: unknown) => (err instanceof Error ? err.message : "Couldn't reach the server.")),
      fetch("/api/dashboard/demo-data")
        .then((r) => r.json())
        .then((data) => setHasDemo(Boolean(data.hasDemo)))
        .catch(() => {}),
    ]);
    setLoadError(trackerError);
    setState(trackerError ? "error" : "ready");
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useHashScroll(state === "ready");

  function retry() {
    setState("loading");
    void loadAll();
  }

  async function createDemo() {
    setDemoBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/dashboard/demo-data", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || "Demo seeding failed. Please try again.");
      }
      await loadAll();
    } finally {
      setDemoBusy(false);
    }
  }

  async function createAnnualTest() {
    setDemoBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/dashboard/demo-data/annual-unpaid", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.invoiceUrl) {
        setActionError(body.error || "Couldn't create the test client. Please try again.");
        return;
      }
      window.location.href = body.invoiceUrl;
    } finally {
      setDemoBusy(false);
    }
  }

  async function removeDemo() {
    if (!window.confirm("Remove the demo clients and their sample letters and invoices?")) return;
    setDemoBusy(true);
    setActionError(null);
    try {
      await fetch("/api/dashboard/demo-data", { method: "DELETE" });
      await loadAll();
    } finally {
      setDemoBusy(false);
    }
  }

  async function connectDashboard(c: ClientRow) {
    setConnecting(c.email);
    setActionError(null);
    try {
      const res = await fetch("/api/dashboard/client-tracker/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c.email, name: c.name, company: c.company }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || "Couldn't connect the dashboard. Please try again.");
        return;
      }
      await loadAll();
    } finally {
      setConnecting(null);
    }
  }

  return (
    <TrackerView
      state={state}
      loadError={loadError}
      kpis={kpis}
      clients={clients}
      dueClients={dueClients}
      isAdmin={isAdmin}
      hasDemo={hasDemo}
      demoBusy={demoBusy}
      connecting={connecting}
      actionError={actionError}
      onDismissError={() => setActionError(null)}
      onRetry={retry}
      onCreateDemo={createDemo}
      onRemoveDemo={removeDemo}
      onAnnualTest={createAnnualTest}
      onConnect={connectDashboard}
      onOpenClient={(c) => router.push(`/dashboard/client-tracker/${c.clientUserId}`)}
      adAnalytics={<AdAnalyticsSection />}
      utm={<UtmBuilder />}
    />
  );
}
