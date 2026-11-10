"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CANVAS_VARS } from "@/components/rainmaker";
import { OnboardingView } from "./onboarding-view";
import { LaunchPadSheet } from "./launch-pad-sheet";
import { clientNameFor, type AdminDetail, type EngagementRow } from "./onboarding-types";

/** A short confirmation at the bottom of the screen, above any open sheet. */
function Toast({ message }: { message: string | null }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[120] flex justify-center px-4" style={CANVAS_VARS}>
      {message && (
        <div className="rounded-full border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white shadow-2xl shadow-black/60">{message}</div>
      )}
    </div>,
    document.body
  );
}

/**
 * Admin Onboarding page: loads the Launch Pads and runs every action;
 * OnboardingView draws the list, LaunchPadSheet one client's Launch Pad.
 */
export function OnboardingDashboardClient() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [listState, setListState] = useState<"loading" | "error" | "ready">("loading");
  const [starting, setStarting] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [detailState, setDetailState] = useState<"loading" | "error" | "ready">("loading");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const openRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/engagements");
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setEngagements(body.engagements || []);
      setListState("ready");
    } catch {
      setListState((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailState("loading");
    try {
      const res = await fetch(`/api/dashboard/engagements/${id}/onboarding`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as AdminDetail;
      if (openRef.current === id) {
        setDetail(body);
        setDetailState("ready");
      }
    } catch {
      if (openRef.current === id) setDetailState("error");
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const open = useCallback(
    (id: string) => {
      openRef.current = id;
      setOpenId(id);
      setDetail(null);
      setBillingError(null);
      void loadDetail(id);
    },
    [loadDetail]
  );

  const close = useCallback(() => {
    openRef.current = null;
    setOpenId(null);
    void load();
  }, [load]);

  async function start(id: string) {
    setStarting(id);
    try {
      const res = await fetch(`/api/dashboard/engagements/${id}/onboarding`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setToast(body.error || "Couldn't start onboarding");
        return;
      }
      await load();
      open(id);
      setToast("Launch Pad started 🚀");
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setStarting(null);
    }
  }

  const patch = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    const id = openRef.current;
    if (!id) return false;
    try {
      const res = await fetch(`/api/dashboard/engagements/${id}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error || "That didn't save. Please try again.");
        return false;
      }
      if (openRef.current === id) setDetail(data as AdminDetail);
      if (body.action === "post_update") setToast("Update posted 📡");
      return true;
    } catch {
      setToast("Network error. That didn't save.");
      return false;
    }
  }, []);

  async function startMonthly() {
    const id = openRef.current;
    if (!id || !window.confirm("Send the first monthly invoice now? Do this once the build is finished.")) return;
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch(`/api/dashboard/engagements/${id}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_monthly_billing" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingError(body.error || "Couldn't send the first monthly invoice");
        return;
      }
      if (openRef.current === id) setDetail(body as AdminDetail);
    } catch {
      setBillingError("Network error. Please try again.");
    } finally {
      setBillingBusy(false);
    }
  }

  const active = engagements.filter((e) => e.metadata?.onboarding);
  const startable = engagements.filter((e) => e.status === "signed" && !e.metadata?.onboarding);
  const openRow = engagements.find((e) => e.id === openId);

  return (
    <>
      <OnboardingView
        state={listState}
        active={active}
        startable={startable}
        starting={starting}
        onOpen={open}
        onStart={start}
        onRetry={() => {
          setListState("loading");
          void load();
        }}
      />
      <LaunchPadSheet
        open={Boolean(openId)}
        state={detailState}
        detail={detail}
        name={openRow ? clientNameFor(openRow) : ""}
        origin={origin}
        billingBusy={billingBusy}
        billingError={billingError}
        onClose={close}
        onRetry={() => openId && void loadDetail(openId)}
        onPatch={patch}
        onStartMonthly={startMonthly}
        onCopied={(what) => setToast(`${what} copied 📋`)}
      />
      <Toast message={toast} />
    </>
  );
}
