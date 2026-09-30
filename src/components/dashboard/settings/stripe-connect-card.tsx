"use client";

import { useCallback, useEffect, useState } from "react";

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  accountId: string | null;
  loginUrl?: string;
  error?: string;
}

type Badge = "not_connected" | "incomplete" | "active";

function badgeFor(status: ConnectStatus | null): Badge {
  if (!status || !status.connected) return "not_connected";
  if (status.chargesEnabled) return "active";
  return "incomplete";
}

const BADGE_LABEL: Record<Badge, string> = {
  not_connected: "Not connected",
  incomplete: "Onboarding incomplete",
  active: "Active",
};

const BADGE_DOT: Record<Badge, string> = {
  not_connected: "bg-gray-500",
  incomplete: "bg-yellow-400",
  active: "bg-green-400",
};

export function StripeConnectCard() {
  // Read ?connect=return|refresh from the URL without useSearchParams so the
  // parent server page needs no Suspense boundary.
  const [connectParam, setConnectParam] = useState<string | null>(null);
  useEffect(() => {
    try {
      setConnectParam(
        new URLSearchParams(window.location.search).get("connect")
      );
    } catch {
      setConnectParam(null);
    }
  }, []);

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/settings/stripe-connect", {
        cache: "no-store",
      });
      const data = (await res.json()) as ConnectStatus & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not load payment status.");
        return;
      }
      setStatus(data);
      if (data.error) setError(data.error);
    } catch {
      setError("Could not load payment status.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + refetch when Stripe sends the user back (?connect=return).
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus, connectParam]);

  async function handleConnect() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/settings/stripe-connect", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start Stripe onboarding.");
        setStarting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start Stripe onboarding.");
      setStarting(false);
    }
  }

  const badge = badgeFor(status);

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${BADGE_DOT[badge]}`} />
        <span className="text-sm" style={{ color: "var(--text-main)" }}>
          {loading && !status ? "Checking status..." : BADGE_LABEL[badge]}
        </span>
        {status?.accountId && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--glass-border)]"
            style={{ color: "var(--text-muted)" }}
          >
            {status.accountId}
          </span>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Your clients&apos; invoice payments settle directly to your firm&apos;s
        bank account. Stripe&apos;s processing fees apply.
      </p>

      {connectParam === "refresh" && badge !== "active" && (
        <p className="text-sm text-yellow-400">
          Your onboarding link expired. Click below to continue where you left
          off.
        </p>
      )}

      {badge === "incomplete" && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Stripe still needs a few details before you can accept payments.
          Continue onboarding to finish setup.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        {badge !== "active" && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={starting || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all"
          >
            {starting
              ? "Redirecting to Stripe..."
              : badge === "incomplete"
                ? "Continue onboarding"
                : "Connect your bank"}
          </button>
        )}

        {badge === "active" && status?.loginUrl && (
          <a
            href={status.loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
          >
            Open Stripe dashboard
          </a>
        )}

        {badge === "active" && !status?.payoutsEnabled && (
          <span className="text-xs text-yellow-400">
            Payouts are not enabled yet. Check your Stripe dashboard for any
            outstanding requirements.
          </span>
        )}

        {status?.connected && (
          <button
            type="button"
            onClick={() => void fetchStatus()}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold border border-[var(--glass-border)] hover:bg-white/5 disabled:opacity-50 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            {loading ? "Refreshing..." : "Refresh status"}
          </button>
        )}
      </div>
    </div>
  );
}
