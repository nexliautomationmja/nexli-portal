"use client";

/**
 * Last-resort boundary for errors thrown by the root layout itself. Must
 * render its own <html>/<body> because the root layout is what failed.
 * Styled inline: global CSS may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b1220",
          color: "#e5e7eb",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong loading the dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 16px" }}>
            This is usually temporary. Try again, or sign in again if it keeps happening.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              borderRadius: 999,
              border: 0,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              cursor: "pointer",
              marginRight: 12,
            }}
          >
            Try again
          </button>
          <a href="/login" style={{ color: "#e5e7eb", fontSize: 14 }}>
            Sign in again
          </a>
          {error.digest && (
            <p style={{ fontSize: 10, color: "#6b7280", marginTop: 12 }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
