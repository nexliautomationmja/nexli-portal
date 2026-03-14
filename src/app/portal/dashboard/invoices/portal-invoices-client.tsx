"use client";

import { useState, useEffect } from "react";
import { InvoiceIcon } from "@/components/ui/icons";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  billingType: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompany: string | null;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  token: string;
  stripePaymentUrl: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  lineItems: LineItem[];
}

type FilterTab = "all" | "unpaid" | "paid";

const statusBadge: Record<string, string> = {
  sent: "badge badge-blue",
  viewed: "badge badge-blue",
  overdue: "badge badge-amber",
  partial: "badge badge-violet",
  paid: "badge badge-emerald",
  canceled: "badge badge-gray",
  void: "badge badge-gray",
};

const statusLabel: Record<string, string> = {
  sent: "Sent",
  viewed: "Viewed",
  overdue: "Overdue",
  partial: "Partial",
  paid: "Paid",
  canceled: "Canceled",
  void: "Void",
};

function formatCents(cents: number, currency = "usd"): string {
  const currencyMap: Record<string, string> = {
    usd: "USD",
    cad: "CAD",
    gbp: "GBP",
    eur: "EUR",
    aud: "AUD",
  };
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyMap[currency] || "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalInvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/invoices");
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = invoices.filter((inv) => {
    if (filter === "unpaid")
      return ["sent", "viewed", "overdue", "partial"].includes(inv.status);
    if (filter === "paid") return inv.status === "paid";
    return true;
  });

  const totalOwed = invoices
    .filter((i) => ["sent", "viewed", "overdue", "partial"].includes(i.status))
    .reduce((sum, i) => sum + i.balanceDue, 0);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Your Invoices
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {totalOwed > 0
            ? `You have ${formatCents(totalOwed)} outstanding.`
            : "All invoices are paid."}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--input-bg)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-[var(--card-bg)] shadow-sm"
                : "hover:bg-[var(--card-bg)]/50"
            }`}
            style={{
              color:
                filter === tab.key
                  ? "var(--text-main)"
                  : "var(--text-muted)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading invoices...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <InvoiceIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No invoices found
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {filter !== "all"
              ? "Try a different filter."
              : "Your invoices will appear here when sent."}
          </p>
        </div>
      ) : (
        /* Invoice table */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <p className="font-medium" style={{ color: "var(--text-main)" }}>
                        {inv.invoiceNumber}
                      </p>
                    </td>
                    <td>{formatDate(inv.issueDate || inv.createdAt)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>
                      <span className="font-medium" style={{ color: "var(--text-main)" }}>
                        {formatCents(inv.total, inv.currency)}
                      </span>
                      {inv.balanceDue > 0 && inv.balanceDue !== inv.total && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatCents(inv.balanceDue, inv.currency)} due
                        </p>
                      )}
                    </td>
                    <td>
                      <span className={statusBadge[inv.status] || "badge badge-gray"}>
                        {statusLabel[inv.status] || inv.status}
                      </span>
                    </td>
                    <td>
                      {["sent", "viewed", "overdue", "partial"].includes(inv.status) ? (
                        <a
                          href={`/invoice/${inv.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium no-underline hover:underline"
                          style={{ color: "var(--accent-blue)" }}
                        >
                          View & Pay
                        </a>
                      ) : inv.status === "paid" ? (
                        <a
                          href={`/invoice/${inv.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm no-underline hover:underline"
                          style={{ color: "var(--text-muted)" }}
                        >
                          View
                        </a>
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
      )}
    </div>
  );
}
