"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PenLineIcon, XIcon, PlusIcon, EyeIcon, TrashIcon } from "@/components/ui/icons";
import { DocumentPreview } from "@/components/engagement-document";

interface Signer {
  id: string;
  name: string;
  email: string;
  order: number;
  role: string | null;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  signatureData: string | null;
}

interface Engagement {
  id: string;
  subject: string;
  content: string;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
  sentAt: string | null;
  expiresAt: string;
  createdAt: string;
  signers: Signer[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-gray-500", bg: "bg-gray-500/10" },
  sent: { label: "Sent", color: "text-blue-500", bg: "bg-blue-500/10" },
  viewed: { label: "Viewed", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  signed: { label: "Signed", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  declined: { label: "Declined", color: "text-red-500", bg: "bg-red-500/10" },
  expired: { label: "Expired", color: "text-gray-400", bg: "bg-gray-400/10" },
};

export function EngagementsClient() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState<Engagement | null>(null);

  const [firmInfo, setFirmInfo] = useState<{ name: string; company: string }>({ name: "", company: "" });

  useEffect(() => {
    Promise.all([fetch("/api/dashboard/engagements").then((r) => r.json())])
      .then(([engData]) => {
        const list: Engagement[] = engData.engagements || [];
        setEngagements(list);
        if (engData.from) {
          setFirmInfo(engData.from);
        }
        // /dashboard/engagements?id=… opens that letter (Clients page, the composer's success screen).
        const id = new URLSearchParams(window.location.search).get("id");
        const linked = id ? list.find((e) => e.id === id) : undefined;
        if (linked) setShowDetail(linked);
      })
      .catch(() => {
        setEngagements([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleVoid(id: string) {
    await fetch(`/api/dashboard/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    setEngagements((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "expired" as const,
              signers: e.signers.map((s) => ({ ...s, status: "expired" as const })),
            }
          : e
      )
    );
    setShowDetail(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/engagements/${id}`, { method: "DELETE" });
    setEngagements((prev) => prev.filter((e) => e.id !== id));
    setShowDetail(null);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Helper: client signers exclude the sender (order=0), which is auto-signed.
  function clientSigners(signers: Signer[]): Signer[] {
    return signers.filter((s) => s.order > 0);
  }

  function getSignerSummary(signers: Signer[]): string {
    const clients = clientSigners(signers);
    if (clients.length === 0) return "—";
    if (clients.length === 1) return clients[0].name;
    return `${clients[0].name} +${clients.length - 1} more`;
  }

  function getSignerEmails(signers: Signer[]): string {
    const clients = clientSigners(signers);
    if (clients.length === 0) return "";
    if (clients.length === 1) return clients[0].email;
    return `${clients.length} recipients`;
  }

  function getOverallStatus(eng: Engagement): string {
    const clients = clientSigners(eng.signers);
    if (clients.length === 0) return eng.status;
    if (clients.every((s) => s.status === "signed")) return "signed";
    if (clients.some((s) => s.status === "declined")) return "declined";
    if (clients.some((s) => s.status === "viewed")) return "viewed";
    return eng.status;
  }

  function getSignedCount(signers: Signer[]): string {
    const clients = clientSigners(signers);
    const signed = clients.filter((s) => s.status === "signed").length;
    return `${signed}/${clients.length} signed`;
  }

  const stats = {
    total: engagements.length,
    pending: engagements.filter((e) => {
      const s = getOverallStatus(e);
      return s === "sent" || s === "viewed";
    }).length,
    signed: engagements.filter((e) => getOverallStatus(e) === "signed").length,
    declined: engagements.filter((e) => getOverallStatus(e) === "declined").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-main)" }}
          >
            Engagement Letters
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Send engagement letters for clients to review and sign.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/engagements/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          <PlusIcon className="w-4 h-4" />
          New Engagement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Signed", value: stats.signed },
          { label: "Declined", value: stats.declined },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">All Engagements</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : engagements.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 w-10 h-10" style={{ color: "var(--text-muted)" }}>
              <PenLineIcon className="w-10 h-10" />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              No engagement letters yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Create your first engagement letter to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Recipients", "Subject", "Status", "Sent", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engagements.map((eng) => {
                  const overallStatus = getOverallStatus(eng);
                  const sc = statusConfig[overallStatus] || statusConfig.draft;
                  return (
                    <tr
                      key={eng.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors cursor-pointer"
                      onClick={() => setShowDetail(eng)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                          {getSignerSummary(eng.signers)}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {getSignerEmails(eng.signers)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm" style={{ color: "var(--text-main)" }}>
                          {eng.subject}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sc.color} ${sc.bg}`}>
                          {sc.label}
                        </span>
                        {eng.signers.length > 1 && (
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {getSignedCount(eng.signers)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(eng.sentAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowDetail(eng); }}
                            className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                            title="View"
                          >
                            <EyeIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          </button>
                          {(overallStatus === "sent" || overallStatus === "viewed") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleVoid(eng.id); }}
                              className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                              title="Void"
                            >
                              <XIcon className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(eng.id); }}
                            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowDetail(null)} />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                  {showDetail.subject}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {clientSigners(showDetail.signers).length} recipient{clientSigners(showDetail.signers).length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setShowDetail(null)}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Signers status — clients only (sender is auto-signed) */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Signers
                </p>
                <div className="space-y-2">
                  {clientSigners(showDetail.signers).map((signer) => {
                    const sc = statusConfig[signer.status] || statusConfig.draft;
                    return (
                      <div
                        key={signer.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                        style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                            {signer.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {signer.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sc.color} ${sc.bg}`}>
                            {sc.label}
                          </span>
                          {signer.signedAt && (
                            <p className="text-[10px] mt-0.5 text-emerald-500">
                              {formatDate(signer.signedAt)}
                            </p>
                          )}
                          {signer.viewedAt && !signer.signedAt && (
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              Viewed {formatDate(signer.viewedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Letter content — document view (renders both signature blocks) */}
              {(() => {
                const sender = showDetail.signers.find((s) => s.order === 0);
                const firstClient = clientSigners(showDetail.signers)[0];
                return (
                  <DocumentPreview
                    content={showDetail.content}
                    subject={showDetail.subject}
                    clientName={firstClient?.name || ""}
                    fromName={firmInfo.name}
                    fromCompany={firmInfo.company}
                    date={showDetail.sentAt ? new Date(showDetail.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined}
                    senderSignatureData={sender?.signatureData}
                    senderSignedAt={sender?.signedAt}
                    senderRole={sender?.role}
                    clientSignatureData={firstClient?.signatureData}
                    clientSignedAt={firstClient?.signedAt}
                    clientSignedName={firstClient?.name}
                  />
                );
              })()}

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Activity
                </p>
                <div className="space-y-1.5">
                  <TimelineItem label="Created" date={showDetail.createdAt} />
                  {showDetail.sentAt && <TimelineItem label="Sent" date={showDetail.sentAt} />}
                  {clientSigners(showDetail.signers).map((signer) => (
                    <div key={signer.id}>
                      {signer.viewedAt && (
                        <TimelineItem label={`Viewed by ${signer.name}`} date={signer.viewedAt} />
                      )}
                      {signer.signedAt && (
                        <TimelineItem label={`Signed by ${signer.name}`} date={signer.signedAt} color="text-emerald-500" />
                      )}
                      {signer.declinedAt && (
                        <TimelineItem label={`Declined by ${signer.name}`} date={signer.declinedAt} color="text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              {getOverallStatus(showDetail) === "signed" && (
                <button
                  onClick={async () => {
                    await fetch(
                      `/api/dashboard/engagements/${showDetail.id}/onboarding`,
                      { method: "POST" }
                    );
                    router.push("/dashboard/onboarding");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  Start Onboarding 🚀
                </button>
              )}
              {(getOverallStatus(showDetail) === "sent" || getOverallStatus(showDetail) === "viewed") && (
                <button
                  onClick={() => handleVoid(showDetail.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  Void
                </button>
              )}
              <button
                onClick={() => handleDelete(showDetail.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDetail(null)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)]"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
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

function TimelineItem({
  label,
  date,
  color,
}: {
  label: string;
  date: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
      <span className={`text-xs ${color || ""}`} style={color ? undefined : { color: "var(--text-main)" }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
