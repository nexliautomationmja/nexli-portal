"use client";

import { useState } from "react";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    const res = await fetch("/api/dashboard/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    if (res.ok) {
      setStatus("success");
      setCurrent("");
      setNext("");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update password");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label
          className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Current Password
        </label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
          style={{ color: "var(--text-main)" }}
        />
      </div>
      <div>
        <label
          className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          New Password
        </label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
          style={{ color: "var(--text-main)" }}
        />
      </div>

      {status === "success" && (
        <p className="text-sm text-green-400">Password updated successfully.</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all"
      >
        {status === "saving" ? "Saving..." : "Update Password"}
      </button>
    </form>
  );
}
