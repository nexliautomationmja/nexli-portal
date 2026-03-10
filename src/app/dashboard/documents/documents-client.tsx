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
  FileIcon,
  SearchIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  CheckIcon,
  LinkIcon,
  PlusIcon,
  XIcon,
} from "@/components/ui/icons";

const STATUS_COLORS = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reviewed: "bg-green-500/20 text-green-400 border-green-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-black tracking-tight"
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
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
            { label: "Total Uploads", value: stats.total, color: "text-[var(--text-main)]" },
            { label: "Pending Review", value: stats.new, color: "text-blue-400" },
            { label: "Reviewed", value: stats.reviewed, color: "text-green-400" },
            { label: "This Month", value: stats.thisMonth, color: "text-cyan-400" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-4">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {stat.label}
              </p>
              <p className={`text-2xl font-black mt-1 ${stat.color}`}>
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
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or client..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
          {["all", "new", "reviewed", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                statusFilter === s
                  ? "bg-blue-500/20 text-blue-400"
                  : "hover:bg-[var(--glass-bg)]"
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
          className="px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none"
          style={{ color: "var(--text-main)" }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Document Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center" style={{ color: "var(--text-muted)" }}>
            <FileIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No documents found</p>
            <p className="text-xs mt-1">
              Create a secure link to start collecting documents from clients.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-[10px] font-bold uppercase tracking-widest border-b border-[var(--glass-border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Document</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Size</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-[var(--glass-border)] hover:bg-blue-500/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {doc.clientName || "Unknown"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {doc.clientEmail || ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <span
                          className="text-sm truncate max-w-[200px]"
                          style={{ color: "var(--text-main)" }}
                        >
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {doc.category || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(doc.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_COLORS[doc.status]}`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {doc.status === "new" && (
                          <button
                            onClick={() => handleStatusChange(doc.id, "reviewed")}
                            className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
                            title="Mark as Reviewed"
                          >
                            <CheckIcon className="w-4 h-4 text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4 text-red-400" />
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
            className="px-4 py-3 text-xs border-t border-[var(--glass-border)]"
            style={{ color: "var(--text-muted)" }}
          >
            Showing {documents.length} of {total} documents
          </div>
        )}
      </div>

      {/* Detail Panel (slide-over) */}
      {selectedDoc && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedDoc(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 glass-card border-l border-[var(--glass-border)] overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black" style={{ color: "var(--text-main)" }}>
                    {selectedDoc.fileName}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Uploaded {formatDate(selectedDoc.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Status */}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Status
                </p>
                <div className="flex gap-2">
                  {(["new", "reviewed", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedDoc.id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border transition-all ${
                        selectedDoc.status === s
                          ? STATUS_COLORS[s]
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
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client
                </p>
                <div className="space-y-1">
                  <p className="text-sm" style={{ color: "var(--text-main)" }}>
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
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  File Details
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Size</span>
                    <span className="font-mono" style={{ color: "var(--text-main)" }}>
                      {formatFileSize(selectedDoc.fileSize)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Type</span>
                    <span className="font-mono" style={{ color: "var(--text-main)" }}>
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-all"
                  style={{ color: "var(--text-main)" }}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(selectedDoc.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Notes */}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
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
                  className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 resize-none h-20 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
