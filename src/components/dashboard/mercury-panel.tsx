"use client";

import { useEffect, useState } from "react";

// Mercury bank transfers on the Invoices page (Nexli admin only — the API
// answers 403 for everyone else and this renders nothing). Shows whether the
// sync is connected, a "Check now" button, and the transfers that arrived but
// couldn't be matched to an invoice with certainty.

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompany: string | null;
  balanceDueCents: number;
}

interface ReviewItem {
  id: string;
  amountCents: number;
  counterpartyName: string | null;
  memo: string | null;
  postedAt: string | null;
  reason: string | null;
  suggestions: InvoiceOption[];
}

interface Status {
  configured: boolean;
  account: string | null;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  creditsSeen: number | null;
  review: ReviewItem[];
  openInvoices: InvoiceOption[];
  error?: string;
  result?: { matched: string[]; review: number };
  applied?: { invoiceNumber: string; fullyPaid: boolean };
}

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function ago(iso: string | null): string {
  if (!iso) return "never";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const optionLabel = (o: InvoiceOption) => `${o.invoiceNumber} · ${o.clientCompany || o.clientName} · ${usd(o.balanceDueCents)}`;

export function MercuryPanel({ onInvoicesChanged }: { onInvoicesChanged: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/mercury/sync", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null)) // 403 = not the Nexli admin: show nothing
      .then((data) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkNow() {
    setChecking(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/mercury/sync", { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Status | null;
    if (data && "configured" in data) setStatus(data);
    if (!res?.ok) setMessage(data?.error ?? "Couldn't reach Mercury.");
    else if (data?.result) {
      const { matched, review } = data.result;
      setMessage(
        matched.length > 0
          ? `Marked paid: ${matched.join(", ")}.`
          : review > 0
            ? `${review} transfer${review > 1 ? "s" : ""} need a look below.`
            : "Up to date: no new payments for open invoices."
      );
      if (matched.length > 0) onInvoicesChanged();
    }
    setChecking(false);
  }

  async function review(item: ReviewItem, body: { invoiceId?: string; dismiss?: boolean }) {
    setBusyId(item.id);
    setMessage(null);
    const res = await fetch("/api/dashboard/mercury/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: item.id, ...body }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Status | null;
    if (!res?.ok) setMessage(data?.error ?? "That didn't work. Try again.");
    else if (data) {
      setStatus(data);
      if (data.applied) {
        setMessage(`${usd(item.amountCents)} applied to ${data.applied.invoiceNumber}${data.applied.fullyPaid ? " — paid in full." : " — partly paid."}`);
        onInvoicesChanged();
      }
    }
    setBusyId(null);
  }

  if (!status) return null;

  if (!status.configured) {
    return (
      <div className="glass-card flex flex-wrap items-center gap-3 p-4 text-sm" style={{ color: "var(--text-muted)" }}>
        <MercuryDot tone="off" />
        <span>
          <b style={{ color: "var(--text-main)" }}>Mercury isn&apos;t connected.</b> Setup, annual, renewal and Enterprise
          invoices still go through Stripe until <code>MERCURY_API_TOKEN</code> is added in Vercel.
        </span>
      </div>
    );
  }

  const healthy = !status.lastError && Boolean(status.lastOkAt);
  return (
    <div className="space-y-3">
      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 text-sm">
          <MercuryDot tone={healthy ? "ok" : "warn"} />
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: "var(--text-main)" }}>
              Mercury bank transfers{status.account ? ` · ${status.account}` : ""}
            </p>
            <p className="text-xs [overflow-wrap:anywhere]" style={{ color: status.lastError ? "#F43F5E" : "var(--text-muted)" }}>
              {status.lastError
                ? status.lastError
                : `Checked ${ago(status.lastOkAt)} · checks every 10 minutes${status.creditsSeen != null ? ` · ${status.creditsSeen} incoming in the last 35 days` : ""}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void checkNow()}
          disabled={checking}
          className="min-h-10 shrink-0 rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-[var(--input-bg)] disabled:opacity-60"
          style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
        >
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>

      {message && (
        <p className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
          {message}
        </p>
      )}

      {status.review.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-[var(--card-border)] p-4">
            <p className="section-header mb-0">Needs review · {status.review.length}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Money that arrived in Mercury but couldn&apos;t be matched to an invoice with certainty.
            </p>
          </div>
          <ul className="divide-y divide-[var(--card-border)]">
            {status.review.map((item) => {
              const options = [...item.suggestions, ...status.openInvoices.filter((o) => !item.suggestions.some((s) => s.id === o.id))];
              const choice = picked[item.id] ?? item.suggestions[0]?.id ?? options[0]?.id ?? "";
              const chosen = options.find((o) => o.id === choice);
              const short = chosen && item.amountCents < chosen.balanceDueCents;
              return (
                <li key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold" style={{ color: "var(--text-main)" }}>
                      {usd(item.amountCents)} {item.counterpartyName ? `from ${item.counterpartyName}` : ""}
                      <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                        {item.postedAt ? new Date(item.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </p>
                    {item.memo && (
                      <p className="text-xs [overflow-wrap:anywhere]" style={{ color: "var(--text-muted)" }}>
                        Memo: {item.memo}
                      </p>
                    )}
                    {item.reason && <p className="text-xs text-amber-700 dark:text-amber-500">{item.reason}</p>}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {options.length > 0 ? (
                      <select
                        value={choice}
                        onChange={(e) => setPicked((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="min-h-10 max-w-full rounded-lg border px-3 text-sm sm:max-w-xs"
                        style={{ borderColor: "var(--card-border)", background: "var(--input-bg)", color: "var(--text-main)" }}
                        aria-label="Invoice this payment is for"
                      >
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {optionLabel(o)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No open bank-transfer invoices
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!choice || busyId === item.id}
                      onClick={() => {
                        if (short && !confirm(`${usd(item.amountCents)} is less than the ${usd(chosen!.balanceDueCents)} due. Record it as a partial payment?`)) return;
                        void review(item, { invoiceId: choice });
                      }}
                      className="min-h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                    >
                      {busyId === item.id ? "Saving…" : "Apply payment"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void review(item, { dismiss: true })}
                      className="min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
                      style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
                    >
                      Not an invoice payment
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function MercuryDot({ tone }: { tone: "ok" | "warn" | "off" }) {
  const color = tone === "ok" ? "#10B981" : tone === "warn" ? "#F59E0B" : "#64748B";
  return <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }} />;
}
