"use client";

import { useState, useEffect } from "react";
import { PenLineIcon, SendIcon, XIcon, PlusIcon, EyeIcon, TrashIcon } from "@/components/ui/icons";

interface Engagement {
  id: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  content: string;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
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
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState<Engagement | null>(null);

  // Compose form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/engagements").then((r) => r.json()),
      fetch("/api/dashboard/engagements/templates").then((r) => r.json()),
    ])
      .then(([engData, tmplData]) => {
        setEngagements(engData.engagements || []);
        setTemplates(tmplData.templates || []);
      })
      .catch(() => {
        setEngagements([]);
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setContent(tmpl.content);
    }
  }

  async function handleSend() {
    if (!clientName || !clientEmail || !subject || !content) return;
    setSending(true);
    try {
      const res = await fetch("/api/dashboard/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          subject,
          content,
          templateId: selectedTemplate || undefined,
          expiresInDays,
          saveAsTemplate,
          templateName: saveAsTemplate ? templateName : undefined,
        }),
      });
      const data = await res.json();
      if (data.engagement) {
        setEngagements((prev) => [data.engagement, ...prev]);
        if (saveAsTemplate && templateName) {
          // Refresh templates
          const tmplRes = await fetch("/api/dashboard/engagements/templates");
          const tmplData = await tmplRes.json();
          setTemplates(tmplData.templates || []);
        }
      }
      resetForm();
      setShowCompose(false);
    } finally {
      setSending(false);
    }
  }

  async function handleVoid(id: string) {
    await fetch(`/api/dashboard/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    setEngagements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "expired" as const } : e))
    );
    setShowDetail(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/engagements/${id}`, { method: "DELETE" });
    setEngagements((prev) => prev.filter((e) => e.id !== id));
    setShowDetail(null);
  }

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setSubject("");
    setContent("");
    setSelectedTemplate("");
    setExpiresInDays(30);
    setSaveAsTemplate(false);
    setTemplateName("");
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const stats = {
    total: engagements.length,
    pending: engagements.filter((e) => e.status === "sent" || e.status === "viewed").length,
    signed: engagements.filter((e) => e.status === "signed").length,
    declined: engagements.filter((e) => e.status === "declined").length,
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
          onClick={() => setShowCompose(true)}
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
                  {["Client", "Subject", "Status", "Sent", "Actions"].map((h) => (
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
                  const sc = statusConfig[eng.status] || statusConfig.draft;
                  return (
                    <tr
                      key={eng.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors cursor-pointer"
                      onClick={() => setShowDetail(eng)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                          {eng.clientName}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {eng.clientEmail}
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
                          {(eng.status === "sent" || eng.status === "viewed") && (
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

      {/* Compose Modal */}
      {showCompose && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowCompose(false)} />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                New Engagement Letter
              </h2>
              <button
                onClick={() => { setShowCompose(false); resetForm(); }}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Client info row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Client Email *
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="2025 Tax Preparation Engagement Letter"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                  style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                />
              </div>

              {/* Template selector */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Use Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  >
                    <option value="">Select a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Letter content */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Letter Content *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Dear [Client Name],&#10;&#10;We are pleased to confirm our understanding of the services we are to provide...&#10;&#10;Please review this letter carefully and sign below to indicate your agreement."
                  rows={12}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Expires In (days)
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                  style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              {/* Save as template */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-sm" style={{ color: "var(--text-main)" }}>
                    Save as template for future use
                  </span>
                </label>
                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g. Standard Tax Engagement)"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  />
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowCompose(false); resetForm(); }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)]"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!clientName || !clientEmail || !subject || !content || sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
              >
                <SendIcon className="w-3.5 h-3.5" />
                {sending ? "Sending..." : "Send Engagement Letter"}
              </button>
            </div>
          </div>
        </>
      )}

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
                  {showDetail.clientName} &bull; {showDetail.clientEmail}
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
              {/* Status */}
              <div className="flex items-center gap-4">
                {(() => {
                  const sc = statusConfig[showDetail.status] || statusConfig.draft;
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${sc.color} ${sc.bg}`}>
                      {sc.label}
                    </span>
                  );
                })()}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Sent {formatDate(showDetail.sentAt)}
                </span>
                {showDetail.viewedAt && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Viewed {formatDate(showDetail.viewedAt)}
                  </span>
                )}
                {showDetail.signedAt && (
                  <span className="text-xs text-emerald-500">
                    Signed {formatDate(showDetail.signedAt)}
                  </span>
                )}
              </div>

              {/* Letter content */}
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}
              >
                <pre
                  className="whitespace-pre-wrap text-sm leading-relaxed font-sans"
                  style={{ color: "var(--text-main)" }}
                >
                  {showDetail.content}
                </pre>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Activity
                </p>
                <div className="space-y-1.5">
                  <TimelineItem label="Created" date={showDetail.createdAt} />
                  {showDetail.sentAt && <TimelineItem label="Sent" date={showDetail.sentAt} />}
                  {showDetail.viewedAt && <TimelineItem label="Viewed by client" date={showDetail.viewedAt} />}
                  {showDetail.signedAt && <TimelineItem label="Signed by client" date={showDetail.signedAt} color="text-emerald-500" />}
                  {showDetail.declinedAt && <TimelineItem label="Declined by client" date={showDetail.declinedAt} color="text-red-500" />}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              {(showDetail.status === "sent" || showDetail.status === "viewed") && (
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
