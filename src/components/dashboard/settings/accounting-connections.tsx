"use client";

import { useState } from "react";

interface Connection {
  id: string;
  provider: "quickbooks" | "xero" | "custombooks";
  companyName: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
}

export function AccountingConnections({
  connections,
  error,
}: {
  connections: Connection[];
  error?: string;
}) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const qbConn = connections.find((c) => c.provider === "quickbooks");
  const xeroConn = connections.find((c) => c.provider === "xero");
  const cbConn = connections.find((c) => c.provider === "custombooks");

  async function handleDisconnect(provider: "quickbooks" | "xero" | "custombooks") {
    const labels: Record<string, string> = { quickbooks: "QuickBooks", xero: "Xero", custombooks: "CustomBooks" };
    if (!confirm(`Disconnect ${labels[provider]}? Future invoices will no longer sync.`)) {
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
    xero_not_configured: "Xero integration is not configured yet. Contact support to set up your Xero connection.",
    custombooks_not_configured: "CustomBooks integration is not configured yet. Contact support to set up your CustomBooks connection.",
    quickbooks_not_configured: "QuickBooks integration is not configured yet. Contact support to set up your QuickBooks connection.",
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMessages[error]}
        </div>
      )}
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Connect your accounting software to automatically sync invoices and
        payments.
      </p>

      {/* QuickBooks */}
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
            style={{ background: "#2CA01C" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              QuickBooks Online
            </p>
            {qbConn ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connected to {qbConn.companyName || "QuickBooks"}
                {qbConn.lastSyncAt && (
                  <> &middot; Last synced{" "}
                  {new Date(qbConn.lastSyncAt).toLocaleDateString()}</>
                )}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Sync invoices and payments automatically
              </p>
            )}
          </div>
        </div>
        {qbConn ? (
          <button
            onClick={() => handleDisconnect("quickbooks")}
            disabled={disconnecting === "quickbooks"}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {disconnecting === "quickbooks" ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/quickbooks/connect"
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "#2CA01C",
              color: "#fff",
            }}
          >
            Connect
          </a>
        )}
      </div>

      {/* Xero */}
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
            style={{ background: "#13B5EA" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18.364 5.636L5.636 18.364M18.364 18.364L5.636 5.636" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              Xero
            </p>
            {xeroConn ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connected to {xeroConn.companyName || "Xero"}
                {xeroConn.lastSyncAt && (
                  <> &middot; Last synced{" "}
                  {new Date(xeroConn.lastSyncAt).toLocaleDateString()}</>
                )}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Sync invoices and payments automatically
              </p>
            )}
          </div>
        </div>
        {xeroConn ? (
          <button
            onClick={() => handleDisconnect("xero")}
            disabled={disconnecting === "xero"}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {disconnecting === "xero" ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/xero/connect"
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "#13B5EA",
              color: "#fff",
            }}
          >
            Connect
          </a>
        )}
      </div>

      {/* CustomBooks */}
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
            style={{ background: "#4F46E5" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" fill="none" stroke="white" strokeWidth="1.5"/>
              <path d="M14 8H8M16 12H8M13 16H8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              CustomBooks
            </p>
            {cbConn ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connected to {cbConn.companyName || "CustomBooks"}
                {cbConn.lastSyncAt && (
                  <> &middot; Last synced{" "}
                  {new Date(cbConn.lastSyncAt).toLocaleDateString()}</>
                )}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Sync invoices and payments via CustomBooks
              </p>
            )}
          </div>
        </div>
        {cbConn ? (
          <button
            onClick={() => handleDisconnect("custombooks")}
            disabled={disconnecting === "custombooks"}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {disconnecting === "custombooks" ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/custombooks/connect"
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "#4F46E5",
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
