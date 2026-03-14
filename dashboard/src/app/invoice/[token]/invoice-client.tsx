"use client";

import { useState, useEffect } from "react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  order: number;
  billingType?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  terms: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
}

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceClient({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [from, setFrom] = useState<{ name: string; company: string }>({
    name: "",
    company: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoice/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvoice(data.invoice);
          setLineItems(data.lineItems || []);
          setFrom(data.from || { name: "", company: "" });
        }
      })
      .catch(() => setError("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fa",
        }}
      >
        <div style={{ textAlign: "center", color: "#666" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e5e7eb",
              borderTop: "3px solid #2563EB",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p>Loading invoice...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fa",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 48,
            textAlign: "center",
            maxWidth: 400,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 28,
            }}
          >
            !
          </div>
          <h2 style={{ margin: "0 0 8px", color: "#111", fontSize: 20, fontWeight: 700 }}>
            Invoice Unavailable
          </h2>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const isPaid = invoice.status === "paid";
  const isPartial = invoice.status === "partial";
  const isOverdue =
    invoice.status === "overdue" ||
    (!isPaid && !isPartial && new Date(invoice.dueDate) < new Date());
  const hasPartialPayment = (invoice.amountPaid ?? 0) > 0;

  // Paid success state
  if (isPaid) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
        {/* Header */}
        <header
          style={{
            background: "#0a0a0f",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/logos/nexli-logo-white-wordmark@2x.png"
            alt="Nexli"
            style={{ height: 28 }}
          />
        </header>

        <div
          style={{
            maxWidth: 480,
            margin: "80px auto",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 48,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10B981, #06B6D4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                animation:
                  "check-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1
              style={{
                margin: "0 0 8px",
                color: "#000000",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              Payment Received
            </h1>
            <p style={{ margin: "0 0 24px", color: "#666", fontSize: 14 }}>
              Invoice {invoice.invoiceNumber} has been paid in full.
            </p>
            <div
              style={{
                padding: 16,
                background: "#F0FDF4",
                borderRadius: 12,
                border: "1px solid #BBF7D0",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#166534",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {formatCurrency(invoice.total, invoice.currency)}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#166534",
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                Paid{" "}
                {invoice.paidAt
                  ? formatDate(invoice.paidAt)
                  : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            background: "#0a0a0f",
            padding: "20px 24px",
            textAlign: "center",
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <img
            src="/logos/nexli-logo-white-wordmark@2x.png"
            alt="Nexli"
            style={{ height: 16, opacity: 0.4 }}
          />
          <p
            style={{
              margin: "8px 0 0",
              color: "rgba(255,255,255,0.3)",
              fontSize: 11,
            }}
          >
            Powered by Nexli Portal
          </p>
          <a
            href="/portal"
            style={{
              display: "inline-block",
              marginTop: 8,
              color: "rgba(37, 99, 235, 0.6)",
              fontSize: 11,
              textDecoration: "none",
            }}
          >
            Sign in to Client Portal
          </a>
        </footer>

        <style>{`
          @keyframes check-bounce {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.25); opacity: 1; }
            70% { transform: scale(0.9); }
            85% { transform: scale(1.08); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Normal invoice view
  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Header */}
      <header
        style={{
          background: "#0a0a0f",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/logos/nexli-logo-white-wordmark@2x.png"
          alt="Nexli"
          style={{ height: 28 }}
        />
      </header>

      <div
        style={{
          maxWidth: 700,
          margin: "32px auto",
          padding: "0 20px 120px",
        }}
      >
        {/* Invoice card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          {/* Invoice header */}
          <div
            style={{
              padding: "32px 32px 24px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <h1
                  style={{
                    margin: "0 0 4px",
                    color: "#111",
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  Invoice
                </h1>
                <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
                  {invoice.invoiceNumber}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {isOverdue ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "#FEF2F2",
                      color: "#DC2626",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    OVERDUE
                  </span>
                ) : isPartial ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "#FFF7ED",
                      color: "#EA580C",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    PARTIALLY PAID
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "#EFF6FF",
                      color: "#2563EB",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {invoice.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* From / To */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                marginTop: 24,
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 4px",
                    color: "#999",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  From
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#111",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {from.company || from.name}
                </p>
                {from.company && from.name && (
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 13 }}>
                    {from.name}
                  </p>
                )}
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 4px",
                    color: "#999",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Bill To
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#111",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {invoice.clientName}
                </p>
                {invoice.clientCompany && (
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 13 }}>
                    {invoice.clientCompany}
                  </p>
                )}
                <p style={{ margin: "2px 0 0", color: "#666", fontSize: 13 }}>
                  {invoice.clientEmail}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                marginTop: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 2px",
                    color: "#999",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Issue Date
                </p>
                <p style={{ margin: 0, color: "#111", fontSize: 14 }}>
                  {formatDate(invoice.issueDate)}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 2px",
                    color: "#999",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Due Date
                </p>
                <p
                  style={{
                    margin: 0,
                    color: isOverdue ? "#DC2626" : "#111",
                    fontSize: 14,
                    fontWeight: isOverdue ? 700 : 400,
                  }}
                >
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ padding: "24px 32px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 0",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      width: 60,
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 0",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      width: 100,
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 0",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      width: 100,
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td style={{ padding: "12px 0", color: "#111" }}>
                      {item.description}
                      {item.billingType && item.billingType !== "one_time" && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#7c3aed",
                            background: "rgba(124, 58, 237, 0.08)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            verticalAlign: "middle",
                          }}
                        >
                          {item.billingType === "monthly" ? "Monthly" : item.billingType === "quarterly" ? "Quarterly" : item.billingType === "yearly" ? "Yearly" : ""}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 0",
                        color: "#666",
                        textAlign: "right",
                      }}
                    >
                      {(item.quantity / 100).toFixed(item.quantity % 100 === 0 ? 0 : 2)}
                    </td>
                    <td
                      style={{
                        padding: "12px 0",
                        color: "#666",
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(item.unitPrice, invoice.currency)}
                    </td>
                    <td
                      style={{
                        padding: "12px 0",
                        color: "#111",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(item.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginTop: 16, borderTop: "2px solid #e5e7eb" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0 4px",
                }}
              >
                <span style={{ color: "#666", fontSize: 14 }}>Subtotal</span>
                <span style={{ color: "#111", fontSize: 14 }}>
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </span>
              </div>
              {(invoice.taxRate ?? 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: "#666", fontSize: 14 }}>
                    Tax ({((invoice.taxRate ?? 0) / 100).toFixed(2)}%)
                  </span>
                  <span style={{ color: "#111", fontSize: 14 }}>
                    {formatCurrency(invoice.taxAmount ?? 0, invoice.currency)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0 0",
                  borderTop: "1px solid #e5e7eb",
                  marginTop: 8,
                }}
              >
                <span
                  style={{ color: "#111", fontSize: 18, fontWeight: 800 }}
                >
                  Total
                </span>
                <span
                  style={{ color: "#111", fontSize: 18, fontWeight: 800 }}
                >
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
              {hasPartialPayment && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0 4px",
                    }}
                  >
                    <span style={{ color: "#10B981", fontSize: 14, fontWeight: 600 }}>
                      Amount Paid
                    </span>
                    <span style={{ color: "#10B981", fontSize: 14, fontWeight: 600 }}>
                      -{formatCurrency(invoice.amountPaid, invoice.currency)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0 0",
                      borderTop: "2px solid #111",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ color: "#111", fontSize: 18, fontWeight: 800 }}>
                      Balance Due
                    </span>
                    <span style={{ color: "#DC2626", fontSize: 18, fontWeight: 800 }}>
                      {formatCurrency(invoice.balanceDue, invoice.currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes / Terms */}
          {(invoice.notes || invoice.terms) && (
            <div
              style={{
                padding: "0 32px 24px",
                borderTop: "1px solid #f3f4f6",
                marginTop: 8,
              }}
            >
              {invoice.notes && (
                <div style={{ marginTop: 16 }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Notes
                  </p>
                  <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div style={{ marginTop: 16 }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      color: "#999",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Terms
                  </p>
                  <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
                    {invoice.terms}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pay button */}
          {(invoice.balanceDue ?? invoice.total) > 0 && !["paid", "canceled", "void"].includes(invoice.status) && (
            <PayButton
              token={token}
              invoice={invoice}
              hasPartialPayment={hasPartialPayment}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          background: "#0a0a0f",
          padding: "20px 24px",
          textAlign: "center",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <img
          src="/logos/nexli-logo-white-wordmark@2x.png"
          alt="Nexli"
          style={{ height: 16, opacity: 0.4 }}
        />
        <p
          style={{
            margin: "8px 0 0",
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
          }}
        >
          Powered by Nexli Portal
        </p>
      </footer>
    </div>
  );
}

function PayButton({
  token,
  invoice,
  hasPartialPayment,
}: {
  token: string;
  invoice: InvoiceData;
  hasPartialPayment: boolean;
}) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function handlePay() {
    setPaying(true);
    setPayError("");
    try {
      const res = await fetch(`/api/invoice/${token}/checkout`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        setPayError(data.error || "Failed to create payment session.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div
      style={{
        padding: "24px 32px",
        borderTop: "1px solid #e5e7eb",
        textAlign: "center",
      }}
    >
      {hasPartialPayment && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "#FFF7ED",
            border: "1px solid #FED7AA",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: "#9A3412",
            fontWeight: 600,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Partial payment received — {formatCurrency(invoice.amountPaid, invoice.currency)} of {formatCurrency(invoice.total, invoice.currency)} paid
        </div>
      )}
      <div>
        <button
          onClick={handlePay}
          disabled={paying}
          style={{
            display: "inline-block",
            background: paying
              ? "#94a3b8"
              : "linear-gradient(135deg, #2563EB, #06B6D4)",
            color: "#fff",
            border: "none",
            cursor: paying ? "not-allowed" : "pointer",
            padding: "14px 48px",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {paying
            ? "Redirecting to payment..."
            : `Pay ${formatCurrency(hasPartialPayment ? invoice.balanceDue : invoice.total, invoice.currency)}`}
        </button>
      </div>
      {payError && (
        <p style={{ margin: "8px 0 0", color: "#DC2626", fontSize: 13 }}>
          {payError}
        </p>
      )}
      <p
        style={{
          margin: "12px 0 0",
          color: "#999",
          fontSize: 12,
        }}
      >
        Secure payment via Helcim
      </p>
    </div>
  );
}
