"use client";

import { useState } from "react";

interface Connection {
  id: string;
  provider: "quickbooks" | "xero";
  companyName: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
}

export function AccountingConnections({
  connections,
}: {
  connections: Connection[];
}) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const qbConn = connections.find((c) => c.provider === "quickbooks");
  const xeroConn = connections.find((c) => c.provider === "xero");

  async function handleDisconnect(provider: "quickbooks" | "xero") {
    if (!confirm(`Disconnect ${provider === "quickbooks" ? "QuickBooks" : "Xero"}? Future invoices will no longer sync.`)) {
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

  return (
    <div className="space-y-4">
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
    </div>
  );
}
