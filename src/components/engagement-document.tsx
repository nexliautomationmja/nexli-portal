"use client";

export interface DocumentSigner {
  name: string;
  role?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
}

interface DocumentPreviewProps {
  content: string;
  subject: string;
  clientName: string;
  fromName: string;
  fromCompany: string;
  date?: string;
  signers?: DocumentSigner[];
}

export function DocumentPreview({
  content,
  subject,
  clientName,
  fromName,
  fromCompany,
  date,
  signers,
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
          paragraphs.map((paragraph, i) => {
            const trimmed = paragraph.trim();
            // Detect numbered section headings like "1. SCOPE OF SERVICES" or "14. ELECTRONIC SIGNATURES"
            const isHeading = /^\d{1,2}\.\s+[A-Z]/.test(trimmed);
            // Detect document title lines (all caps, no number prefix, short)
            const isTitle = trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 3 && !/^\d/.test(trimmed);

            if (isHeading) {
              return (
                <h3
                  key={i}
                  style={{
                    margin: i === 0 ? 0 : "28px 0 0",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "#111827",
                    fontWeight: 700,
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  }}
                >
                  {trimmed}
                </h3>
              );
            }

            if (isTitle) {
              return (
                <h2
                  key={i}
                  style={{
                    margin: i === 0 ? 0 : "24px 0 0",
                    fontSize: 17,
                    lineHeight: 1.5,
                    color: "#111827",
                    fontWeight: 700,
                    textAlign: "center",
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  }}
                >
                  {trimmed}
                </h2>
              );
            }

            return (
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
            );
          })
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

      {/* Signature Block */}
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

        {signers && signers.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: signers.length > 1 ? "1fr 1fr" : "1fr",
              gap: 32,
              marginTop: 24,
            }}
          >
            {signers.map((signer, i) => (
              <div key={i}>
                {signer.signatureData ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={signer.signatureData}
                    alt={`${signer.name}'s signature`}
                    style={{
                      height: 56,
                      maxWidth: 220,
                      objectFit: "contain",
                      objectPosition: "left bottom",
                      display: "block",
                      marginBottom: 4,
                    }}
                  />
                ) : (
                  <div style={{ height: 56, marginBottom: 4 }} />
                )}
                <div
                  style={{
                    borderTop: "1px solid #374151",
                    width: 220,
                    paddingTop: 8,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#111827",
                      fontWeight: 600,
                      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                    }}
                  >
                    {signer.name}
                  </p>
                  {signer.role && (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "#6b7280",
                        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                      }}
                    >
                      {signer.role}
                    </p>
                  )}
                  {signer.signedAt && (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 10,
                        color: "#9ca3af",
                        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                      }}
                    >
                      Signed {new Date(signer.signedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 40,
              borderTop: "1px solid #374151",
              width: 200,
              paddingTop: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#111827",
                fontWeight: 600,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {fromCompany || fromName || "—"}
            </p>
            {fromCompany && fromName && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                }}
              >
                {fromName}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
