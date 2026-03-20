"use client";

import { useState } from "react";

interface CalendarConnection {
  id: string;
  provider: "google" | "calcom";
  accountEmail: string | null;
  connectedAt: string;
}

export function CalendarConnections({
  connections,
  error,
}: {
  connections: CalendarConnection[];
  error?: string;
}) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const googleConn = connections.find((c) => c.provider === "google");
  const calcomConn = connections.find((c) => c.provider === "calcom");

  async function handleDisconnect(provider: "google" | "calcom") {
    const labels: Record<string, string> = {
      google: "Google Calendar",
      calcom: "Cal.com",
    };
    if (
      !confirm(
        `Disconnect ${labels[provider]}? Calendar events will no longer appear.`
      )
    ) {
      return;
    }
    setDisconnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnecting(null);
    }
  }

  const errorMessages: Record<string, string> = {
    google_not_configured:
      "Google Calendar integration is not configured yet. Contact support to set up your Google connection.",
    google_connect_failed:
      "Failed to connect Google Calendar. Please try again.",
    google_state_mismatch: "Security check failed. Please try connecting again.",
    calcom_not_configured:
      "Cal.com integration is not configured yet. Contact support to set up your Cal.com connection.",
    calcom_connect_failed: "Failed to connect Cal.com. Please try again.",
    calcom_state_mismatch: "Security check failed. Please try connecting again.",
  };

  return (
    <div className="space-y-4">
      {error && errorMessages[error] && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMessages[error]}
        </div>
      )}
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Connect your calendars to view all your appointments in one place.
      </p>

      {/* Google Calendar */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "#4285F4" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
              />
              <path d="M3 10h18" stroke="white" strokeWidth="1.5" />
              <path d="M8 2v4M16 2v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              Google Calendar
            </p>
            {googleConn ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connected as {googleConn.accountEmail || "Google Account"}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                View your Google Calendar events
              </p>
            )}
          </div>
        </div>
        {googleConn ? (
          <button
            onClick={() => handleDisconnect("google")}
            disabled={disconnecting === "google"}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {disconnecting === "google" ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/google/connect"
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "#4285F4",
              color: "#fff",
            }}
          >
            Connect
          </a>
        )}
      </div>

      {/* Cal.com */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "#292929" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
              />
              <path d="M3 10h18" stroke="white" strokeWidth="1.5" />
              <path d="M8 2v4M16 2v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 14h3v3H8z" fill="white" />
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              Cal.com
            </p>
            {calcomConn ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connected as {calcomConn.accountEmail || "Cal.com Account"}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                View your Cal.com appointments
              </p>
            )}
          </div>
        </div>
        {calcomConn ? (
          <button
            onClick={() => handleDisconnect("calcom")}
            disabled={disconnecting === "calcom"}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {disconnecting === "calcom" ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/calcom/connect"
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "#292929",
              color: "#fff",
            }}
          >
            Connect
          </a>
        )}
      </div>
    </div>
  );
}
