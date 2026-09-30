"use client";

import { useEffect, useState } from "react";

interface ProvisionSteps {
  user: string;
  templates: string;
  agreement: string;
  agreementEmail: string;
  welcomeEmail: string;
  site?: string;
}

interface ProvisionResponse {
  ok: boolean;
  userId: string;
  created: boolean;
  steps: ProvisionSteps;
  errors: string[];
}

interface CreateFirmDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (userId: string) => void;
}

const labelClass =
  "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5";
const labelStyle = { color: "var(--text-muted)", opacity: 0.6 } as const;

function stepTone(value: string): string {
  if (value === "created" || value === "seeded" || value === "sent") return "badge-emerald";
  if (value === "updated" || value === "exists" || value === "already") return "badge-blue";
  if (value === "failed") return "badge-rose";
  return "badge-gray";
}

export function CreateFirmDialog({ open, onClose, onCreated }: CreateFirmDialogProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<"foundation" | "drs">("foundation");
  const [sendAgreement, setSendAgreement] = useState(true);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProvisionResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  function reset() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setFirmName("");
    setPhone("");
    setWebsiteUrl("");
    setTier("foundation");
    setSendAgreement(true);
    setSendWelcome(true);
    setError("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          firmName,
          phone,
          websiteUrl,
          tier,
          sendAgreement: tier === "foundation" ? sendAgreement : false,
          sendWelcome,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(data?.details) ? data.details.join(", ") : "";
        setError(data?.error ? `${data.error}${details ? `: ${details}` : ""}` : "Request failed");
        return;
      }
      setResult(data as ProvisionResponse);
      onCreated((data as ProvisionResponse).userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-firm-title"
        className="glass-card w-full max-w-lg p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2
              id="create-firm-title"
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--text-main)" }}
            >
              Create firm
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Provisions the account, seeds starter engagement templates, and sends
              the onboarding emails.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xl leading-none px-2 hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: result.ok ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                background: result.ok ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
              }}
            >
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                {result.ok
                  ? result.created
                    ? "Firm created and provisioned."
                    : "Existing firm updated and provisioned."
                  : "Provisioned with issues."}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                {(
                  [
                    ["User", result.steps.user],
                    ["Templates", result.steps.templates],
                    ["Agreement", result.steps.agreement],
                    ["Agreement email", result.steps.agreementEmail],
                    ["Welcome email", result.steps.welcomeEmail],
                    ["Website", result.steps.site ?? "skipped"],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {label}
                    </span>
                    <span className={`badge ${stepTone(value)}`}>{value}</span>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                Create another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="cf-email" className={labelClass} style={labelStyle}>
                  Owner email *
                </label>
                <input
                  id="cf-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@firm.com"
                  className="glass-input"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="cf-first" className={labelClass} style={labelStyle}>
                  First name
                </label>
                <input
                  id="cf-first"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div>
                <label htmlFor="cf-last" className={labelClass} style={labelStyle}>
                  Last name
                </label>
                <input
                  id="cf-last"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cf-firm" className={labelClass} style={labelStyle}>
                  Firm name *
                </label>
                <input
                  id="cf-firm"
                  type="text"
                  required
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Smith & Co CPAs"
                  className="glass-input"
                />
              </div>
              <div>
                <label htmlFor="cf-phone" className={labelClass} style={labelStyle}>
                  Phone
                </label>
                <input
                  id="cf-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div>
                <label htmlFor="cf-site" className={labelClass} style={labelStyle}>
                  Website
                </label>
                <input
                  id="cf-site"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://"
                  className="glass-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cf-tier" className={labelClass} style={labelStyle}>
                  Tier
                </label>
                <select
                  id="cf-tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as "foundation" | "drs")}
                  className="w-full px-4 py-3 rounded-lg text-sm border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50"
                  style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
                >
                  <option value="foundation">Firm Foundation ($497/mo)</option>
                  <option value="drs">Digital Rainmaker System</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label
                className={`flex items-center gap-2 text-sm ${tier !== "foundation" ? "opacity-50" : ""}`}
                style={{ color: "var(--text-main)" }}
              >
                <input
                  type="checkbox"
                  checked={tier === "foundation" && sendAgreement}
                  disabled={tier !== "foundation"}
                  onChange={(e) => setSendAgreement(e.target.checked)}
                  className="accent-blue-600"
                />
                Send Firm Foundation service agreement for e-signature
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-main)" }}>
                <input
                  type="checkbox"
                  checked={sendWelcome}
                  onChange={(e) => setSendWelcome(e.target.checked)}
                  className="accent-blue-600"
                />
                Send welcome email with password setup link
              </label>
            </div>

            {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors disabled:opacity-50"
                style={{ color: "var(--text-main)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-full text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Provisioning..." : "Create firm"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
