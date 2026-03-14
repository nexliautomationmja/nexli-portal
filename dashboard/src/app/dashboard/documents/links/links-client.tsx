"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useDocumentLinks,
  createDocumentLink,
  revokeDocumentLink,
  deleteDocumentLink,
  type DocumentLink,
} from "@/lib/hooks/use-document-links";
import {
  LinkIcon,
  PlusIcon,
  CopyIcon,
  TrashIcon,
  XIcon,
  CheckIcon,
  SendIcon,
} from "@/components/ui/icons";

const DOCUMENT_TYPES = [
  "W-2",
  "1099-INT",
  "1099-DIV",
  "1099-MISC",
  "1099-NEC",
  "1098",
  "Bank Statements",
  "ID / License",
  "Other",
];

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

export function LinksClient() {
  const { links, loading, refetch } = useDocumentLinks();
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [sendViaEmail, setSendViaEmail] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createDocumentLink({
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        message: message || undefined,
        requiredDocuments: requiredDocs.length > 0 ? requiredDocs : undefined,
        expiresInDays,
        deliveryMethod: sendViaEmail && clientEmail ? "email" : "manual",
      });
      setShowCreate(false);
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setMessage("");
      setRequiredDocs([]);
      setExpiresInDays(14);
      setSendViaEmail(false);
      refetch();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    if (!confirm("Revoke this link? Clients will no longer be able to upload.")) return;
    await revokeDocumentLink(linkId);
    refetch();
  }

  async function handleDelete(linkId: string) {
    if (!confirm("Delete this link permanently?")) return;
    await deleteDocumentLink(linkId);
    refetch();
  }

  async function handleResendEmail(linkId: string) {
    setResendingId(linkId);
    try {
      const res = await fetch(`/api/dashboard/links/${linkId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to resend email");
      }
    } catch {
      alert("Failed to resend email");
    } finally {
      setResendingId(null);
    }
  }

  function copyLink(link: DocumentLink) {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const url = `${portalUrl}/upload/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleDocType(docType: string) {
    setRequiredDocs((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : [...prev, docType]
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/documents"
              className="text-sm hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Documents
            </Link>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
              Secure Links
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Generate secure upload links for your clients
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          <PlusIcon className="w-4 h-4" />
          New Link
        </button>
      </div>

      {/* Links List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading links...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="empty-state py-16">
            <LinkIcon className="empty-state-icon" />
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>No secure links yet</p>
            <p className="text-xs mt-1">
              Create a link to collect documents from a client securely.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)]">
            {links.map((link) => {
              const expired = isExpired(link.expiresAt);
              const revoked = link.status === "revoked";
              const inactive = expired || revoked;
              const wasEmailed = link.deliveryMethod === "email";

              return (
                <div
                  key={link.id}
                  className={`p-5 flex items-center justify-between gap-4 ${inactive ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main)" }}>
                        {link.clientName || "Unnamed Client"}
                      </p>
                      {revoked && (
                        <span className="badge badge-rose uppercase">Revoked</span>
                      )}
                      {expired && !revoked && (
                        <span className="badge badge-amber uppercase">Expired</span>
                      )}
                      {!inactive && (
                        <span className="badge badge-emerald uppercase">Active</span>
                      )}
                      {wasEmailed && (
                        <span className="badge badge-blue uppercase">Emailed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      {link.clientEmail && <span>{link.clientEmail}</span>}
                      <span>{link.uploadCount || 0} / {link.maxUploads} uploads</span>
                      <span>Expires {formatDate(link.expiresAt)}</span>
                    </div>
                    {link.requiredDocuments && (link.requiredDocuments as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(link.requiredDocuments as string[]).map((doc) => (
                          <span
                            key={doc}
                            className="badge badge-gray"
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!inactive && link.clientEmail && (
                      <button
                        onClick={() => handleResendEmail(link.id)}
                        disabled={resendingId === link.id}
                        className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                        title="Resend email"
                      >
                        {resendingId === link.id ? (
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <MailIcon className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    )}
                    {!inactive && (
                      <button
                        onClick={() => copyLink(link)}
                        className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                        title="Copy link"
                      >
                        {copiedId === link.id ? (
                          <CheckIcon className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <CopyIcon className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    )}
                    {!inactive && (
                      <button
                        onClick={() => handleRevoke(link.id)}
                        className="p-2 rounded-lg hover:bg-amber-500/10 transition-colors"
                        title="Revoke link"
                      >
                        <XIcon className="w-4 h-4 text-amber-400" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Link Modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto z-50 glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                Create Secure Upload Link
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--input-bg)]">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Client Info */}
              <div>
                <label className="block section-header mb-1.5">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Sarah Mitchell"
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block section-header mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                </div>
                <div>
                  <label className="block section-header mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                </div>
              </div>

              {/* Send via email toggle */}
              {clientEmail && (
                <label className="flex items-center gap-3 p-4 rounded-lg border border-[var(--glass-border)] cursor-pointer hover:border-blue-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendViaEmail}
                    onChange={(e) => setSendViaEmail(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <MailIcon className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        Send link via email
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Automatically email the upload link to {clientEmail}
                      </p>
                    </div>
                  </div>
                </label>
              )}

              {/* Message */}
              <div>
                <label className="block section-header mb-1.5">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Instructions or notes for the client..."
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 resize-none h-16 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>

              {/* Required Documents */}
              <div>
                <label className="block section-header mb-2">
                  Required Documents
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_TYPES.map((docType) => (
                    <button
                      key={docType}
                      type="button"
                      onClick={() => toggleDocType(docType)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        requiredDocs.includes(docType)
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "border-[var(--glass-border)] hover:border-blue-500/30"
                      }`}
                      style={{
                        color: requiredDocs.includes(docType) ? undefined : "var(--text-muted)",
                      }}
                    >
                      {docType}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block section-header mb-1.5">
                  Expires In
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none"
                  style={{ color: "var(--text-main)" }}
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
              >
                {creating ? (
                  "Creating..."
                ) : sendViaEmail && clientEmail ? (
                  <>
                    <SendIcon className="w-4 h-4" />
                    Create & Send Link
                  </>
                ) : (
                  "Generate Secure Link"
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
