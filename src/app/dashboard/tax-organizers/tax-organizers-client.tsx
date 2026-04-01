"use client";

import { useState, useEffect } from "react";
import {
  FormIcon,
  PlusIcon,
  XIcon,
  EyeIcon,
  SendIcon,
  TrashIcon,
  ClockIcon,
  SearchIcon,
  CopyIcon,
} from "@/components/ui/icons";
import { ClientPicker } from "@/components/dashboard/client-picker";

interface OrganizerLink {
  id: string;
  clientName: string | null;
  clientEmail: string | null;
  taxYear: string;
  returnType: string;
  status: string;
  token: string;
  expiresAt: string;
  lastAccessedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  submission: {
    id: string;
    formData: Record<string, unknown>;
    uploadedDocumentIds: string[] | null;
    createdAt: string;
  } | null;
}

const returnTypeLabels: Record<string, string> = {
  "1040": "Individual (1040)",
  "1120": "C Corp (1120)",
  "1120S": "S Corp (1120-S)",
  "1065": "Partnership (1065)",
  "1041": "Estate/Trust (1041)",
};

const statusBadge: Record<string, string> = {
  active: "badge badge-blue",
  expired: "badge badge-gray",
  revoked: "badge badge-rose",
};

function statusLabel(link: OrganizerLink): { label: string; badge: string } {
  if (link.submittedAt) return { label: "Submitted", badge: "badge badge-emerald" };
  if (link.status === "active" && new Date(link.expiresAt) < new Date())
    return { label: "Expired", badge: "badge badge-gray" };
  if (link.status === "active" && link.lastAccessedAt)
    return { label: "Opened", badge: "badge badge-amber" };
  if (link.status === "active") return { label: "Sent", badge: "badge badge-blue" };
  return { label: link.status, badge: statusBadge[link.status] || "badge badge-gray" };
}

function formatDate(d: string | null): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaxOrganizersClient() {
  const [organizers, setOrganizers] = useState<OrganizerLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<OrganizerLink | null>(null);
  const [search, setSearch] = useState("");

  const [createForm, setCreateForm] = useState({
    clientName: "",
    clientEmail: "",
    taxYear: new Date().getFullYear().toString(),
    returnType: "1040",
    expiresInDays: 30,
  });
  const [creating, setCreating] = useState(false);
  const [clientPicked, setClientPicked] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    if (!createForm.clientName || !createForm.clientEmail) return;
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
          taxYear: new Date().getFullYear().toString(),
          returnType: "1040",
          expiresInDays: 30,
        });
        setClientPicked(false);
        await loadOrganizers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send organizer.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this organizer? This cannot be undone.")) return;
    const res = await fetch(`/api/dashboard/tax-organizers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setShowDetail(null);
      await loadOrganizers();
    }
  }

  function copyLink(link: OrganizerLink) {
    const portalUrl = window.location.origin;
    const url = `${portalUrl}/tax-organizer/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = search
    ? organizers.filter(
        (o) =>
          (o.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
          (o.clientEmail || "").toLowerCase().includes(search.toLowerCase())
      )
    : organizers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // -- Detail View --
  if (showDetail) {
    const org = showDetail;
    const st = statusLabel(org);
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowDetail(null)}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <XIcon className="w-4 h-4" />
            Back to Organizers
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyLink(org)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
            >
              <CopyIcon className="w-3.5 h-3.5" />
              {copiedId === org.id ? "Copied!" : "Copy Link"}
            </button>
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
                {org.clientName || "Unknown"}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {org.clientEmail}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className={st.badge}>{st.label}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {returnTypeLabels[org.returnType] || org.returnType} &bull; {org.taxYear}
                </span>
              </div>
            </div>
            <div className="text-right text-xs space-y-0.5" style={{ color: "var(--text-muted)" }}>
              <p>Sent {formatDate(org.createdAt)}</p>
              <p>Expires {formatDate(org.expiresAt)}</p>
              {org.lastAccessedAt && <p className="text-amber-400">Opened {formatDate(org.lastAccessedAt)}</p>}
              {org.submittedAt && <p className="text-emerald-400">Submitted {formatDate(org.submittedAt)}</p>}
            </div>
          </div>
        </div>

        {/* Submission Data */}
        {org.submission ? (
          <div className="glass-card p-5 space-y-4">
            <p className="section-header">Submission</p>

            {/* Form data */}
            {org.submission.formData && Object.keys(org.submission.formData).length > 0 && (
              <div className="space-y-3">
                {Object.entries(org.submission.formData).map(([key, value]) => {
                  if (value === null || value === undefined || value === "") return null;
                  const displayValue =
                    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
                  return (
                    <div key={key} className="text-sm">
                      <span className="font-medium" style={{ color: "var(--text-muted)" }}>
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}:
                      </span>{" "}
                      <span style={{ color: "var(--text-main)" }}>
                        {displayValue.length > 200 ? displayValue.slice(0, 200) + "..." : displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Uploaded docs count */}
            {org.submission.uploadedDocumentIds && org.submission.uploadedDocumentIds.length > 0 && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                <span style={{ color: "var(--text-muted)" }}>Documents uploaded:</span>
                <span className="font-semibold" style={{ color: "var(--text-main)" }}>
                  {org.submission.uploadedDocumentIds.length}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <ClockIcon className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Waiting for client to complete the organizer.
            </p>
          </div>
        )}
      </div>
    );
  }

  // -- List View --
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
            Tax Organizers
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Send secure questionnaires to collect tax information from clients.
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            <SearchIcon className="w-4 h-4" />
          </span>
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
          {filtered.map((org) => {
            const st = statusLabel(org);
            return (
              <div
                key={org.id}
                className="glass-card p-4 hover:bg-[var(--input-bg)] transition-colors cursor-pointer"
                onClick={() => setShowDetail(org)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      <FormIcon className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {org.clientName || "Unknown"}
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
                      <span className={st.badge}>{st.label}</span>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {formatDate(org.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(org);
                      }}
                      className="p-1.5 rounded hover:bg-blue-500/10 transition-colors"
                      title="Copy secure link"
                    >
                      <CopyIcon className={`w-3.5 h-3.5 ${copiedId === org.id ? "text-emerald-500" : "text-[var(--text-muted)]"}`} />
                    </button>
                    <span style={{ color: "var(--text-muted)" }}>
                      <EyeIcon className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-5"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                Send Tax Organizer
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:opacity-80">
                <span style={{ color: "var(--text-muted)" }}>
                  <XIcon className="w-5 h-5" />
                </span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Client Picker */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Client
                </label>
                <ClientPicker
                  onSelect={(c) => {
                    setCreateForm((prev) => ({
                      ...prev,
                      clientName: c.name,
                      clientEmail: c.email,
                    }));
                    setClientPicked(true);
                  }}
                  placeholder="Search clients..."
                />
                {clientPicked && createForm.clientName && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs" style={{ color: "var(--text-main)" }}>
                      {createForm.clientName} ({createForm.clientEmail})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setClientPicked(false);
                        setCreateForm((p) => ({ ...p, clientName: "", clientEmail: "" }));
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Manual entry */}
              {!clientPicked && (
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
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
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
                    {Object.entries(returnTypeLabels).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
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
