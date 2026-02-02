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
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all"
          >
            {status === "saving"
              ? "Testing & Saving..."
              : connected
              ? "Update"
              : "Connect"}
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
      </form>
    </div>
  );
}
