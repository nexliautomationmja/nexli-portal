"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MIN_LENGTH = 10;

export function SetupPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(data?.redirect || "/login?setup=done");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const inputType = show ? "text" : "password";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="password"
            className="block text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          >
            New Password
          </label>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-[10px] font-bold uppercase tracking-wider hover:underline"
            style={{ color: "var(--accent-blue)" }}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="password"
          type={inputType}
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_LENGTH} characters`}
          className="glass-input"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Confirm Password
        </label>
        <input
          id="confirm"
          type={inputType}
          required
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          className="glass-input"
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-4 rounded-full font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Saving...
          </span>
        ) : (
          "Set Password & Continue"
        )}
      </button>
    </form>
  );
}
