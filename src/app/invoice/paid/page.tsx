import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Successful | Nexli Portal",
};

export default function InvoicePaidPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
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
              color: "#000",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            Payment Successful
          </h1>
          <p style={{ margin: "0 0 24px", color: "#666", fontSize: 14 }}>
            Your payment has been received. A receipt has been sent to your
            email.
          </p>
          <a
            href="/portal"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              color: "#fff",
              textDecoration: "none",
              padding: "12px 32px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Go to Client Portal
          </a>
          <p style={{ margin: "16px 0 0", color: "#999", fontSize: 12 }}>
            You can also safely close this window.
          </p>
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
