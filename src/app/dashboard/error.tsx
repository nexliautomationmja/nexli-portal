"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the entire /dashboard segment. Catches server-render or
 * client-render failures (most often a database blip) and shows a friendly,
 * recoverable screen instead of the raw "Application error" page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary:", error);
  }, [error]);

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-4"
      style={{ color: "var(--text-main)" }}
    >
      <div className="glass-card max-w-md w-full p-8 text-center space-y-4">
        <div className="text-4xl">🔌</div>
        <h1 className="text-lg font-bold">We&apos;re having trouble connecting</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          This is usually temporary — the dashboard couldn&apos;t reach its data
          just now. Give it a moment and try again.
        </p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-full text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            Try again
          </button>
          <Link
            href="/login"
            className="px-4 py-3 rounded-lg text-sm font-medium border transition-colors no-underline"
            style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
          >
            Sign in again
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] pt-1" style={{ color: "var(--text-muted)" }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
