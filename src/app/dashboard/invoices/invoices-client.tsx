"use client";

import { useState, useEffect } from "react";
import { ClientPicker } from "@/components/dashboard/client-picker";
import {
  InvoiceIcon,
  PlusIcon,
  EyeIcon,
  XIcon,
  TrashIcon,
  SendIcon,
  CopyIcon,
  DownloadIcon,
  ClockIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { InvoiceDocumentPreview } from "@/components/invoice-document";

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
  amountPaid: number;
  balanceDue: number;
  isRecurring: boolean;
  recurringInterval: string | null;
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

interface ClientHistory {
  clientEmail: string;
  clientName: string;
  clientCompany: string;
  invoices: Invoice[];
  summary: {
    totalInvoices: number;
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
  };
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
  partial: {
    label: "Partial",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
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

const RECURRING_OPTIONS = [
  { value: "", label: "One-time (no recurrence)" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState<Invoice | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [showHistory, setShowHistory] = useState<ClientHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Compose form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unitPrice: 0, billingType: "one_time" as string },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [selectedReminders, setSelectedReminders] = useState<number[]>([]);
  const [recurringInterval, setRecurringInterval] = useState("");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [firmInfo, setFirmInfo] = useState<{ name: string; company: string }>({
    name: "",
    company: "",
  });

  // Batch form
  const [batchClients, setBatchClients] = useState([
    { clientName: "", clientEmail: "", clientPhone: "", clientCompany: "" },
  ]);
  const [batchLineItems, setBatchLineItems] = useState([
    { description: "", quantity: 1, unitPrice: 0, billingType: "one_time" as string },
  ]);
  const [batchTaxRate, setBatchTaxRate] = useState(0);
  const [batchDueDate, setBatchDueDate] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchTerms, setBatchTerms] = useState("");
  const [batchCurrency, setBatchCurrency] = useState("usd");
  const [batchSending, setBatchSending] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data.invoices || []);
        if (data.from) setFirmInfo(data.from);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, billingType: "one_time" },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(
    index: number,
    field: "description" | "quantity" | "unitPrice" | "billingType",
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
            billingType: li.billingType,
          })),
          taxRate: Math.round(taxRate * 100),
          dueDate,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          currency,
          isRecurring: lineItems.some((li) => li.billingType !== "one_time"),
          recurringInterval: lineItems.find((li) => li.billingType !== "one_time")?.billingType === "one_time" ? undefined : lineItems.find((li) => li.billingType !== "one_time")?.billingType || undefined,
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
        await fetch(`/api/dashboard/invoices/${data.invoice.id}/send`, {
          method: "POST",
        });
      }

      const refreshRes = await fetch("/api/dashboard/invoices");
      const refreshData = await refreshRes.json();
      setInvoices(refreshData.invoices || []);
      resetForm();
      setShowCompose(false);
      setShowPreview(false);
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

  async function handleDownloadPDF(inv: Invoice) {
    const { generateInvoicePDF } = await import("@/lib/invoice-pdf");
    generateInvoicePDF({
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      clientCompany: inv.clientCompany,
      fromName: firmInfo.name,
      fromCompany: firmInfo.company,
      lineItems: inv.lineItems,
      subtotal: inv.subtotal,
      taxRate: inv.taxRate ?? 0,
      taxAmount: inv.taxAmount ?? 0,
      total: inv.total,
      amountPaid: inv.amountPaid ?? 0,
      balanceDue: inv.balanceDue ?? inv.total,
      notes: inv.notes,
      terms: inv.terms,
    });
  }

  async function handleViewClientHistory(email: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/invoices/client-history?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      setShowHistory(data);
    } catch {
      // Silently fail
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Batch invoicing ──
  function addBatchClient() {
    setBatchClients((prev) => [
      ...prev,
      { clientName: "", clientEmail: "", clientPhone: "", clientCompany: "" },
    ]);
  }

  function removeBatchClient(index: number) {
    if (batchClients.length <= 1) return;
    setBatchClients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBatchClient(
    index: number,
    field: string,
    value: string
  ) {
    setBatchClients((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function getBatchSubtotal() {
    return batchLineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  }

  function getBatchTotal() {
    return getBatchSubtotal() + (getBatchSubtotal() * batchTaxRate) / 100;
  }

  const batchFormValid =
    batchClients.every((c) => c.clientName.trim() && c.clientEmail.trim()) &&
    batchDueDate &&
    batchLineItems.every((li) => li.description.trim() && li.unitPrice > 0);

  async function handleBatchCreate(sendImmediately: boolean) {
    if (!batchFormValid) return;
    setBatchSending(true);
    try {
      await fetch("/api/dashboard/invoices/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clients: batchClients.map((c) => ({
            clientName: c.clientName.trim(),
            clientEmail: c.clientEmail.trim(),
            clientPhone: c.clientPhone.trim() || undefined,
            clientCompany: c.clientCompany.trim() || undefined,
          })),
          lineItems: batchLineItems.map((li) => ({
            description: li.description.trim(),
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            billingType: li.billingType,
          })),
          taxRate: Math.round(batchTaxRate * 100),
          dueDate: batchDueDate,
          notes: batchNotes.trim() || undefined,
          terms: batchTerms.trim() || undefined,
          currency: batchCurrency,
          sendImmediately,
        }),
      });

      const refreshRes = await fetch("/api/dashboard/invoices");
      const refreshData = await refreshRes.json();
      setInvoices(refreshData.invoices || []);
      resetBatchForm();
      setShowBatch(false);
    } finally {
      setBatchSending(false);
    }
  }

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientCompany("");
    setLineItems([{ description: "", quantity: 1, unitPrice: 0, billingType: "one_time" }]);
    setTaxRate(0);
    setDueDate("");
    setNotes("");
    setTerms("");
    setCurrency("usd");
    setSelectedReminders([]);
    setRecurringInterval("");
    setRecurringEndDate("");
  }

  function resetBatchForm() {
    setBatchClients([
      { clientName: "", clientEmail: "", clientPhone: "", clientCompany: "" },
    ]);
    setBatchLineItems([{ description: "", quantity: 1, unitPrice: 0, billingType: "one_time" }]);
    setBatchTaxRate(0);
    setBatchDueDate("");
    setBatchNotes("");
    setBatchTerms("");
    setBatchCurrency("usd");
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
      ["sent", "viewed", "overdue", "partial"].includes(i.status)
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatch(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-[var(--input-bg)]"
            style={{
              borderColor: "var(--card-border)",
              color: "var(--text-main)",
            }}
          >
            <UsersIcon className="w-4 h-4" />
            Batch Invoice
          </button>
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
                    "Paid",
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
                        <div className="flex items-center gap-2">
                          <div>
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
                          </div>
                          {inv.isRecurring && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-500" title="Recurring">
                              REC
                            </span>
                          )}
                        </div>
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
                      <td
                        className="px-4 py-3 text-sm"
                        style={{ color: inv.amountPaid > 0 ? "#10B981" : "var(--text-muted)" }}
                      >
                        {inv.amountPaid > 0
                          ? formatCurrency(inv.amountPaid, inv.currency)
                          : "\u2014"}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPDF(inv);
                            }}
                            className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                            title="Download PDF"
                          >
                            <DownloadIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewClientHistory(inv.clientEmail);
                            }}
                            className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                            title="Client History"
                          >
                            <ClockIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
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
                          {["sent", "viewed", "overdue", "partial"].includes(
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
            onClick={() => { setShowCompose(false); setShowPreview(false); }}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: showPreview
                      ? "linear-gradient(135deg, #2563EB, #06B6D4)"
                      : "var(--input-bg)",
                    color: showPreview ? "#fff" : "var(--text-muted)",
                    border: showPreview
                      ? "none"
                      : "1px solid var(--card-border)",
                  }}
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                  {showPreview ? "Edit" : "Preview"}
                </button>
                <button
                  onClick={() => {
                    setShowCompose(false);
                    resetForm();
                    setShowPreview(false);
                  }}
                  className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
                >
                  <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Document Preview Mode */}
              {showPreview && (
                <div style={{ padding: "8px 0" }}>
                  <InvoiceDocumentPreview
                    clientName={clientName || "Client Name"}
                    clientEmail={clientEmail}
                    clientCompany={clientCompany || undefined}
                    fromName={firmInfo.name}
                    fromCompany={firmInfo.company}
                    lineItems={lineItems}
                    currency={currency}
                    taxRate={taxRate}
                    dueDate={dueDate || undefined}
                    notes={notes || undefined}
                    terms={terms || undefined}
                    valuesInCents={false}
                  />
                </div>
              )}

              {/* Form Mode */}
              {!showPreview && <>
              {/* Client info */}
              <div>
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client Information *
                </label>
                <ClientPicker
                  onSelect={(c) => {
                    setClientName(c.name);
                    setClientEmail(c.email);
                    if (c.phone) setClientPhone(c.phone);
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
                  <div className="grid gap-2 px-1" style={{ gridTemplateColumns: "1fr 60px 80px 80px 70px 24px" }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Description
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Qty
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Rate ($)
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Terms
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>
                      Amount
                    </span>
                    <span />
                  </div>

                  {lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: "1fr 60px 80px 80px 70px 24px" }}
                    >
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(i, "description", e.target.value)
                        }
                        placeholder="Description"
                        className={inputClass}
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
                        className={inputClass}
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
                        className={inputClass}
                        style={inputStyle}
                      />
                      <select
                        value={item.billingType}
                        onChange={(e) =>
                          updateLineItem(i, "billingType", e.target.value)
                        }
                        className={inputClass}
                        style={{ ...inputStyle, fontSize: 11, padding: "6px 4px" }}
                      >
                        <option value="one_time">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      <p
                        className="text-sm text-right font-medium"
                        style={{ color: "var(--text-main)" }}
                      >
                        {formatCurrency(
                          Math.round(getLineTotal(item) * 100),
                          currency
                        )}
                      </p>
                      <div className="flex justify-center">
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
              </>}
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
                {showDetail.isRecurring && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-500">
                    RECURRING {showDetail.recurringInterval?.toUpperCase()}
                  </span>
                )}
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
              {/* Invoice document preview */}
              <InvoiceDocumentPreview
                clientName={showDetail.clientName}
                clientEmail={showDetail.clientEmail}
                clientCompany={showDetail.clientCompany || undefined}
                fromName={firmInfo.name}
                fromCompany={firmInfo.company}
                lineItems={showDetail.lineItems}
                currency={showDetail.currency}
                taxRate={(showDetail.taxRate ?? 0) / 100}
                dueDate={showDetail.dueDate}
                issueDate={showDetail.issueDate}
                notes={showDetail.notes || undefined}
                terms={showDetail.terms || undefined}
                valuesInCents={true}
                invoiceNumber={showDetail.invoiceNumber}
              />

              <button
                onClick={() =>
                  handleViewClientHistory(showDetail.clientEmail)
                }
                className="text-[10px] font-medium text-blue-500 hover:text-blue-400 transition-colors"
              >
                View all invoices for this client
              </button>

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
                {["sent", "viewed", "overdue", "partial"].includes(
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
                <button
                  onClick={() => handleDownloadPDF(showDetail)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-[var(--input-bg)]"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--text-main)",
                  }}
                >
                  <DownloadIcon className="w-3 h-3" />
                  PDF
                </button>
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

      {/* ═══ Client History Modal ═══ */}
      {(showHistory || historyLoading) && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => {
              setShowHistory(null);
              setHistoryLoading(false);
            }}
          />
          <div
            className="fixed inset-x-4 top-[5%] bottom-[5%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
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
                Client Payment History
              </h2>
              <button
                onClick={() => {
                  setShowHistory(null);
                  setHistoryLoading(false);
                }}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="p-12 text-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : showHistory ? (
                <div className="space-y-4">
                  {/* Client info */}
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {showHistory.clientName}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showHistory.clientEmail}
                      {showHistory.clientCompany
                        ? ` \u00b7 ${showHistory.clientCompany}`
                        : ""}
                    </p>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      {
                        label: "Invoices",
                        value: showHistory.summary.totalInvoices,
                        fmt: false,
                      },
                      {
                        label: "Total Invoiced",
                        value: showHistory.summary.totalInvoiced,
                        fmt: true,
                      },
                      {
                        label: "Total Paid",
                        value: showHistory.summary.totalPaid,
                        fmt: true,
                      },
                      {
                        label: "Outstanding",
                        value: showHistory.summary.totalOutstanding,
                        fmt: true,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {s.label}
                        </p>
                        <p
                          className="text-base font-bold mt-1"
                          style={{ color: "var(--text-main)" }}
                        >
                          {s.fmt
                            ? formatCurrency(s.value as number, "usd")
                            : s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Invoice list */}
                  <div className="rounded-lg border border-[var(--card-border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--card-border)]">
                          {["Invoice #", "Amount", "Paid", "Status", "Date"].map(
                            (h) => (
                              <th
                                key={h}
                                className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {showHistory.invoices.map((inv) => {
                          const sc =
                            statusConfig[inv.status] || statusConfig.draft;
                          return (
                            <tr
                              key={inv.id}
                              className="border-b border-[var(--card-border)] last:border-0"
                            >
                              <td
                                className="px-3 py-2"
                                style={{ color: "var(--text-main)" }}
                              >
                                {inv.invoiceNumber}
                              </td>
                              <td
                                className="px-3 py-2 font-semibold"
                                style={{ color: "var(--text-main)" }}
                              >
                                {formatCurrency(inv.total, inv.currency)}
                              </td>
                              <td
                                className="px-3 py-2"
                                style={{
                                  color:
                                    inv.amountPaid > 0
                                      ? "#10B981"
                                      : "var(--text-muted)",
                                }}
                              >
                                {inv.amountPaid > 0
                                  ? formatCurrency(
                                      inv.amountPaid,
                                      inv.currency
                                    )
                                  : "\u2014"}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sc.color} ${sc.bg}`}
                                >
                                  {sc.label}
                                </span>
                              </td>
                              <td
                                className="px-3 py-2 text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {formatDate(inv.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* ═══ Batch Invoice Modal ═══ */}
      {showBatch && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowBatch(false)}
          />
          <div
            className="fixed inset-x-4 top-[3%] bottom-[3%] max-w-2xl mx-auto z-50 rounded-lg border overflow-hidden flex flex-col"
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
                Batch Invoice
              </h2>
              <button
                onClick={() => {
                  setShowBatch(false);
                  resetBatchForm();
                }}
                className="p-1.5 rounded hover:bg-[var(--input-bg)] transition-colors"
              >
                <XIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Clients */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Clients * ({batchClients.length})
                  </label>
                  <button
                    onClick={addBatchClient}
                    className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Client
                  </button>
                </div>
                <ClientPicker
                  onSelect={(c) => {
                    const emptyIdx = batchClients.findIndex(
                      (bc) => !bc.clientName && !bc.clientEmail
                    );
                    if (emptyIdx >= 0) {
                      setBatchClients((prev) =>
                        prev.map((bc, i) =>
                          i === emptyIdx
                            ? {
                                clientName: c.name,
                                clientEmail: c.email,
                                clientPhone: c.phone || "",
                                clientCompany: c.company || "",
                              }
                            : bc
                        )
                      );
                    } else {
                      setBatchClients((prev) => [
                        ...prev,
                        {
                          clientName: c.name,
                          clientEmail: c.email,
                          clientPhone: c.phone || "",
                          clientCompany: c.company || "",
                        },
                      ]);
                    }
                  }}
                  placeholder="Search CRM to add clients..."
                />
                <div className="space-y-2">
                  {batchClients.map((client, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={client.clientName}
                        onChange={(e) =>
                          updateBatchClient(i, "clientName", e.target.value)
                        }
                        placeholder="Client Name *"
                        className={`col-span-5 ${inputClass}`}
                        style={inputStyle}
                      />
                      <input
                        type="email"
                        value={client.clientEmail}
                        onChange={(e) =>
                          updateBatchClient(i, "clientEmail", e.target.value)
                        }
                        placeholder="Email *"
                        className={`col-span-6 ${inputClass}`}
                        style={inputStyle}
                      />
                      <div className="col-span-1 flex justify-center">
                        {batchClients.length > 1 && (
                          <button
                            onClick={() => removeBatchClient(i)}
                            className="p-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <XIcon className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Line items (shared) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Line Items (same for all clients) *
                  </label>
                  <button
                    onClick={() =>
                      setBatchLineItems((prev) => [
                        ...prev,
                        { description: "", quantity: 1, unitPrice: 0, billingType: "one_time" },
                      ])
                    }
                    className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {batchLineItems.map((item, i) => (
                    <div
                      key={i}
                      className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: "1fr 60px 80px 80px 70px 24px" }}
                    >
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          setBatchLineItems((prev) =>
                            prev.map((li, idx) =>
                              idx === i
                                ? { ...li, description: e.target.value }
                                : li
                            )
                          )
                        }
                        placeholder="Description"
                        className={inputClass}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) =>
                          setBatchLineItems((prev) =>
                            prev.map((li, idx) =>
                              idx === i
                                ? {
                                    ...li,
                                    quantity:
                                      parseFloat(e.target.value) || 0,
                                  }
                                : li
                            )
                          )
                        }
                        placeholder="1"
                        min="0.01"
                        step="0.01"
                        className={inputClass}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          setBatchLineItems((prev) =>
                            prev.map((li, idx) =>
                              idx === i
                                ? {
                                    ...li,
                                    unitPrice:
                                      parseFloat(e.target.value) || 0,
                                  }
                                : li
                            )
                          )
                        }
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        style={inputStyle}
                      />
                      <select
                        value={item.billingType}
                        onChange={(e) =>
                          setBatchLineItems((prev) =>
                            prev.map((li, idx) =>
                              idx === i
                                ? { ...li, billingType: e.target.value }
                                : li
                            )
                          )
                        }
                        className={inputClass}
                        style={{ ...inputStyle, fontSize: 11, padding: "6px 4px" }}
                      >
                        <option value="one_time">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      <p
                        className="text-sm text-right font-medium"
                        style={{ color: "var(--text-main)" }}
                      >
                        {formatCurrency(
                          Math.round(item.quantity * item.unitPrice * 100),
                          batchCurrency
                        )}
                      </p>
                      <div className="flex justify-center">
                        {batchLineItems.length > 1 && (
                          <button
                            onClick={() =>
                              setBatchLineItems((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="p-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <XIcon className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch totals */}
                <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-1">
                  <div className="flex justify-between text-base font-bold">
                    <span style={{ color: "var(--text-main)" }}>
                      Per Client Total
                    </span>
                    <span style={{ color: "var(--text-main)" }}>
                      {formatCurrency(
                        Math.round(getBatchTotal() * 100),
                        batchCurrency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>
                      Total ({batchClients.length} clients)
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: "#2563EB" }}
                    >
                      {formatCurrency(
                        Math.round(
                          getBatchTotal() * 100 * batchClients.length
                        ),
                        batchCurrency
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
                    value={batchDueDate}
                    onChange={(e) => setBatchDueDate(e.target.value)}
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
                    value={batchCurrency}
                    onChange={(e) => setBatchCurrency(e.target.value)}
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
            </div>

            {/* Batch footer */}
            <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-end gap-3">
              <button
                onClick={() => handleBatchCreate(false)}
                disabled={!batchFormValid || batchSending}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-main)",
                }}
              >
                {batchSending ? "Creating..." : "Save All as Drafts"}
              </button>
              <button
                onClick={() => handleBatchCreate(true)}
                disabled={!batchFormValid || batchSending}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                }}
              >
                {batchSending
                  ? "Sending..."
                  : `Send ${batchClients.length} Invoice${batchClients.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
