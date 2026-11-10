"use client";

import { useEffect, useState } from "react";
import { Button, Chip, FIELD, NUM_FONT, Notice, Section, StatusDot, Surface } from "@/components/rainmaker";

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
      <Section id="bank-transfers" eyebrow="Mercury" title="Bank transfers">
        <Notice tone="warn" title="Mercury isn't connected">
          Setup, annual, renewal and Enterprise invoices still go through Stripe until MERCURY_API_TOKEN is added in Vercel.
        </Notice>
      </Section>
    );
  }

  const healthy = !status.lastError && Boolean(status.lastOkAt);
  return (
    <Section
      id="bank-transfers"
      eyebrow="Mercury"
      title="Bank transfers"
      sub="ACH and wire payments land in Mercury and are matched to invoices automatically."
    >
      <div className="space-y-3">
        <Surface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 text-sm">
            <StatusDot tone={healthy ? "green" : "amber"} className="mt-1.5" />
            <div className="min-w-0">
              <div className="font-semibold text-white">Mercury{status.account ? ` · ${status.account}` : ""}</div>
              <div className={`text-xs [overflow-wrap:anywhere] ${status.lastError ? "text-rose-300" : "text-neutral-400"}`}>
                {status.lastError
                  ? status.lastError
                  : `Checked ${ago(status.lastOkAt)} · checks every 10 minutes${status.creditsSeen != null ? ` · ${status.creditsSeen} incoming in the last 35 days` : ""}`}
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" busy={checking} onClick={() => void checkNow()} className="shrink-0 self-start sm:self-center">
            {checking ? "Checking…" : "Check now"}
          </Button>
        </Surface>

        {message && <Notice tone="info">{message}</Notice>}

        {status.review.length > 0 && (
          <Surface className="overflow-hidden">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Needs a look</span>
                <Chip tone="amber" size="xs">
                  {status.review.length}
                </Chip>
              </div>
              <p className="mt-1 text-xs text-neutral-400">Money that arrived in Mercury but couldn&apos;t be matched to an invoice with certainty.</p>
            </div>
            <ul className="divide-y divide-white/5">
              {status.review.map((item) => {
                const options = [...item.suggestions, ...status.openInvoices.filter((o) => !item.suggestions.some((s) => s.id === o.id))];
                const choice = picked[item.id] ?? item.suggestions[0]?.id ?? options[0]?.id ?? "";
                const chosen = options.find((o) => o.id === choice);
                const short = chosen && item.amountCents < chosen.balanceDueCents;
                return (
                  <li key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-semibold text-white" style={NUM_FONT}>
                        {usd(item.amountCents)} {item.counterpartyName ? `from ${item.counterpartyName}` : ""}
                        <span className="ml-2 text-xs font-normal text-neutral-400">
                          {item.postedAt ? new Date(item.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                        </span>
                      </div>
                      {item.memo && <div className="text-xs text-neutral-400 [overflow-wrap:anywhere]">Memo: {item.memo}</div>}
                      {item.reason && <div className="text-xs text-amber-300">{item.reason}</div>}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {options.length > 0 ? (
                        <select
                          value={choice}
                          onChange={(e) => setPicked((p) => ({ ...p, [item.id]: e.target.value }))}
                          className={`${FIELD} sm:max-w-xs`}
                          aria-label="Invoice this payment is for"
                        >
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-neutral-400">No open bank-transfer invoices</span>
                      )}
                      <Button
                        size="sm"
                        disabled={!choice}
                        busy={busyId === item.id}
                        onClick={() => {
                          if (short && !confirm(`${usd(item.amountCents)} is less than the ${usd(chosen!.balanceDueCents)} due. Record it as a partial payment?`)) return;
                          void review(item, { invoiceId: choice });
                        }}
                      >
                        {busyId === item.id ? "Saving…" : "Apply payment"}
                      </Button>
                      <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => void review(item, { dismiss: true })}>
                        Not an invoice payment
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Surface>
        )}
      </div>
    </Section>
  );
}
