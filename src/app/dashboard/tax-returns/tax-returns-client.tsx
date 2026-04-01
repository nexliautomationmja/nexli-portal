"use client";

import { useState, useEffect } from "react";
import { ClientPicker } from "@/components/dashboard/client-picker";
import {
  FormIcon,
  PlusIcon,
  XIcon,
  TrashIcon,
  EyeIcon,
  SendIcon,
} from "@/components/ui/icons";

interface TaxReturn {
  id: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  taxYear: string;
  returnType: string;
  status: string;
  dueDate: string | null;
  filedDate: string | null;
  acceptedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGES = [
  { key: "not_started", label: "Not Started", color: "gray" },
  { key: "documents_received", label: "Docs Received", color: "blue" },
  { key: "in_progress", label: "In Progress", color: "amber" },
  { key: "filed", label: "Filed", color: "purple" },
  { key: "accepted", label: "Accepted", color: "emerald" },
] as const;

const RETURN_TYPES = [
  { value: "1040", label: "1040 (Individual)" },
  { value: "1120", label: "1120 (C-Corp)" },
  { value: "1120S", label: "1120S (S-Corp)" },
  { value: "1065", label: "1065 (Partnership)" },
  { value: "990", label: "990 (Nonprofit)" },
  { value: "other", label: "Other" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors";
const inputStyle = {
  background: "var(--input-bg)",
  borderColor: "var(--card-border)",
  color: "var(--text-main)",
};

export function TaxReturnsClient() {
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filterYear, setFilterYear] = useState(
    String(new Date().getFullYear())
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<TaxReturn | null>(null);

  // Create form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [returnType, setReturnType] = useState("1040");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail editing
  const [detailNotes, setDetailNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Send organizer
  const [sendingOrganizer, setSendingOrganizer] = useState(false);

  useEffect(() => {
    fetchTaxReturns();
  }, []);

  function fetchTaxReturns() {
    setLoading(true);
    fetch("/api/dashboard/tax-returns")
      .then((r) => r.json())
      .then((data) => setTaxReturns(data.taxReturns || []))
      .catch(() => setTaxReturns([]))
      .finally(() => setLoading(false));
  }

  const filtered = taxReturns.filter((tr) =>
    filterYear === "all" ? true : tr.taxYear === filterYear
  );

  const years = [
    ...new Set(taxReturns.map((tr) => tr.taxYear)),
    String(new Date().getFullYear()),
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .reverse();

  const stats = {
    total: filtered.length,
    inProgress: filtered.filter((tr) => tr.status === "in_progress").length,
    filed: filtered.filter((tr) => tr.status === "filed").length,
    accepted: filtered.filter((tr) => tr.status === "accepted").length,
  };

  const createValid = clientName.trim() && clientEmail.trim() && taxYear;

  async function handleCreate() {
    if (!createValid) return;
    setSaving(true);
    try {
      await fetch("/api/dashboard/tax-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientCompany: clientCompany.trim() || undefined,
          taxYear,
          returnType,
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      fetchTaxReturns();
      resetForm();
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setClientCompany("");
    setTaxYear(String(new Date().getFullYear()));
    setReturnType("1040");
    setDueDate("");
    setNotes("");
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/dashboard/tax-returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.taxReturn) {
        setTaxReturns((prev) =>
          prev.map((tr) => (tr.id === id ? data.taxReturn : tr))
        );
        if (showDetail?.id === id) {
          setShowDetail(data.taxReturn);
        }
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveNotes(id: string) {
    await fetch(`/api/dashboard/tax-returns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: detailNotes }),
    });
    setTaxReturns((prev) =>
      prev.map((tr) => (tr.id === id ? { ...tr, notes: detailNotes } : tr))
    );
  }

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/tax-returns/${id}`, { method: "DELETE" });
    setTaxReturns((prev) => prev.filter((tr) => tr.id !== id));
    setShowDetail(null);
  }

  function openDetail(tr: TaxReturn) {
    setShowDetail(tr);
    setDetailNotes(tr.notes || "");
  }

  async function handleSendOrganizer(returnId: string) {
    if (
      !confirm(
        "Send tax organizer to the client? They will receive an email with a secure link to complete."
      )
    )
      return;
    setSendingOrganizer(true);
    try {
      const res = await fetch(
        `/api/dashboard/tax-returns/${returnId}/send-organizer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInDays: 30 }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert(
          data.emailSent
            ? "Tax organizer sent! The client will receive an email with a secure link."
            : "Tax organizer link created. Email delivery may have failed — check logs."
        );
      } else {
        alert(data.error || "Failed to send organizer.");
      }
    } finally {
      setSendingOrganizer(false);
    }
  }

  function getBadgeClass(status: string) {
    switch (status) {
      case "not_started":
        return "badge-gray";
      case "documents_received":
        return "badge-blue";
      case "in_progress":
        return "badge-amber";
      case "filed":
        return "badge-purple";
      case "accepted":
        return "badge-emerald";
      default:
        return "badge-gray";
    }
  }

  function getStageLabel(status: string) {
    return STAGES.find((s) => s.key === status)?.label || status;
  }

  function getColumnBorderColor(color: string) {
    switch (color) {
      case "gray":
        return "#6b7280";
      case "blue":
        return "#3b82f6";
      case "amber":
        return "#f59e0b";
      case "purple":
        return "#a855f7";
      case "emerald":
        return "#10b981";
      default:
        return "#6b7280";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-main)" }}
          >
            Tax Returns
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Track client tax returns through preparation and filing.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #2563EB, #06B6D4)",
          }}
        >
          <PlusIcon className="w-4 h-4" />
          New Return
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Returns", value: stats.total },
          { label: "In Progress", value: stats.inProgress },
          { label: "Filed", value: stats.filed },
          { label: "Accepted", value: stats.accepted },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p
              className="text-xs font-medium mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              {stat.label}
            </p>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Controls: year filter + view toggle */}
      <div className="flex items-center justify-between">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none"
          style={{ color: "var(--text-main)" }}
        >
          <option value="all">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border border-[var(--glass-border)]"
          style={{ background: "var(--glass-bg)" }}
        >
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === "kanban" ? "bg-blue-500/20 text-blue-400" : ""
            }`}
            style={{
              color: view === "kanban" ? undefined : "var(--text-muted)",
            }}
          >
            Board
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === "list" ? "bg-blue-500/20 text-blue-400" : ""
            }`}
            style={{
              color: view === "list" ? undefined : "var(--text-muted)",
            }}
          >
            List
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div
          className="glass-card p-16 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading tax returns...</p>
        </div>
      ) : filtered.length === 0 && filterYear !== "all" ? (
        <div className="glass-card p-16">
          <div className="text-center">
            <div style={{ color: "var(--text-muted)" }}>
              <FormIcon className="w-10 h-10 mx-auto mb-3" />
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              No tax returns for {filterYear}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Create a new return to get started.
            </p>
          </div>
        </div>
      ) : view === "kanban" ? (
        /* ═══ Kanban View ═══ */
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {STAGES.map((stage) => {
            const stageReturns = filtered.filter(
              (tr) => tr.status === stage.key
            );

            return (
              <div key={stage.key} className="min-w-[240px] flex-shrink-0 flex-1">
                {/* Stage header */}
                <div className="mb-3 px-1">
                  <div
                    className="h-1 rounded-full mb-3"
                    style={{
                      background: getColumnBorderColor(stage.color),
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="section-header mb-0">{stage.label}</h3>
                      <span className="badge badge-gray">
                        {stageReturns.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageReturns.length === 0 ? (
                    <div className="border-2 border-dashed border-[var(--glass-border)] rounded-lg p-6 text-center">
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No returns
                      </p>
                    </div>
                  ) : (
                    stageReturns.map((tr) => (
                      <div
                        key={tr.id}
                        className="glass-card rounded-lg p-4 hover:border-blue-500/20 transition-colors cursor-pointer"
                        onClick={() => openDetail(tr)}
                      >
                        <p
                          className="text-sm font-medium mb-0.5"
                          style={{ color: "var(--text-main)" }}
                        >
                          {tr.clientName}
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="badge badge-gray">
                            {tr.returnType}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {tr.taxYear}
                          </span>
                        </div>
                        {tr.clientCompany && (
                          <p
                            className="text-xs mb-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {tr.clientCompany}
                          </p>
                        )}
                        {tr.dueDate && (
                          <p
                            className="text-xs"
                            style={{
                              color:
                                new Date(tr.dueDate) < new Date() &&
                                tr.status !== "filed" &&
                                tr.status !== "accepted"
                                  ? "#ef4444"
                                  : "var(--text-muted)",
                            }}
                          >
                            Due: {formatDate(tr.dueDate)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═══ List View ═══ */
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Tax Year</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No tax returns found
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((tr) => (
                  <tr
                    key={tr.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(tr)}
                  >
                    <td>
                      <p className="font-medium">{tr.clientName}</p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {tr.clientEmail}
                      </p>
                    </td>
                    <td>
                      <span className="badge badge-gray">{tr.returnType}</span>
                    </td>
                    <td>{tr.taxYear}</td>
                    <td>
                      <span className={`badge ${getBadgeClass(tr.status)}`}>
                        {getStageLabel(tr.status)}
                      </span>
                    </td>
                    <td
                      style={{
                        color:
                          tr.dueDate &&
                          new Date(tr.dueDate) < new Date() &&
                          tr.status !== "filed" &&
                          tr.status !== "accepted"
                            ? "#ef4444"
                            : undefined,
                      }}
                    >
                      {formatDate(tr.dueDate)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(tr);
                          }}
                          className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendOrganizer(tr.id);
                          }}
                          className="p-1.5 rounded hover:bg-blue-500/10 transition-colors"
                          title="Send Tax Organizer"
                        >
                          <SendIcon className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tr.id);
                          }}
                          className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Create Modal ═══ */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => {
              setShowCreate(false);
              resetForm();
            }}
          />
          <div
            className="fixed inset-x-4 top-[10%] bottom-[10%] max-w-lg mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                New Tax Return
              </h2>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Client info */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client *
                </label>
                <ClientPicker
                  onSelect={(c) => {
                    setClientName(c.name);
                    setClientEmail(c.email);
                    if (c.company) setClientCompany(c.company);
                  }}
                  placeholder="Search existing clients..."
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client Name *"
                    className={inputClass}
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="Email *"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <input
                  type="text"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  placeholder="Company (optional)"
                  className={`mt-2 ${inputClass}`}
                  style={inputStyle}
                />
              </div>

              {/* Tax year + Return type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="text-xs font-medium block mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Tax Year *
                  </label>
                  <select
                    value={taxYear}
                    onChange={(e) => setTaxYear(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    {[0, 1, 2, 3, 4].map((offset) => {
                      const y = String(new Date().getFullYear() - offset);
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label
                    className="text-xs font-medium block mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Return Type
                  </label>
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    {RETURN_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={3}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-main)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createValid || saving}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                }}
              >
                {saving ? "Creating..." : "Create Return"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Detail Modal ═══ */}
      {showDetail && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowDetail(null)}
          />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-lg mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {showDetail.clientName}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-gray">
                    {showDetail.returnType}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showDetail.taxYear}
                  </span>
                  <span
                    className={`badge ${getBadgeClass(showDetail.status)}`}
                  >
                    {getStageLabel(showDetail.status)}
                  </span>
                </div>
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
              {/* Status changer */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Status
                </label>
                <select
                  value={showDetail.status}
                  onChange={(e) =>
                    handleStatusChange(showDetail.id, e.target.value)
                  }
                  disabled={updatingStatus}
                  className={inputClass}
                  style={inputStyle}
                >
                  {STAGES.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Client
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--text-main)" }}
                  >
                    {showDetail.clientName}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showDetail.clientEmail}
                  </p>
                  {showDetail.clientCompany && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showDetail.clientCompany}
                    </p>
                  )}
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Due Date
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color:
                        showDetail.dueDate &&
                        new Date(showDetail.dueDate) < new Date() &&
                        showDetail.status !== "filed" &&
                        showDetail.status !== "accepted"
                          ? "#ef4444"
                          : "var(--text-main)",
                    }}
                  >
                    {formatDate(showDetail.dueDate)}
                  </p>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Activity
                </p>
                <div className="space-y-2">
                  {[
                    {
                      label: "Created",
                      date: showDetail.createdAt,
                      always: true,
                    },
                    {
                      label: "Filed",
                      date: showDetail.filedDate,
                      always: false,
                    },
                    {
                      label: "Accepted",
                      date: showDetail.acceptedDate,
                      always: false,
                    },
                  ]
                    .filter((item) => item.always || item.date)
                    .map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              item.label === "Accepted"
                                ? "#10B981"
                                : item.label === "Filed"
                                  ? "#a855f7"
                                  : "#2563EB",
                          }}
                        />
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span
                            className="font-medium"
                            style={{ color: "var(--text-main)" }}
                          >
                            {item.label}
                          </span>{" "}
                          {item.date ? formatDate(item.date) : ""}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <textarea
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={4}
                  className={inputClass}
                  style={inputStyle}
                />
                {detailNotes !== (showDetail.notes || "") && (
                  <button
                    onClick={() => handleSaveNotes(showDetail.id)}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                    }}
                  >
                    Save Notes
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-between">
              <button
                onClick={() => handleDelete(showDetail.id)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Delete Return
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendOrganizer(showDetail.id)}
                  disabled={sendingOrganizer}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                  }}
                >
                  <SendIcon className="w-3.5 h-3.5" />
                  {sendingOrganizer ? "Sending..." : "Send Organizer"}
                </button>
                <button
                  onClick={() => setShowDetail(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--text-main)",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
