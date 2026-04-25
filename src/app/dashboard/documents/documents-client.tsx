"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useDocuments,
  useDocumentStats,
  updateDocument,
  deleteDocument,
  type Document,
} from "@/lib/hooks/use-documents";
import {
  useESignatures,
  createEsignRequest,
  voidEsignRequest,
  type ESignature,
} from "@/lib/hooks/use-esignatures";
import {
  FileIcon,
  SearchIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  CheckIcon,
  LinkIcon,
  PlusIcon,
  XIcon,
  SendIcon,
} from "@/components/ui/icons";
import { ClientPicker } from "@/components/dashboard/client-picker";
import { SignatureCertificate } from "@/components/signature-certificate";

const STATUS_COLORS = {
  new: "badge-blue",
  reviewed: "badge-emerald",
  archived: "badge-gray",
};

const CATEGORIES = [
  "W-2",
  "1099-INT",
  "1099-DIV",
  "1099-MISC",
  "1099-NEC",
  "1098",
  "Bank Statement",
  "ID / License",
  "Other",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DocumentsClient() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // E-sign state
  const [showEsignModal, setShowEsignModal] = useState(false);
  const [esignDocId, setEsignDocId] = useState<string | null>(null);
  const [esignName, setEsignName] = useState("");
  const [esignEmail, setEsignEmail] = useState("");
  const [esignSending, setEsignSending] = useState(false);
  const { esignatures, refetch: refetchEsign } = useESignatures();
  const [viewingCertificate, setViewingCertificate] = useState<ESignature | null>(null);

  const { documents, total, loading, refetch } = useDocuments({
    status: statusFilter !== "all" ? statusFilter : undefined,
    category: categoryFilter || undefined,
    search: search || undefined,
  });
  const { stats } = useDocumentStats();

  async function handleStatusChange(docId: string, newStatus: string) {
    await updateDocument(docId, { status: newStatus });
    refetch();
    if (selectedDoc?.id === docId) {
      setSelectedDoc({ ...selectedDoc, status: newStatus as Document["status"] });
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document permanently?")) return;
    await deleteDocument(docId);
    refetch();
    if (selectedDoc?.id === docId) setSelectedDoc(null);
  }

  function openEsignModal(doc: Document) {
    setEsignDocId(doc.id);
    setEsignName(doc.clientName || "");
    setEsignEmail(doc.clientEmail || "");
    setShowEsignModal(true);
  }

  async function handleSendEsign(e: React.FormEvent) {
    e.preventDefault();
    if (!esignDocId || !esignName || !esignEmail) return;
    setEsignSending(true);
    try {
      await createEsignRequest({
        documentId: esignDocId,
        signerName: esignName,
        signerEmail: esignEmail,
      });
      setShowEsignModal(false);
      setEsignDocId(null);
      setEsignName("");
      setEsignEmail("");
      refetchEsign();
    } finally {
      setEsignSending(false);
    }
  }

  function getEsignsForDoc(docId: string): ESignature[] {
    return esignatures.filter((e) => e.documentId === docId);
  }

  const ESIGN_STATUS_COLORS: Record<string, string> = {
    pending: "text-gray-400",
    sent: "text-blue-400",
    viewed: "text-cyan-400",
    signed: "text-emerald-400",
    declined: "text-red-400",
    expired: "text-yellow-400",
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
            Documents
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manage uploaded client documents
          </p>
        </div>
        <Link
          href="/dashboard/documents/links"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #2563EB, #06B6D4)",
          }}
        >
          <LinkIcon className="w-4 h-4" />
          Secure Links
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Uploads", value: stats.total, accent: "#2563EB" },
            { label: "Pending Review", value: stats.new, accent: "#06B6D4" },
            { label: "Reviewed", value: stats.reviewed, accent: "#10B981" },
            { label: "This Month", value: stats.thisMonth, accent: "#8B5CF6" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <p className="stat-label">
                {stat.label}
              </p>
              <p className="stat-value mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or client..."
            className="w-full pl-11 pr-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
          {["all", "new", "reviewed", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === s
                  ? "bg-blue-500/20 text-blue-400"
                  : "hover:bg-[var(--input-bg)]"
              }`}
              style={{ color: statusFilter === s ? undefined : "var(--text-muted)" }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none"
          style={{ color: "var(--text-main)" }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Document Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state py-16">
            <FileIcon className="empty-state-icon" />
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>No documents found</p>
            <p className="text-xs mt-1">
              Create a secure link to start collecting documents from clients.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Document</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th className="hidden md:table-cell">Size</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <td>
                      <p className="font-medium" style={{ color: "var(--text-main)" }}>
                        {doc.clientName || "Unknown"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {doc.clientEmail || ""}
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <span style={{ color: "var(--text-muted)" }}>
                        {doc.category || "—"}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(doc.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge uppercase ${STATUS_COLORS[doc.status]}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {doc.status === "new" && (
                          <button
                            onClick={() => handleStatusChange(doc.id, "reviewed")}
                            className="p-2 rounded-lg hover:bg-emerald-500/10 transition-colors"
                            title="Mark as Reviewed"
                          >
                            <CheckIcon className="w-4 h-4 text-emerald-400" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination info */}
        {total > 0 && (
          <div
            className="px-5 py-3 text-xs border-t border-[var(--glass-border)]"
            style={{ color: "var(--text-muted)" }}
          >
            Showing {documents.length} of {total} documents
          </div>
        )}
      </div>

      {/* E-Sign Modal */}
      {showEsignModal && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowEsignModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto z-50 glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                Request E-Signature
              </h2>
              <button onClick={() => setShowEsignModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--input-bg)]">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendEsign} className="space-y-4">
              <ClientPicker
                onSelect={(c) => {
                  setEsignName(c.name);
                  setEsignEmail(c.email);
                }}
                placeholder="Search existing clients..."
              />
              <div>
                <label className="block section-header mb-1.5">
                  Signer Name
                </label>
                <input
                  type="text"
                  value={esignName}
                  onChange={(e) => setEsignName(e.target.value)}
                  placeholder="Full name of the signer"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>
              <div>
                <label className="block section-header mb-1.5">
                  Signer Email
                </label>
                <input
                  type="email"
                  value={esignEmail}
                  onChange={(e) => setEsignEmail(e.target.value)}
                  placeholder="signer@email.com"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                The signer will receive an email with a secure link to review and sign the document.
              </p>
              <button
                type="submit"
                disabled={esignSending || !esignName || !esignEmail}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
              >
                <SendIcon className="w-4 h-4" />
                {esignSending ? "Sending..." : "Send Signature Request"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Detail Panel (slide-over) */}
      {selectedDoc && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setSelectedDoc(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 glass-card border-l border-[var(--glass-border)] overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                    {selectedDoc.fileName}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Uploaded {formatDate(selectedDoc.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-2 rounded-lg hover:bg-[var(--input-bg)] transition-colors"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="section-divider" />

              {/* Status */}
              <div>
                <p className="section-header">
                  Status
                </p>
                <div className="flex gap-2">
                  {(["new", "reviewed", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedDoc.id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                        selectedDoc.status === s
                          ? `${STATUS_COLORS[s]} border-current`
                          : "border-[var(--glass-border)] hover:border-blue-500/30"
                      }`}
                      style={{
                        color: selectedDoc.status === s ? undefined : "var(--text-muted)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Info */}
              <div>
                <p className="section-header">
                  Client
                </p>
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                    {selectedDoc.clientName || "Unknown"}
                  </p>
                  {selectedDoc.clientEmail && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedDoc.clientEmail}
                    </p>
                  )}
                  {selectedDoc.clientPhone && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedDoc.clientPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* File Details */}
              <div>
                <p className="section-header">
                  File Details
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Size</span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-main)" }}>
                      {formatFileSize(selectedDoc.fileSize)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Type</span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-main)" }}>
                      {selectedDoc.mimeType}
                    </span>
                  </div>
                  {selectedDoc.category && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Category</span>
                      <span style={{ color: "var(--text-main)" }}>{selectedDoc.category}</span>
                    </div>
                  )}
                  {selectedDoc.taxYear && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Tax Year</span>
                      <span style={{ color: "var(--text-main)" }}>{selectedDoc.taxYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold border border-[var(--glass-border)] hover:border-blue-500/30 transition-all"
                  style={{ color: "var(--text-main)" }}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => openEsignModal(selectedDoc)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  <SendIcon className="w-4 h-4" />
                  E-Sign
                </button>
                <button
                  onClick={() => handleDelete(selectedDoc.id)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {/* E-Signature Status */}
              {getEsignsForDoc(selectedDoc.id).length > 0 && (
                <div>
                  <p className="section-header">
                    E-Signatures
                  </p>
                  <div className="space-y-2">
                    {getEsignsForDoc(selectedDoc.id).map((es) => (
                      <div
                        key={es.id}
                        className="p-3 rounded-lg border border-[var(--glass-border)]"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                            {es.signerName}
                          </p>
                          <span
                            className={`text-[10px] font-bold uppercase ${ESIGN_STATUS_COLORS[es.status] || "text-gray-400"}`}
                          >
                            {es.status}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {es.signerEmail}
                        </p>
                        {es.signedAt && (
                          <p className="text-[10px] text-emerald-400 mt-1">
                            Signed {formatDate(es.signedAt)}
                          </p>
                        )}
                        {es.status === "signed" && es.signatureData && (
                          <div className="mt-2 p-2 bg-white rounded-lg">
                            <img
                              src={es.signatureData}
                              alt="Signature"
                              className="h-12 mx-auto"
                            />
                          </div>
                        )}
                        {es.declineReason && (
                          <p className="text-[10px] text-rose-400 mt-1 italic">
                            &quot;{es.declineReason}&quot;
                          </p>
                        )}
                        {(es.status === "signed" || es.status === "declined") && (
                          <button
                            onClick={() => setViewingCertificate(es)}
                            className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                          >
                            <EyeIcon className="w-3 h-3" />
                            View Certificate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="section-header">
                  Notes
                </p>
                <textarea
                  defaultValue={selectedDoc.notes || ""}
                  placeholder="Add review notes..."
                  onBlur={(e) => {
                    if (e.target.value !== (selectedDoc.notes || "")) {
                      updateDocument(selectedDoc.id, { notes: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 resize-none h-24 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Signature Certificate Modal */}
      {viewingCertificate && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setViewingCertificate(null)}
          />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                Signature Certificate
              </h2>
              <button
                onClick={() => setViewingCertificate(null)}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SignatureCertificate
                documentName={viewingCertificate.documentName || "Document"}
                status={viewingCertificate.status}
                signerName={viewingCertificate.signerName}
                signerEmail={viewingCertificate.signerEmail}
                signatureData={viewingCertificate.signatureData}
                signatureIp={viewingCertificate.signatureIp}
                sentAt={viewingCertificate.sentAt}
                viewedAt={viewingCertificate.viewedAt}
                signedAt={viewingCertificate.signedAt}
                declinedAt={viewingCertificate.declinedAt}
                declineReason={viewingCertificate.declineReason}
                senderName={viewingCertificate.senderName}
                senderCompany={viewingCertificate.senderCompany}
                senderEmail={viewingCertificate.senderEmail}
              />
            </div>
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end">
              <button
                onClick={() => setViewingCertificate(null)}
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
