"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailLogEntry {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  emailType: string;
  status: string;
  error: string | null;
  createdAt: string;
}

interface EmailLogData {
  emails: EmailLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const EMAIL_TYPES = [
  { value: "", label: "All Types" },
  { value: "invoice", label: "Invoice" },
  { value: "invoice_paid", label: "Invoice Paid" },
  { value: "invoice_reminder", label: "Invoice Reminder" },
  { value: "payment_receipt", label: "Payment Receipt" },
  { value: "upload_request", label: "Upload Request" },
  { value: "esign_request", label: "E-Sign Request" },
  { value: "esign_completed", label: "E-Sign Completed" },
  { value: "engagement_request", label: "Engagement Request" },
  { value: "engagement_signed", label: "Engagement Signed" },
  { value: "magic_link", label: "Magic Link" },
];

function formatType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function EmailLog() {
  const [data, setData] = useState<EmailLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/dashboard/email-log?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  function handleTypeChange(type: string) {
    setTypeFilter(type);
    setPage(1);
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs font-medium border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50 transition-colors"
          style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
        >
          {EMAIL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data ? `${data.total} total` : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.emails.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No emails sent yet. Emails will appear here once you send invoices,
            engagement letters, or document requests.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.emails.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-main)" }}
                        >
                          {email.recipientName || email.recipientEmail}
                        </p>
                        {email.recipientName && (
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {email.recipientEmail}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <p
                        className="text-sm truncate max-w-[200px]"
                        style={{ color: "var(--text-main)" }}
                        title={email.subject}
                      >
                        {email.subject}
                      </p>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {formatType(email.emailType)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          email.status === "sent"
                            ? "badge-emerald"
                            : "badge-rose"
                        }`}
                      >
                        {email.status === "sent" ? "Sent" : "Failed"}
                      </span>
                      {email.error && (
                        <p
                          className="text-xs mt-1 truncate max-w-[120px]"
                          style={{ color: "var(--text-muted)" }}
                          title={email.error}
                        >
                          {email.error}
                        </p>
                      )}
                    </td>
                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {timeAgo(email.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--glass-border)] disabled:opacity-30 hover:bg-[var(--input-bg)] transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                Previous
              </button>
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--glass-border)] disabled:opacity-30 hover:bg-[var(--input-bg)] transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
