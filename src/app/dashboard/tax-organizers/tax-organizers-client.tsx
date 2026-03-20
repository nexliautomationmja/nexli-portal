"use client";

import { useState, useEffect } from "react";
import {
  FormIcon,
  PlusIcon,
  XIcon,
  EyeIcon,
  SendIcon,
  TrashIcon,
  CheckIcon,
  ClockIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { ClientPicker } from "@/components/dashboard/client-picker";

interface OrganizerItem {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  taxYear: string;
  returnType: string;
  status: string;
  message: string | null;
  generatedDocuments: { document: string; category: string }[] | null;
  sentAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  totalSections: number;
  completedSections: number;
  createdAt: string;
}

interface SectionData {
  id: string;
  sectionKey: string;
  data: Record<string, unknown>;
  isComplete: boolean;
}

const returnTypeLabels: Record<string, string> = {
  "1040": "Individual (1040)",
  "1120": "C Corp (1120)",
  "1120S": "S Corp (1120-S)",
  "1065": "Partnership (1065)",
  "1041": "Estate/Trust (1041)",
};

const statusBadge: Record<string, string> = {
  draft: "badge badge-gray",
  sent: "badge badge-blue",
  in_progress: "badge badge-amber",
  completed: "badge badge-emerald",
  reviewed: "badge badge-violet",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  in_progress: "In Progress",
  completed: "Completed",
  reviewed: "Reviewed",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaxOrganizersClient() {
  const [organizers, setOrganizers] = useState<OrganizerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    organizer: OrganizerItem;
    sections: SectionData[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Create form state
  const [createForm, setCreateForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    taxYear: new Date().getFullYear().toString(),
    returnType: "1040",
    message: "",
    expiresInDays: 90,
  });
  const [creating, setCreating] = useState(false);

  async function loadOrganizers() {
    try {
      const res = await fetch("/api/dashboard/tax-organizers");
      if (res.ok) {
        const data = await res.json();
        setOrganizers(data.organizers);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganizers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.clientName || !createForm.clientEmail || !createForm.taxYear) return;
    setCreating(true);
    try {
      const res = await fetch("/api/dashboard/tax-organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({
          clientName: "",
          clientEmail: "",
          clientPhone: "",
          taxYear: new Date().getFullYear().toString(),
          returnType: "1040",
          message: "",
          expiresInDays: 90,
        });
        await loadOrganizers();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function loadDetail(id: string) {
    setShowDetail(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/tax-organizers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleMarkReviewed(id: string) {
    await fetch(`/api/dashboard/tax-organizers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    await loadOrganizers();
    if (detailData?.organizer.id === id) {
      setDetailData((prev) =>
        prev
          ? {
              ...prev,
              organizer: { ...prev.organizer, status: "reviewed", reviewedAt: new Date().toISOString() },
            }
          : null
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this organizer? This cannot be undone.")) return;
    await fetch(`/api/dashboard/tax-organizers/${id}`, { method: "DELETE" });
    setShowDetail(null);
    setDetailData(null);
    await loadOrganizers();
  }

  const filtered = search
    ? organizers.filter(
        (o) =>
          o.clientName.toLowerCase().includes(search.toLowerCase()) ||
          o.clientEmail.toLowerCase().includes(search.toLowerCase())
      )
    : organizers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Detail View ──
  if (showDetail && detailData) {
    const org = detailData.organizer;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setShowDetail(null); setDetailData(null); }}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <XIcon className="w-4 h-4" />
            Back to Organizers
          </button>
          <div className="flex items-center gap-2">
            {org.status === "completed" && (
              <button
                onClick={() => handleMarkReviewed(org.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
              >
                <CheckIcon className="w-4 h-4" />
                Mark Reviewed
              </button>
            )}
            <button
              onClick={() => handleDelete(org.id)}
              className="p-2 rounded-lg hover:opacity-80 transition-opacity text-rose-400"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Header card */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                {org.clientName}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {org.clientEmail}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className={statusBadge[org.status] || "badge badge-gray"}>
                  {statusLabel[org.status] || org.status}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {returnTypeLabels[org.returnType] || org.returnType} &bull; {org.taxYear}
                </span>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
              <p>Sent {formatDate(org.sentAt)}</p>
              {org.completedAt && <p className="text-emerald-400">Completed {formatDate(org.completedAt)}</p>}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Progress
              </span>
              <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                {org.completedSections}/{org.totalSections} sections
              </span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: "var(--input-bg)" }}>
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${org.totalSections > 0 ? (org.completedSections / org.totalSections) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Section Responses */}
        <div className="glass-card p-5 space-y-4">
          <p className="section-header">Responses</p>
          {detailData.sections.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No responses yet.</p>
          ) : (
            detailData.sections.map((section) => (
              <div key={section.id} className="border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                    {section.sectionKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                  {section.isComplete ? (
                    <span className="badge badge-emerald">Complete</span>
                  ) : (
                    <span className="badge badge-gray">Pending</span>
                  )}
                </div>
                {section.isComplete && Object.keys(section.data).length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                    {Object.entries(section.data).map(([key, value]) => {
                      if (key.startsWith("heading") || value === null || value === undefined || value === "") return null;
                      const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
                      if (displayValue === "{}") return null;
                      return (
                        <div key={key} className="text-xs py-0.5">
                          <span style={{ color: "var(--text-muted)" }}>
                            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}:
                          </span>{" "}
                          <span style={{ color: "var(--text-main)" }}>
                            {displayValue.length > 60 ? displayValue.slice(0, 60) + "..." : displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Generated Documents */}
        {org.generatedDocuments && (org.generatedDocuments as { document: string; category: string }[]).length > 0 && (
          <div className="glass-card p-5">
            <p className="section-header mb-3">Generated Document Request</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Based on the client&apos;s answers, these documents have been requested:
            </p>
            <div className="space-y-1.5">
              {(org.generatedDocuments as { document: string; category: string }[]).map((doc, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span style={{ color: "var(--text-main)" }}>{doc.document}</span>
                  <span className="badge badge-gray ml-auto">{doc.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
            Tax Organizers
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Send questionnaires to clients to collect tax information and auto-generate document requests.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          <PlusIcon className="w-4 h-4" />
          Send Organizer
        </button>
      </div>

      {/* Search */}
      {organizers.length > 0 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon className="w-4 h-4" /></span>
          <input
            type="text"
            placeholder="Search by client name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--card-border)",
              color: "var(--text-main)",
            }}
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <FormIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            {organizers.length === 0 ? "No tax organizers" : "No results"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {organizers.length === 0
              ? "Send a tax organizer to a client to get started."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((org) => (
            <div key={org.id} className="glass-card p-4 hover:bg-[var(--input-bg)] transition-colors cursor-pointer" onClick={() => loadDetail(org.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--accent-purple-bg, rgba(139,92,246,0.1))",
                      border: "1px solid var(--accent-purple-border, rgba(139,92,246,0.2))",
                    }}
                  >
                    <FormIcon className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {org.clientName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {returnTypeLabels[org.returnType] || org.returnType} &bull; {org.taxYear}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={statusBadge[org.status] || "badge badge-gray"}>
                      {statusLabel[org.status] || org.status}
                    </span>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {org.completedSections}/{org.totalSections} sections
                    </p>
                  </div>
                  <span style={{ color: "var(--text-muted)" }}><EyeIcon className="w-4 h-4" /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-5"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                Send Tax Organizer
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:opacity-80">
                <span style={{ color: "var(--text-muted)" }}><XIcon className="w-5 h-5" /></span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Client Picker */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Client
                </label>
                <ClientPicker
                  onSelect={(c) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      clientName: c.name,
                      clientEmail: c.email,
                      clientPhone: c.phone || "",
                    }))
                  }
                  placeholder="Search clients..."
                />
                {createForm.clientName && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-main)" }}>
                    {createForm.clientName} ({createForm.clientEmail})
                  </p>
                )}
              </div>

              {/* Or manual entry */}
              {!createForm.clientName && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                        Client Name *
                      </label>
                      <input
                        type="text"
                        value={createForm.clientName}
                        onChange={(e) => setCreateForm((p) => ({ ...p, clientName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                        Client Email *
                      </label>
                      <input
                        type="email"
                        value={createForm.clientEmail}
                        onChange={(e) => setCreateForm((p) => ({ ...p, clientEmail: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Tax Year *
                  </label>
                  <select
                    value={createForm.taxYear}
                    onChange={(e) => setCreateForm((p) => ({ ...p, taxYear: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const y = new Date().getFullYear() - offset;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Return Type
                  </label>
                  <select
                    value={createForm.returnType}
                    onChange={(e) => setCreateForm((p) => ({ ...p, returnType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  >
                    {Object.entries(returnTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Message (optional)
                </label>
                <textarea
                  rows={2}
                  value={createForm.message}
                  onChange={(e) => setCreateForm((p) => ({ ...p, message: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
                  placeholder="Add a personal note to the client..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.clientName || !createForm.clientEmail}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <SendIcon className="w-4 h-4" />
                  )}
                  Send Organizer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
