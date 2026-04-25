"use client";

/**
 * SignatureCertificate
 *
 * DocuSign-style "Certificate of Completion" view for an e-signature. Used in
 * both the admin documents detail panel and the client portal so the same
 * artifact is shown to both parties when an e-sign request has been signed.
 *
 * Renders:
 *   - Document name + status
 *   - Signer block: signature image + name + email + signed timestamp
 *   - Sender block: name + company (no signature — sender doesn't sign PDFs,
 *     they only request signatures)
 *   - Audit trail: sent / viewed / signed timestamps + IP address
 */

interface SignatureCertificateProps {
  documentName: string;
  status: string;
  signerName: string;
  signerEmail: string;
  signatureData?: string | null;
  signatureIp?: string | null;
  sentAt?: string | Date | null;
  viewedAt?: string | Date | null;
  signedAt?: string | Date | null;
  declinedAt?: string | Date | null;
  declineReason?: string | null;
  senderName?: string | null;
  senderCompany?: string | null;
  senderEmail?: string | null;
}

function fmt(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SignatureCertificate({
  documentName,
  status,
  signerName,
  signerEmail,
  signatureData,
  signatureIp,
  sentAt,
  viewedAt,
  signedAt,
  declinedAt,
  declineReason,
  senderName,
  senderCompany,
  senderEmail,
}: SignatureCertificateProps) {
  const isSigned = status === "signed" && signedAt;
  const isDeclined = status === "declined";

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
        fontFamily: "'Inter','Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Dark branded header */}
      <div
        style={{
          background: "#0a0a0f",
          padding: "20px 40px",
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
          style={{ height: 24 }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Certificate of Completion
        </span>
      </div>

      {/* Document */}
      <div style={{ padding: "24px 40px 0" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Document
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: "#111827",
            fontWeight: 600,
          }}
        >
          {documentName}
        </p>

        <div
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: isSigned
              ? "#d1fae5"
              : isDeclined
                ? "#fee2e2"
                : "#dbeafe",
            color: isSigned
              ? "#065f46"
              : isDeclined
                ? "#991b1b"
                : "#1e40af",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: isSigned
                ? "#10b981"
                : isDeclined
                  ? "#ef4444"
                  : "#3b82f6",
            }}
          />
          {isSigned ? "Signed" : isDeclined ? "Declined" : status}
        </div>
      </div>

      {/* Signer signature block */}
      <div style={{ padding: "24px 40px 0" }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Electronic Signature
        </p>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "16px 20px",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              minHeight: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: "1px solid #d1d5db",
              marginBottom: 10,
              background: "#fff",
              borderRadius: 4,
              padding: "8px 12px",
            }}
          >
            {signatureData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureData}
                alt="Signature"
                style={{
                  maxHeight: 72,
                  maxWidth: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  fontStyle: "italic",
                }}
              >
                No signature on file
              </span>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              fontSize: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Signer
              </p>
              <p style={{ margin: "2px 0 0", color: "#111827", fontWeight: 600 }}>
                {signerName}
              </p>
              <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 11 }}>
                {signerEmail}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Signed
              </p>
              <p style={{ margin: "2px 0 0", color: "#111827", fontWeight: 600 }}>
                {fmt(signedAt)}
              </p>
              {signatureIp && (
                <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 11 }}>
                  IP {signatureIp}
                </p>
              )}
            </div>
          </div>
          {declineReason && (
            <p
              style={{
                margin: "10px 0 0",
                padding: "8px 10px",
                fontSize: 12,
                color: "#991b1b",
                background: "#fee2e2",
                borderRadius: 4,
                fontStyle: "italic",
              }}
            >
              Decline reason: {declineReason}
            </p>
          )}
        </div>
      </div>

      {/* Sender block */}
      <div style={{ padding: "20px 40px 0" }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Sent By
        </p>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "12px 16px",
            background: "#f9fafb",
            fontSize: 12,
          }}
        >
          <p style={{ margin: 0, color: "#111827", fontWeight: 600, fontSize: 13 }}>
            {senderName || "—"}
          </p>
          {senderCompany && (
            <p style={{ margin: "2px 0 0", color: "#6b7280" }}>{senderCompany}</p>
          )}
          {senderEmail && (
            <p style={{ margin: "2px 0 0", color: "#6b7280" }}>{senderEmail}</p>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div style={{ padding: "20px 40px 28px" }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Audit Trail
        </p>
        <div style={{ fontSize: 12, color: "#374151" }}>
          {sentAt && (
            <div style={{ display: "flex", gap: 12, padding: "4px 0" }}>
              <span style={{ color: "#9ca3af", minWidth: 60 }}>Sent</span>
              <span>{fmt(sentAt)}</span>
            </div>
          )}
          {viewedAt && (
            <div style={{ display: "flex", gap: 12, padding: "4px 0" }}>
              <span style={{ color: "#9ca3af", minWidth: 60 }}>Viewed</span>
              <span>{fmt(viewedAt)}</span>
            </div>
          )}
          {signedAt && (
            <div style={{ display: "flex", gap: 12, padding: "4px 0" }}>
              <span style={{ color: "#9ca3af", minWidth: 60 }}>Signed</span>
              <span>{fmt(signedAt)}</span>
            </div>
          )}
          {declinedAt && (
            <div style={{ display: "flex", gap: 12, padding: "4px 0" }}>
              <span style={{ color: "#9ca3af", minWidth: 60 }}>Declined</span>
              <span>{fmt(declinedAt)}</span>
            </div>
          )}
        </div>
        <p
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #e5e7eb",
            fontSize: 10,
            color: "#9ca3af",
            lineHeight: 1.6,
          }}
        >
          This certificate confirms the electronic signature is legally binding under
          the U.S. ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic
          Transactions Act (UETA). Signature, IP address, and timestamps are recorded.
        </p>
      </div>
    </div>
  );
}
