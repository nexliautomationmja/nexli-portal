"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function MagicLinkForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (searchParams.get("error") === "invalid") {
      setErrorMsg("That link is invalid or has expired. Please try again.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/portal/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to send login link"
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center py-4">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #2563EB20, #06B6D420)",
            border: "1px solid #2563EB40",
          }}
        >
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <h2
          className="text-lg font-bold mb-2"
          style={{ color: "var(--text-main)" }}
        >
          Check your email
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          We sent a sign-in link to{" "}
          <strong style={{ color: "var(--text-main)" }}>{email}</strong>
        </p>
        <p
          className="text-xs mt-3"
          style={{ color: "var(--text-muted)", opacity: 0.7 }}
        >
          The link expires in 15 minutes. Check your spam folder if you
          don&apos;t see it.
        </p>
        <button
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="mt-6 text-sm font-medium hover:underline"
          style={{ color: "var(--accent-blue)" }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Email Address
        </label>
        <input
          type="email"
          className="glass-input"
          placeholder="you@yourfirm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-blue-600 text-white px-6 py-4 rounded-full font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "sending" ? "Sending..." : "Send Sign-In Link"}
      </button>

      <p
        className="text-center text-xs"
        style={{ color: "var(--text-muted)", opacity: 0.6 }}
      >
        We&apos;ll email you a magic link to sign in — no password needed.
      </p>
    </form>
  );
}
