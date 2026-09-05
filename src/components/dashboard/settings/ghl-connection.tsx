"use client";

import { useState } from "react";

interface GHLConnectionProps {
  currentLocationId: string | null;
}

export function GHLConnection({ currentLocationId }: GHLConnectionProps) {
  const [locationId, setLocationId] = useState(currentLocationId ?? "");
  const [connected, setConnected] = useState(!!currentLocationId);
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error" | "disconnecting"
  >("idle");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
    checks?: { name: string; ok: boolean; info: string }[];
  } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/dashboard/settings/ghl/test");
      const data = await res.json();
      setTestResult({
        ok: Boolean(data.ok),
        message: data.message || "Test failed — please try again.",
        detail: data.detail,
        checks: Array.isArray(data.checks) ? data.checks : undefined,
      });
    } catch {
      setTestResult({ ok: false, message: "Test request failed — please try again." });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId.trim()) return;

    setStatus("saving");
    setError("");

    const res = await fetch("/api/dashboard/settings/ghl", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: locationId.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setConnected(true);
      if (data.verified) {
        setStatus("success");
      } else {
        setStatus("success");
        setError("Saved, but the GHL API test could not verify this Location ID. Data will appear once the ID is correct.");
      }
    } else {
      const data = await res.json();
      setError(data.error || "Failed to connect");
      setStatus("error");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect GoHighLevel? Lead and pipeline data will no longer appear on your dashboard.")) {
      return;
    }

    setStatus("disconnecting");
    setError("");

    const res = await fetch("/api/dashboard/settings/ghl", {
      method: "DELETE",
    });

    if (res.ok) {
      setLocationId("");
      setConnected(false);
      setStatus("idle");
    } else {
      setError("Failed to disconnect");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-3">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            connected ? "bg-green-400" : "bg-gray-500"
          }`}
        />
        <span className="text-sm" style={{ color: "var(--text-main)" }}>
          {connected ? "Connected" : "Not connected"}
        </span>
        {connected && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--glass-border)]"
            style={{ color: "var(--text-muted)" }}
          >
            {locationId}
          </span>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Enter your GoHighLevel Location ID to sync leads, pipeline data, and
        conversion metrics to your dashboard. You can find this in your GHL
        sub-account under Settings &rarr; Business Info.
      </p>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label
            className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Location ID
          </label>
          <input
            type="text"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="e.g. yamjttuJWWdstfF9N0zu"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {status === "success" && !error && (
          <p className="text-sm text-green-400">
            GoHighLevel connected successfully.
          </p>
        )}
        {status === "success" && error && (
          <p className="text-sm text-yellow-400">{error}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving" || status === "disconnecting" || !locationId.trim()}
            className="btn-primary px-6 py-2.5 text-sm"
          >
            {status === "saving"
              ? "Testing & Saving..."
              : connected
              ? "Update"
              : "Connect"}
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl text-sm font-bold border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-50 transition-all"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>

          {connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={status === "saving" || status === "disconnecting"}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 transition-all"
            >
              {status === "disconnecting" ? "Disconnecting..." : "Disconnect"}
            </button>
          )}
        </div>

        {testResult && (
          <div
            className={`rounded-xl p-3 border text-sm ${
              testResult.ok
                ? "border-emerald-400/30 bg-emerald-400/[0.06]"
                : "border-rose-400/30 bg-rose-400/[0.06]"
            }`}
          >
            <p className={`font-semibold ${testResult.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testResult.ok ? "✓ " : "✕ "}{testResult.message}
            </p>
            {testResult.checks && testResult.checks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {testResult.checks.map((c) => (
                  <li key={c.name} className="text-xs flex gap-2">
                    <span className={c.ok ? "text-emerald-400" : "text-rose-400"}>
                      {c.ok ? "✓" : "✕"}
                    </span>
                    <span style={{ color: "var(--text-main)" }}>
                      <span className="font-semibold">{c.name}:</span>{" "}
                      <span style={{ color: c.ok ? "var(--text-muted)" : undefined }} className={c.ok ? "" : "text-rose-400"}>
                        {c.info}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {testResult.detail && (
              <p className="mt-1 text-xs font-mono opacity-80 break-all" style={{ color: "var(--text-muted)" }}>
                {testResult.detail}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
