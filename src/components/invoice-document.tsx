"use client";

interface InvoiceDocumentPreviewProps {
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  fromName: string;
  fromCompany: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount?: number;
    billingType?: string;
  }>;
  currency?: string;
  taxRate: number;
  dueDate?: string;
  issueDate?: string;
  notes?: string;
  terms?: string;
  valuesInCents?: boolean;
  invoiceNumber?: string;
}

const labelStyle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: 10,
  fontWeight: 700,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#111827",
  fontWeight: 600,
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

const mutedStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: 12,
  color: "#6b7280",
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

export function InvoiceDocumentPreview({
  clientName,
  clientEmail,
  clientCompany,
  fromName,
  fromCompany,
  lineItems,
  currency = "usd",
  taxRate,
  dueDate,
  issueDate,
  notes,
  terms,
  valuesInCents = false,
  invoiceNumber,
}: InvoiceDocumentPreviewProps) {
  function fmt(cents: number): string {
    const dollars = cents / 100;
    const symbols: Record<string, string> = {
      usd: "$",
      cad: "CA$",
      gbp: "\u00a3",
      eur: "\u20ac",
      aud: "A$",
    };
    const sym = symbols[currency.toLowerCase()] || "$";
    return `${sym}${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function displayDate(dateStr?: string): string {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const issueDateDisplay = issueDate
    ? displayDate(issueDate)
    : new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  const billingLabels: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };

  const computed = lineItems.map((item) => {
    const billingType = item.billingType || "one_time";
    if (valuesInCents) {
      return {
        description: item.description,
        qty: item.quantity / 100,
        unitPriceCents: item.unitPrice,
        amountCents: item.amount ?? 0,
        billingType,
      };
    }
    const amountDollars = item.quantity * item.unitPrice;
    return {
      description: item.description,
      qty: item.quantity,
      unitPriceCents: Math.round(item.unitPrice * 100),
      amountCents: Math.round(amountDollars * 100),
      billingType,
    };
  });

  const subtotalCents = computed.reduce((s, i) => s + i.amountCents, 0);
  const taxAmountCents = Math.round((subtotalCents * taxRate) / 100);
  const totalCents = subtotalCents + taxAmountCents;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
        maxWidth: 680,
        margin: "0 auto",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Dark branded header */}
      <div
        style={{
          background: "#0a0a0f",
          padding: "20px 48px",
          borderRadius: "4px 4px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/nexli-logo-white-wordmark@2x.png"
          alt="Nexli"
          style={{ height: 28 }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {invoiceNumber || "Invoice"}
        </span>
      </div>

      {/* From / Bill To */}
      <div style={{ padding: "28px 48px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 16,
          }}
        >
          <div>
            <p style={labelStyle}>From</p>
            <p style={valueStyle}>{fromCompany || fromName || "\u2014"}</p>
            {fromCompany && fromName && <p style={mutedStyle}>{fromName}</p>}
          </div>
          <div>
            <p style={labelStyle}>Bill To</p>
            <p style={valueStyle}>{clientName || "\u2014"}</p>
            {clientCompany && <p style={mutedStyle}>{clientCompany}</p>}
            {clientEmail && <p style={mutedStyle}>{clientEmail}</p>}
          </div>
        </div>

        {/* Issue Date / Due Date */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <p style={labelStyle}>Issue Date</p>
            <p style={valueStyle}>{issueDateDisplay}</p>
          </div>
          <div>
            <p style={labelStyle}>Due Date</p>
            <p style={valueStyle}>{dueDate ? displayDate(dueDate) : "\u2014"}</p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 0 }} />
      </div>

      {/* Line Items Table */}
      <div style={{ padding: "24px 48px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th
                style={{
                  ...labelStyle,
                  textAlign: "left",
                  padding: "0 0 8px",
                  margin: 0,
                }}
              >
                Description
              </th>
              <th
                style={{
                  ...labelStyle,
                  textAlign: "right",
                  padding: "0 0 8px",
                  margin: 0,
                  width: 60,
                }}
              >
                Qty
              </th>
              <th
                style={{
                  ...labelStyle,
                  textAlign: "right",
                  padding: "0 0 8px",
                  margin: 0,
                  width: 100,
                }}
              >
                Rate
              </th>
              <th
                style={{
                  ...labelStyle,
                  textAlign: "right",
                  padding: "0 0 8px",
                  margin: 0,
                  width: 100,
                }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {computed.length > 0 ? (
              computed.map((item, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td
                    style={{
                      padding: "12px 0",
                      color: "#111827",
                      fontSize: 14,
                    }}
                  >
                    {item.description || (
                      <em style={{ color: "#9ca3af" }}>No description</em>
                    )}
                    {billingLabels[item.billingType] && (
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
                        {billingLabels[item.billingType]}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: "#6b7280",
                      padding: "12px 0",
                      fontSize: 14,
                    }}
                  >
                    {Number.isInteger(item.qty)
                      ? item.qty
                      : item.qty.toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: "#6b7280",
                      padding: "12px 0",
                      fontSize: 14,
                    }}
                  >
                    {fmt(item.unitPriceCents)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: 600,
                      padding: "12px 0",
                      fontSize: 14,
                    }}
                  >
                    {fmt(item.amountCents)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "24px 0",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontStyle: "italic",
                    fontSize: 14,
                  }}
                >
                  No line items added yet...
                </td>
              </tr>
            )}
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
            <span style={{ color: "#6b7280", fontSize: 14 }}>Subtotal</span>
            <span style={{ color: "#111827", fontSize: 14 }}>
              {fmt(subtotalCents)}
            </span>
          </div>
          {taxRate > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#6b7280", fontSize: 14 }}>
                Tax ({taxRate.toFixed(2)}%)
              </span>
              <span style={{ color: "#111827", fontSize: 14 }}>
                {fmt(taxAmountCents)}
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
              style={{ color: "#111827", fontSize: 18, fontWeight: 800 }}
            >
              Total
            </span>
            <span
              style={{ color: "#111827", fontSize: 18, fontWeight: 800 }}
            >
              {fmt(totalCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(notes || terms) && (
        <div
          style={{
            padding: "0 48px 28px",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          {notes && (
            <div style={{ marginTop: 16 }}>
              <p style={labelStyle}>Notes</p>
              <p
                style={{
                  ...mutedStyle,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {notes}
              </p>
            </div>
          )}
          {terms && (
            <div style={{ marginTop: 16 }}>
              <p style={labelStyle}>Terms</p>
              <p
                style={{
                  ...mutedStyle,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {terms}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
