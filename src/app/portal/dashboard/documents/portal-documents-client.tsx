"use client";

import { useState, useEffect } from "react";
import { FileIcon, PenLineIcon, UploadIcon, DownloadIcon, EyeIcon, XIcon } from "@/components/ui/icons";
import { SignatureCertificate } from "@/components/signature-certificate";

interface Document {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string | null;
  taxYear: string | null;
  status: string;
  createdAt: string;
}

interface SharedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string | null;
  sharedAt: string | null;
}

interface UploadLink {
  id: string;
  token: string;
  message: string | null;
  requiredDocuments: string[] | null;
  maxUploads: number | null;
  uploadCount: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface EsignRequest {
  id: string;
  token: string;
  signerName: string;
  signerEmail: string;
  status: string;
  signedAt: string | null;
  viewedAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  signatureData: string | null;
  signatureIp: string | null;
  documentName: string;
  senderName: string;
  senderCompany: string;
  senderEmail: string;
}

interface DocumentsData {
  documents: Document[];
  sharedDocuments: SharedDocument[];
  uploadLinks: UploadLink[];
  esignRequests: EsignRequest[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const esignStatusBadge: Record<string, string> = {
  pending: "badge badge-gray",
  sent: "badge badge-blue",
  viewed: "badge badge-blue",
  signed: "badge badge-emerald",
  declined: "badge badge-rose",
  expired: "badge badge-gray",
};

export function PortalDocumentsClient() {
  const [data, setData] = useState<DocumentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewingCertificate, setViewingCertificate] = useState<EsignRequest | null>(null);

  async function handleDownload(doc: SharedDocument) {
    setDownloading(doc.id);
    try {
      const res = await fetch(`/api/portal/documents/${doc.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Failed to download file. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/documents");
        if (res.ok) {
          const d = await res.json();
          setData(d);
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
          <p className="text-sm">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm">Unable to load documents.</p>
      </div>
    );
  }

  const activeLinks = data.uploadLinks.filter((l) => l.status === "active");
  const pendingEsigns = data.esignRequests.filter((e) =>
    ["pending", "sent", "viewed"].includes(e.status)
  );
  const completedEsigns = data.esignRequests.filter((e) =>
    ["signed", "declined", "expired"].includes(e.status)
  );

  const isEmpty =
    data.documents.length === 0 &&
    (data.sharedDocuments || []).length === 0 &&
    data.uploadLinks.length === 0 &&
    data.esignRequests.length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Documents
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Your uploaded documents, upload requests, and signature requests.
        </p>
      </div>

      {isEmpty && (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <FileIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No documents yet
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Documents, upload requests, and signature requests will appear here.
          </p>
        </div>
      )}

      {/* Upload Requests */}
      {activeLinks.length > 0 && (
        <div>
          <h2 className="section-header mb-4">Upload Requests</h2>
          <div className="space-y-3">
            {activeLinks.map((link) => (
              <div key={link.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: "var(--accent-amber-bg)",
                        border: "1px solid var(--accent-amber-border)",
                      }}
                    >
                      <UploadIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      {link.message && (
                        <p className="text-sm mb-2" style={{ color: "var(--text-main)" }}>
                          {link.message}
                        </p>
                      )}
                      {link.requiredDocuments && link.requiredDocuments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {link.requiredDocuments.map((doc, i) => (
                            <span key={i} className="badge badge-gray">{doc}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{link.uploadCount} uploaded</span>
                        {link.expiresAt && (
                          <span>Expires {formatDate(link.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/upload/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-4 py-2 rounded-full text-sm font-bold text-white no-underline"
                    style={{
                      background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                    }}
                  >
                    Upload
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents from CPA */}
      {(data.sharedDocuments || []).length > 0 && (
        <div>
          <h2 className="section-header mb-4">Documents from Your CPA</h2>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Category</th>
                    <th>Size</th>
                    <th>Date Shared</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sharedDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileIcon className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span className="truncate max-w-[200px]" style={{ color: "var(--text-main)" }}>
                            {doc.fileName}
                          </span>
                        </div>
                      </td>
                      <td>
                        {doc.category ? (
                          <span className="badge badge-gray">{doc.category}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>{formatFileSize(doc.fileSize)}</td>
                      <td>{formatDate(doc.sharedAt)}</td>
                      <td>
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloading === doc.id}
                          className="flex items-center gap-1.5 text-sm font-medium hover:underline disabled:opacity-50"
                          style={{ color: "var(--accent-blue)" }}
                        >
                          {downloading === doc.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <DownloadIcon className="w-3.5 h-3.5" />
                          )}
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Signature Requests */}
      {(pendingEsigns.length > 0 || completedEsigns.length > 0) && (
        <div>
          <h2 className="section-header mb-4">Signature Requests</h2>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pendingEsigns, ...completedEsigns].map((es) => (
                    <tr key={es.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <PenLineIcon className="w-4 h-4 shrink-0 text-purple-400" />
                          <span style={{ color: "var(--text-main)" }}>
                            {es.documentName || "E-Signature Request"}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(es.createdAt)}</td>
                      <td>
                        <span className={esignStatusBadge[es.status] || "badge badge-gray"}>
                          {es.status === "signed"
                            ? `Signed ${formatDate(es.signedAt)}`
                            : es.status.charAt(0).toUpperCase() + es.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {["pending", "sent", "viewed"].includes(es.status) ? (
                          <a
                            href={`/esign/${es.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium no-underline hover:underline"
                            style={{ color: "var(--accent-blue)" }}
                          >
                            Review & Sign
                          </a>
                        ) : es.status === "signed" || es.status === "declined" ? (
                          <button
                            onClick={() => setViewingCertificate(es)}
                            className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                            style={{ color: "var(--accent-blue)" }}
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            View Certificate
                          </button>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {viewingCertificate && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
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
                documentName={viewingCertificate.documentName}
                status={viewingCertificate.status}
                signerName={viewingCertificate.signerName}
                signerEmail={viewingCertificate.signerEmail}
                signatureData={viewingCertificate.signatureData}
                signatureIp={viewingCertificate.signatureIp}
                sentAt={viewingCertificate.sentAt}
                viewedAt={viewingCertificate.viewedAt}
                signedAt={viewingCertificate.signedAt}
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

      {/* Your Documents */}
      {data.documents.length > 0 && (
        <div>
          <h2 className="section-header mb-4">Your Documents</h2>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Category</th>
                    <th>Size</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileIcon className="w-4 h-4 shrink-0 text-cyan-400" />
                          <span className="truncate max-w-[200px]" style={{ color: "var(--text-main)" }}>
                            {doc.fileName}
                          </span>
                        </div>
                      </td>
                      <td>
                        {doc.category ? (
                          <span className="badge badge-gray">{doc.category}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>{formatFileSize(doc.fileSize)}</td>
                      <td>{formatDate(doc.createdAt)}</td>
                      <td>
                        <span
                          className={
                            doc.status === "reviewed"
                              ? "badge badge-emerald"
                              : doc.status === "archived"
                              ? "badge badge-gray"
                              : "badge badge-blue"
                          }
                        >
                          {doc.status === "new"
                            ? "Received"
                            : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
