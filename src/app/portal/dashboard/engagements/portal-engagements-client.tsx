"use client";

import { useState, useEffect } from "react";
import { PenLineIcon, EyeIcon, XIcon } from "@/components/ui/icons";
import { DocumentPreview } from "@/components/engagement-document";

interface EngagementSignerLite {
  id: string;
  name: string;
  email: string;
  order: number;
  role: string | null;
  status: string;
  signedAt: string | null;
  signatureData: string | null;
}

interface EngagementItem {
  signerId: string;
  signerStatus: string;
  signerToken: string;
  signedAt: string | null;
  declinedAt: string | null;
  role: string | null;
  signatureData: string | null;
  engagementId: string;
  subject: string;
  content: string;
  engagementStatus: string;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  clientName: string;
  fromName: string;
  fromCompany: string;
  signers: EngagementSignerLite[];
}

const statusBadge: Record<string, string> = {
  sent: "badge badge-blue",
  viewed: "badge badge-blue",
  signed: "badge badge-emerald",
  declined: "badge badge-rose",
  expired: "badge badge-gray",
};

const statusLabel: Record<string, string> = {
  sent: "Pending",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalEngagementsClient() {
  const [engagements, setEngagements] = useState<EngagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<EngagementItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/engagements");
        if (res.ok) {
          const data = await res.json();
          setEngagements(data.engagements);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading engagements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Engagement Letters
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Engagement letters sent for your review and signature.
        </p>
      </div>

      {engagements.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <PenLineIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No engagement letters
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Engagement letters will appear here when sent to you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {engagements.map((eng) => (
            <div key={eng.signerId} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: "var(--accent-purple-bg)",
                      border: "1px solid var(--accent-purple-border)",
                    }}
                  >
                    <PenLineIcon className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {eng.subject}
                    </p>
                    {eng.role && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Signing as: {eng.role}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={statusBadge[eng.signerStatus] || "badge badge-gray"}>
                        {statusLabel[eng.signerStatus] || eng.signerStatus}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Sent {formatDate(eng.sentAt || eng.createdAt)}
                      </span>
                      {eng.expiresAt && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Expires {formatDate(eng.expiresAt)}
                        </span>
                      )}
                    </div>
                    {eng.signerStatus === "signed" && eng.signedAt && (
                      <p className="text-xs mt-1 text-emerald-400">
                        Signed on {formatDate(eng.signedAt)}
                      </p>
                    )}
                    {eng.signerStatus === "declined" && eng.declinedAt && (
                      <p className="text-xs mt-1 text-red-400">
                        Declined on {formatDate(eng.declinedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {["sent", "viewed"].includes(eng.signerStatus) && (
                    <a
                      href={`/engage/${eng.signerToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-full text-sm font-bold text-white no-underline"
                      style={{
                        background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                      }}
                    >
                      Review & Sign
                    </a>
                  )}
                  <button
                    onClick={() => setViewing(eng)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:bg-[var(--input-bg)]"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--text-main)",
                    }}
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                    View Document
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Document Modal */}
      {viewing && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setViewing(null)}
          />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-3xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {viewing.subject}
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {viewing.signerStatus === "signed"
                    ? "Fully executed engagement letter"
                    : "Engagement letter preview"}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const sender = viewing.signers.find((s) => s.order === 0);
                const me = viewing.signers.find(
                  (s) => s.id === viewing.signerId
                );
                return (
                  <DocumentPreview
                    content={viewing.content}
                    subject={viewing.subject}
                    clientName={viewing.clientName}
                    fromName={viewing.fromName}
                    fromCompany={viewing.fromCompany}
                    date={
                      viewing.sentAt
                        ? new Date(viewing.sentAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : undefined
                    }
                    senderSignatureData={sender?.signatureData}
                    senderSignedAt={sender?.signedAt}
                    senderRole={sender?.role}
                    clientSignatureData={me?.signatureData}
                    clientSignedAt={me?.signedAt}
                    clientSignedName={me?.name}
                  />
                );
              })()}
            </div>
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end">
              <button
                onClick={() => setViewing(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)]"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-main)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
