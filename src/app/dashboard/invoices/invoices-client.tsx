"use client";

import { useState, useEffect } from "react";
import {
  InvoiceIcon,
  PlusIcon,
  EyeIcon,
  XIcon,
  TrashIcon,
  SendIcon,
  CopyIcon,
} from "@/components/ui/icons";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientCompany: string | null;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  terms: string | null;
  token: string;
  stripePaymentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  canceledAt: string | null;
  reminderConfig: { schedule: { dayOffset: number }[] } | null;
  createdAt: string;
  lineItems: LineItem[];
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-gray-500", bg: "bg-gray-500/10" },
  sent: { label: "Sent", color: "text-blue-500", bg: "bg-blue-500/10" },
  viewed: {
    label: "Viewed",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  paid: {
    label: "Paid",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  overdue: { label: "Overdue", color: "text-red-500", bg: "bg-red-500/10" },
  canceled: {
    label: "Canceled",
    color: "text-gray-400",
    bg: "bg-gray-400/10",
  },
  void: { label: "Void", color: "text-gray-400", bg: "bg-gray-400/10" },
};

function formatCurrency(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100;
  const symbols: Record<string, string> = {
    usd: "$",
    cad: "CA$",
    gbp: "\u00a3",
    eur: "\u20ac",
    aud: "A$",
  };
  const symbol = symbols[currency] || "$";
  return `${symbol}${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

const REMINDER_OPTIONS = [
  { dayOffset: -7, label: "7 days before due" },
  { dayOffset: -3, label: "3 days before due" },
  { dayOffset: 0, label: "On due date" },
  { dayOffset: 3, label: "3 days after due" },
  { dayOffset: 7, label: "7 days after due" },
];

export function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState<Invoice | null>(null);

  // Compose form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [selectedReminders, setSelectedReminders] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(
    index: number,
    field: "description" | "quantity" | "unitPrice",
    value: string | number
  ) {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function getLineTotal(item: { quantity: number; unitPrice: number }) {
    return item.quantity * item.unitPrice;
  }

  function getSubtotal() {
    return lineItems.reduce((sum, item) => sum + getLineTotal(item), 0);
  }

  function getTaxAmount() {
    return (getSubtotal() * taxRate) / 100;
  }

  function getTotal() {
    return getSubtotal() + getTaxAmount();
  }

  const formValid =
    clientName.trim() &&
    clientEmail.trim() &&
    dueDate &&
    lineItems.every((li) => li.description.trim() && li.unitPrice > 0);

  async function handleCreate(sendImmediately: boolean) {
    if (!formValid) return;
    setSending(true);
    try {
      // Create the invoice
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: clientPhone.trim() || undefined,
          clientCompany: clientCompany.trim() || undefined,
          lineItems: lineItems.map((li) => ({
            description: li.description.trim(),
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
          taxRate: Math.round(taxRate * 100), // convert percentage to basis points
          dueDate,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          currency,
          reminderConfig:
            selectedReminders.length > 0
              ? {
                  schedule: selectedReminders.map((dayOffset) => ({
                    dayOffset,
                  })),
                }
              : undefined,
        }),
      });
      const data = await res.json();

      if (data.invoice && sendImmediately) {
        // Send the invoice immediately
        await fetch(`/api/dashboard/invoices/${data.invoice.id}/send`, {
          method: "POST",
        });
      }

      // Refresh list
      const refreshRes = await fetch("/api/dashboard/invoices");
      const refreshData = await refreshRes.json();
      setInvoices(refreshData.invoices || []);
      resetForm();
      setShowCompose(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSend(id: string) {
    await fetch(`/api/dashboard/invoices/${id}/send`, { method: "POST" });
    const refreshRes = await fetch("/api/dashboard/invoices");
    const refreshData = await refreshRes.json();
    setInvoices(refreshData.invoices || []);
    setShowDetail(null);
  }

  async function handleVoid(id: string) {
    await fetch(`/api/dashboard/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, status: "void" } : inv
      )
    );
    setShowDetail(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/invoices/${id}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    setShowDetail(null);
  }

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientCompany("");
    setLineItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    setTaxRate(0);
    setDueDate("");
    setNotes("");
    setTerms("");
    setCurrency("usd");
    setSelectedReminders([]);
  }

  function toggleReminder(dayOffset: number) {
    setSelectedReminders((prev) =>
      prev.includes(dayOffset)
        ? prev.filter((d) => d !== dayOffset)
        : [...prev, dayOffset]
    );
  }

  function copyPaymentLink(inv: Invoice) {
    const portalUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://portal.nexli.net";
    navigator.clipboard.writeText(`${portalUrl}/invoice/${inv.token}`);
  }

  const stats = {
    total: invoices.length,
    outstanding: invoices.filter((i) =>
      ["sent", "viewed", "overdue"].includes(i.status)
    ).length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
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
            Invoices
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Create and manage client invoices with online payments.
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #2563EB, #06B6D4)",
          }}
        >
          <PlusIcon className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: stats.total },
          { label: "Outstanding", value: stats.outstanding },
          { label: "Paid", value: stats.paid },
          { label: "Overdue", value: stats.overdue },
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">All Invoices</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div
              className="mx-auto mb-3 w-10 h-10"
              style={{ color: "var(--text-muted)" }}
            >
              <InvoiceIcon className="w-10 h-10" />
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              No invoices yet
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Create your first invoice to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {[
                    "Client",
                    "Invoice #",
                    "Amount",
                    "Status",
                    "Due Date",
                    "Actions",
                  ].map((h) => (
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
                {invoices.map((inv) => {
                  const sc =
                    statusConfig[inv.status] || statusConfig.draft;
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors cursor-pointer"
                      onClick={() => setShowDetail(inv)}
                    >
                      <td className="px-4 py-3">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-main)" }}
                        >
                          {inv.clientName}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {inv.clientEmail}
                        </p>
                      </td>
                      <td
                        className="px-4 py-3 text-sm"
                        style={{ color: "var(--text-main)" }}
                      >
                        {inv.invoiceNumber}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-semibold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sc.color} ${sc.bg}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDetail(inv);
                            }}
                            className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                            title="View"
                          >
                            <EyeIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          </button>
                          {inv.status === "draft" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSend(inv.id);
                              }}
                              className="p-1.5 rounded hover:bg-blue-500/10 transition-colors"
                              title="Send"
                            >
                              <SendIcon className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          )}
                          {["sent", "viewed", "overdue"].includes(
                            inv.status
                          ) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoid(inv.id);
                              }}
                              className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                              title="Void"
                            >
                              <XIcon className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(inv.id);
                            }}
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

      {/* ═══ Compose Modal ═══ */}
      {showCompose && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowCompose(false)}
          />
          <div
            className="fixed inset-x-4 top-[3%] bottom-[3%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                New Invoice
              </h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  resetForm();
                }}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Client info */}
              <div>
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client Information *
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
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
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className={inputClass}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder="Company (optional)"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Line Items *
                  </label>
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 px-1">
                    <span
                      className="col-span-5 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Description
                    </span>
                    <span
                      className="col-span-2 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Qty
                    </span>
                    <span
                      className="col-span-2 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Rate ($)
                    </span>
                    <span
                      className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Amount
                    </span>
                    <span className="col-span-1" />
                  </div>

                  {lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(i, "description", e.target.value)
                        }
                        placeholder="Description"
                        className={`col-span-5 ${inputClass}`}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) =>
                          updateLineItem(
                            i,
                            "quantity",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="1"
                        min="0.01"
                        step="0.01"
                        className={`col-span-2 ${inputClass}`}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          updateLineItem(
                            i,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={`col-span-2 ${inputClass}`}
                        style={inputStyle}
                      />
                      <p
                        className="col-span-2 text-sm text-right font-medium"
                        style={{ color: "var(--text-main)" }}
                      >
                        {formatCurrency(
                          Math.round(getLineTotal(item) * 100),
                          currency
                        )}
                      </p>
                      <div className="col-span-1 flex justify-center">
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(i)}
                            className="p-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <XIcon className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-1">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>
                      Subtotal
                    </span>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        Math.round(getSubtotal() * 100),
                        currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--text-muted)" }}>Tax</span>
                      <input
                        type="number"
                        value={taxRate || ""}
                        onChange={(e) =>
                          setTaxRate(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-16 px-2 py-1 rounded border text-xs text-center"
                        style={inputStyle}
                      />
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        %
                      </span>
                    </div>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        Math.round(getTaxAmount() * 100),
                        currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--card-border)]">
                    <span style={{ color: "var(--text-main)" }}>Total</span>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        Math.round(getTotal() * 100),
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Due Date + Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="text-xs font-medium block mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    max={
                      new Date(Date.now() + 365 * 86400000)
                        .toISOString()
                        .split("T")[0]
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium block mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="usd">USD ($)</option>
                    <option value="cad">CAD (CA$)</option>
                    <option value="gbp">GBP (&pound;)</option>
                    <option value="eur">EUR (&euro;)</option>
                    <option value="aud">AUD (A$)</option>
                  </select>
                </div>
              </div>

              {/* Notes + Terms */}
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="Notes for the client..."
                    rows={3}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium block mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Terms
                  </label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Payment terms..."
                    rows={3}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Reminders */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Payment Reminders
                </label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.dayOffset}
                      type="button"
                      onClick={() => toggleReminder(opt.dayOffset)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        selectedReminders.includes(opt.dayOffset)
                          ? "border-blue-500 bg-blue-500/10 text-blue-500"
                          : "hover:bg-[var(--input-bg)]"
                      }`}
                      style={
                        selectedReminders.includes(opt.dayOffset)
                          ? {}
                          : {
                              borderColor: "var(--card-border)",
                              color: "var(--text-muted)",
                            }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Select when to send payment reminder emails to the client.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              <button
                onClick={() => handleCreate(false)}
                disabled={!formValid || sending}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-main)",
                }}
              >
                {sending ? "Saving..." : "Save as Draft"}
              </button>
              <button
                onClick={() => handleCreate(true)}
                disabled={!formValid || sending}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, #2563EB, #06B6D4)",
                }}
              >
                {sending ? "Sending..." : "Send Invoice"}
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
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {showDetail.invoiceNumber}
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${(statusConfig[showDetail.status] || statusConfig.draft).color} ${(statusConfig[showDetail.status] || statusConfig.draft).bg}`}
                >
                  {(statusConfig[showDetail.status] || statusConfig.draft)
                    .label}
                </span>
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
                    Dates
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Issued: {formatDate(showDetail.issueDate)}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Due: {formatDate(showDetail.dueDate)}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Line Items
                </p>
                <div className="rounded-lg border border-[var(--card-border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--card-border)]">
                        <th
                          className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Description
                        </th>
                        <th
                          className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Qty
                        </th>
                        <th
                          className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Rate
                        </th>
                        <th
                          className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showDetail.lineItems.map((li) => (
                        <tr
                          key={li.id}
                          className="border-b border-[var(--card-border)] last:border-0"
                        >
                          <td
                            className="px-3 py-2"
                            style={{ color: "var(--text-main)" }}
                          >
                            {li.description}
                          </td>
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {(li.quantity / 100).toFixed(
                              li.quantity % 100 === 0 ? 0 : 2
                            )}
                          </td>
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {formatCurrency(
                              li.unitPrice,
                              showDetail.currency
                            )}
                          </td>
                          <td
                            className="px-3 py-2 text-right font-medium"
                            style={{ color: "var(--text-main)" }}
                          >
                            {formatCurrency(
                              li.amount,
                              showDetail.currency
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>
                      Subtotal
                    </span>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        showDetail.subtotal,
                        showDetail.currency
                      )}
                    </span>
                  </div>
                  {(showDetail.taxRate ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>
                        Tax ({((showDetail.taxRate ?? 0) / 100).toFixed(2)}%)
                      </span>
                      <span style={{ color: "var(--text-main)" }}>
                        {formatCurrency(
                          showDetail.taxAmount ?? 0,
                          showDetail.currency
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--card-border)]">
                    <span style={{ color: "var(--text-main)" }}>Total</span>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        showDetail.total,
                        showDetail.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(showDetail.notes || showDetail.terms) && (
                <div className="grid grid-cols-2 gap-4">
                  {showDetail.notes && (
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Notes
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-main)" }}
                      >
                        {showDetail.notes}
                      </p>
                    </div>
                  )}
                  {showDetail.terms && (
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Terms
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-main)" }}
                      >
                        {showDetail.terms}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
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
                    { label: "Sent", date: showDetail.sentAt, always: false },
                    {
                      label: "Viewed",
                      date: showDetail.viewedAt,
                      always: false,
                    },
                    {
                      label: "Paid",
                      date: showDetail.paidAt,
                      always: false,
                    },
                    {
                      label: "Canceled",
                      date: showDetail.canceledAt,
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
                              item.label === "Paid"
                                ? "#10B981"
                                : item.label === "Canceled"
                                  ? "#EF4444"
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
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(showDetail.id)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
                {["sent", "viewed", "overdue"].includes(
                  showDetail.status
                ) && (
                  <button
                    onClick={() => handleVoid(showDetail.id)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Void
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {showDetail.status !== "draft" && (
                  <button
                    onClick={() => copyPaymentLink(showDetail)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-[var(--input-bg)]"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--text-main)",
                    }}
                  >
                    <CopyIcon className="w-3 h-3" />
                    Copy Link
                  </button>
                )}
                {showDetail.status === "draft" && (
                  <button
                    onClick={() => handleSend(showDetail.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, #2563EB, #06B6D4)",
                    }}
                  >
                    <SendIcon className="w-3 h-3" />
                    Send Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
