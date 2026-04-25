"use client";

interface DocumentPreviewProps {
  content: string;
  subject: string;
  clientName: string;
  fromName: string;
  fromCompany: string;
  date?: string;
  /** Sender's signature data URL (PNG or SVG). When omitted no image is shown. */
  senderSignatureData?: string | null;
  senderSignedAt?: Date | string | null;
  senderRole?: string | null;
  /** Client's signature data URL (PNG). When omitted, an "awaiting" placeholder shows. */
  clientSignatureData?: string | null;
  clientSignedAt?: Date | string | null;
  clientSignedName?: string | null;
}

function formatSignedDate(input: Date | string | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DocumentPreview({
  content,
  subject,
  clientName,
  fromName,
  fromCompany,
  date,
  senderSignatureData,
  senderSignedAt,
  senderRole,
  clientSignatureData,
  clientSignedAt,
  clientSignedName,
}: DocumentPreviewProps) {
  const displayDate =
    date ||
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  // Split content into paragraphs on double newlines, preserve single newlines within
  const paragraphs = content
    ? content.split(/\n\n+/).filter((p) => p.trim())
    : [];

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
        fontFamily:
          "'Georgia', 'Times New Roman', 'Garamond', serif",
      }}
    >
      {/* Dark branded header with Nexli logo */}
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
          Engagement Letter
        </span>
      </div>

      {/* Date + Recipient + Subject */}
      <div style={{ padding: "28px 48px 0" }}>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            color: "#6b7280",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          {displayDate}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 10,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              Prepared For
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "#111827",
                fontWeight: 600,
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {clientName || "—"}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 10,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              Re
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "#111827",
                fontWeight: 600,
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {subject || "—"}
            </p>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginBottom: 0,
          }}
        />
      </div>

      {/* Letter Body */}
      <div style={{ padding: "28px 48px 16px" }}>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "16px 0 0",
                fontSize: 14,
                lineHeight: 1.85,
                color: "#374151",
                whiteSpace: "pre-wrap",
              }}
            >
              {paragraph}
            </p>
          ))
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.85,
              color: "#9ca3af",
              fontStyle: "italic",
            }}
          >
            Letter content will appear here...
          </p>
        )}
      </div>

      {/* Payment Processing Disclosure */}
      <div
        style={{
          padding: "20px 48px 0",
          borderTop: "1px solid #e5e7eb",
          marginTop: 8,
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          Payment Processing Disclosure
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.75,
            color: "#6b7280",
          }}
        >
          Payments for services rendered under this engagement are processed
          through Stripe, Inc., a third-party payment processor. By executing
          this agreement, you acknowledge and agree that{" "}
          {fromCompany || fromName} and Nexli are not responsible for any
          payment holds, account freezes, processing delays, or disputes
          imposed by Stripe or your financial institution. To minimize
          processing issues, we recommend maintaining a complete and accurate
          business profile with your payment provider. All payment data is
          handled directly by Stripe in accordance with their security and
          privacy policies; neither {fromCompany || fromName} nor Nexli
          stores your full payment credentials.
        </p>
      </div>

      {/* Signature Block — two columns: sender (left) + recipient (right) */}
      <div style={{ padding: "20px 48px 44px" }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "#374151",
            lineHeight: 1.85,
          }}
        >
          Sincerely,
        </p>
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 32,
          }}
        >
          {/* Sender signature */}
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 9,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              Service Provider
            </p>
            <div
              style={{
                height: 64,
                display: "flex",
                alignItems: "flex-end",
                borderBottom: "1px solid #374151",
                marginBottom: 6,
              }}
            >
              {senderSignatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={senderSignatureData}
                  alt="Sender signature"
                  style={{
                    maxHeight: 56,
                    maxWidth: "100%",
                    objectFit: "contain",
                    objectPosition: "left bottom",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    fontStyle: "italic",
                    fontFamily:
                      "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  }}
                >
                  Awaiting signature
                </span>
              )}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#111827",
                fontWeight: 600,
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {fromName || fromCompany || "—"}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "#6b7280",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {senderRole ||
                (fromCompany
                  ? `Authorized Representative, ${fromCompany}`
                  : "Authorized Representative")}
            </p>
            {senderSignedAt && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: "#9ca3af",
                  fontFamily:
                    "'Inter', 'Helvetica Neue', Arial, sans-serif",
                }}
              >
                Signed {formatSignedDate(senderSignedAt)}
              </p>
            )}
          </div>

          {/* Client signature */}
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 9,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              Client
            </p>
            <div
              style={{
                height: 64,
                display: "flex",
                alignItems: "flex-end",
                borderBottom: "1px solid #374151",
                marginBottom: 6,
              }}
            >
              {clientSignatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clientSignatureData}
                  alt="Client signature"
                  style={{
                    maxHeight: 56,
                    maxWidth: "100%",
                    objectFit: "contain",
                    objectPosition: "left bottom",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    fontStyle: "italic",
                    fontFamily:
                      "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  }}
                >
                  Awaiting signature
                </span>
              )}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#111827",
                fontWeight: 600,
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {clientSignedName || clientName || "—"}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "#6b7280",
                fontFamily:
                  "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              Client
            </p>
            {clientSignedAt && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: "#9ca3af",
                  fontFamily:
                    "'Inter', 'Helvetica Neue', Arial, sans-serif",
                }}
              >
                Signed {formatSignedDate(clientSignedAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
