"use client";

import { useState, useEffect } from "react";
import { PenLineIcon, EyeIcon, XIcon, DownloadIcon } from "@/components/ui/icons";
import { DocumentPreview } from "@/components/engagement-document";

interface SignerInfo {
  name: string;
  role: string | null;
  signatureData: string | null;
  signedAt: string | null;
}

interface EngagementItem {
  signerId: string;
  signerStatus: string;
  signerToken: string;
  signedAt: string | null;
  declinedAt: string | null;
  role: string | null;
  engagementId: string;
  subject: string;
  content: string;
  engagementStatus: string;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  signers: SignerInfo[];
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
  const [firmInfo, setFirmInfo] = useState({ name: "", company: "" });
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState<EngagementItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/engagements");
        if (res.ok) {
          const data = await res.json();
          setEngagements(data.engagements);
          if (data.from) setFirmInfo(data.from);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDownloadPDF(eng: EngagementItem) {
    const { generateEngagementPDF } = await import("@/lib/engagement-pdf");
    await generateEngagementPDF({
      subject: eng.subject,
      content: eng.content,
      signers: eng.signers.filter((s) => s.signatureData),
      fromName: firmInfo.name,
      fromCompany: firmInfo.company,
      date: eng.sentAt
        ? new Date(eng.sentAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : undefined,
    });
  }

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

  // Detail view
  if (showDetail) {
    const clientSigner = showDetail.signers.find(
      (s) => !s.role?.includes("Representative")
    );

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowDetail(null)}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <XIcon className="w-4 h-4" />
            Back to Engagements
          </button>
          {showDetail.engagementStatus === "signed" && (
            <button
              onClick={() => handleDownloadPDF(showDetail)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              <DownloadIcon className="w-4 h-4" />
              Save as PDF
            </button>
          )}
        </div>

        {/* Status banner */}
        {showDetail.engagementStatus === "signed" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-500 font-medium">
              All parties have signed this engagement letter
            </p>
          </div>
        )}

        {/* Document preview with signatures */}
        <DocumentPreview
          content={showDetail.content}
          subject={showDetail.subject}
          clientName={clientSigner?.name || showDetail.signers[showDetail.signers.length - 1]?.name || ""}
          fromName={firmInfo.name}
          fromCompany={firmInfo.company}
          date={
            showDetail.sentAt
              ? new Date(showDetail.sentAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : undefined
          }
          signers={showDetail.signers
            .filter((s) => s.signatureData)
            .map((s) => ({
              name: s.name,
              role: s.role,
              signatureData: s.signatureData,
              signedAt: s.signedAt,
            }))}
        />

        {/* Signers timeline */}
        <div className="glass-card p-5 space-y-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Signatures
          </p>
          {showDetail.signers.map((signer, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border-primary)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                  {signer.name}
                </p>
                {signer.role && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {signer.role}
                  </p>
                )}
              </div>
              <div className="text-right">
                {signer.signedAt ? (
                  <p className="text-xs text-emerald-400 font-medium">
                    Signed {formatDate(signer.signedAt)}
                  </p>
                ) : (
                  <span className="badge badge-gray">Pending</span>
                )}
              </div>
            </div>
          ))}
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
                <div className="flex items-center gap-2 shrink-0">
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
                  {eng.engagementStatus === "signed" && (
                    <button
                      onClick={() => setShowDetail(eng)}
                      className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                      style={{ color: "var(--text-muted)" }}
                      title="View signed document"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
