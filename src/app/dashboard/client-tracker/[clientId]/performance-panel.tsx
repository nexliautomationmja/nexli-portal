"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Check, ChevronDown, Link2, RefreshCw, Trash2, UserX } from "lucide-react";
import { Button, ButtonLink, Chip, EmptyState, FIELD, Field, Inset, MiniStat, NUM_FONT, Notice, Section, StatusDot, Surface, type Tone } from "@/components/rainmaker";
import type { MonthView, PerformanceView } from "@/lib/performance/view-types";
import { HOW_LABEL, SPEND_SOURCE, day, mathRows, paymentsText, trail, usd } from "../performance-format";

/**
 * Admin: one client firm's ads and Performance Pay on the Nov 19 2026
 * pricing. The portal works the month out from the firm's own data (its ad
 * leads, its invoices, its ad spend); Marcel checks the clients listed, fixes
 * what the match got wrong, and presses Send. Nothing is invoiced before
 * that. Renders nothing for clients on the previous pricing.
 */
export function PerformancePanel({
  clientId,
  clientLabel,
  onEnabled,
}: {
  clientId: string;
  clientLabel: string;
  /** Called once it's known this client is on the performance pricing (the page then lists the section in its nav). */
  onEnabled?: () => void;
}) {
  const [view, setView] = useState<PerformanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const url = `/api/dashboard/client-tracker/${clientId}/performance`;

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((d: PerformanceView) => {
        if (!alive) return;
        setView(d);
        if (d.enabled) onEnabled?.();
        // Open the month that needs him: the newest one that has ended and isn't sent.
        const next = d.months?.find((m) => m.status === "draft" && m.totals.collectedCents > 0) ?? d.months?.find((m) => m.status === "draft");
        setOpen(next?.monthIndex ?? null);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // onEnabled is a stable setter from the page; re-running the load for it would refetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const act = useCallback(
    async (key: string, body: Record<string, unknown>): Promise<boolean> => {
      setBusy(key);
      setError(null);
      setNote(null);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => null)) as (PerformanceView & { error?: string; note?: string }) | null;
        if (!res.ok || !data) {
          setError(data?.error || "That didn't go through. Try again.");
          return false;
        }
        setView(data);
        if (data.note) setNote(data.note);
        return true;
      } catch {
        setError("Network error. Check your connection and try again.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [url]
  );

  // Previous-pricing clients: no panel at all. While it loads we don't know yet, so show nothing rather than flash.
  if (loading || failed || !view?.enabled || !view.terms) {
    return failed ? (
      <Section id="performance" eyebrow="Performance pay" title="Ads and performance pay">
        <Notice tone="error">Couldn&apos;t load this client&apos;s performance pay. Reload the page to try again.</Notice>
      </Section>
    ) : null;
  }

  const { terms, term, leads, current, months = [], attributed = [], uncounted = [], leadOptions = [] } = view;
  const waiting = months.filter((m) => m.status === "draft" && m.totals.collectedCents > 0).length;

  return (
    <Section
      id="performance"
      eyebrow="Performance pay"
      title="Ads and performance pay"
      sub={`${terms.percent}% of what ${clientLabel} collects from clients the ads brought in, after ad spend, less the ${usd(terms.feeCents)} fee for the month. Worked out from their portal. Nothing is invoiced until you press Send.`}
      right={
        <Button size="sm" variant="secondary" busy={busy === "sync"} onClick={() => void act("sync", { action: "sync" })}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh leads
        </Button>
      }
    >
      <div className="space-y-4">
        {error && (
          <Notice tone="error" onClose={() => setError(null)}>
            {error}
          </Notice>
        )}
        {note && (
          <Notice tone="success" onClose={() => setNote(null)}>
            {note}
          </Notice>
        )}
        {waiting > 0 && (
          <Notice tone="warn" title={`${waiting} month${waiting === 1 ? "" : "s"} ready to review`}>
            Check the clients listed, then send the invoice.
          </Notice>
        )}
        {leads && !leads.connected && (
          <Notice tone="warn" title="Their GoHighLevel isn't connected">
            Without it the portal can&apos;t tell which of their paying clients came from the ads. Connect their location on the Admin page, then press Refresh leads.
          </Notice>
        )}
        {leads?.connected && leads.error && <Notice tone="warn">{leads.error}</Notice>}

        {current && <ThisMonth month={current} leadsTotal={leads?.total ?? 0} syncedAt={leads?.syncedAt ?? null} />}

        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-bold text-white">Months that have ended</p>
            <p className="text-[11px] text-neutral-400">A month runs from the day they signed to the same day next month.</p>
          </div>
          {months.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<BadgeDollarSign className="h-5 w-5" aria-hidden="true" />}
                title="No month has ended yet"
                body={term ? `Their first month ends ${day(current?.periodEnd ?? term.currentEndsAt)}. You'll get a notice when there's something to review.` : "Their first statement appears a month after they sign."}
              />
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {months.map((m) => (
                <MonthRow
                  key={m.monthIndex}
                  month={m}
                  open={open === m.monthIndex}
                  onToggle={() => setOpen((cur) => (cur === m.monthIndex ? null : m.monthIndex))}
                  busy={busy}
                  act={act}
                  clientLabel={clientLabel}
                />
              ))}
            </div>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-bold text-white">Clients the ads brought in</p>
            <p className="text-[11px] text-neutral-400">Each one with how they came in. This is the list a statement is built from.</p>
          </div>
          {attributed.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-400">
              No paying client is matched to an ad lead yet. {leads?.total ? `${leads.total} ad lead${leads.total === 1 ? "" : "s"} saved so far.` : ""}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {attributed.map((c) => (
                <div key={c.email} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start">
                  <StatusDot tone={c.excluded ? "amber" : "green"} className="mt-1.5 hidden sm:block" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      <span className="truncate text-[11px] text-neutral-400">{c.company ? `${c.company} · ${c.email}` : c.email}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">
                      {trail(c)}
                      {c.firstPaidAt ? ` → first paid ${day(c.firstPaidAt)}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip size="xs" tone={c.how === "manual" ? "violet" : "neutral"}>
                        {HOW_LABEL[c.how]}
                      </Chip>
                      {c.excluded && (
                        <Chip size="xs" tone="amber">
                          Left out
                        </Chip>
                      )}
                    </div>
                    {/* The reason can be a full sentence: plain text, so it wraps on a phone instead of being cut off. */}
                    {c.excluded && <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">{c.excluded.reason}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                    <span className="text-sm font-bold text-white" style={NUM_FONT}>
                      {usd(c.totalPaidCents)}
                    </span>
                    {c.excluded ? (
                      c.excluded.by === "rule" ? (
                        <Button size="sm" variant="ghost" busy={busy === `rule:${c.email}`} onClick={() => void act(`rule:${c.email}`, { action: "rule", email: c.email, rule: null })}>
                          Count them again
                        </Button>
                      ) : null
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        busy={busy === `rule:${c.email}`}
                        onClick={() => {
                          const reason = window.prompt(`Leave ${c.name} out of performance pay? Say why (they'll stay out until you count them again).`);
                          if (reason === null) return;
                          void act(`rule:${c.email}`, { action: "rule", email: c.email, rule: "exclude", reason });
                        }}
                      >
                        <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                        Leave out
                      </Button>
                    )}
                    {c.how === "manual" && !c.excluded && (
                      <Button size="sm" variant="ghost" busy={busy === `rule:${c.email}`} onClick={() => void act(`rule:${c.email}`, { action: "rule", email: c.email, rule: null })}>
                        Unlink
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        {uncounted.length > 0 && (
          <Surface className="overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-bold text-white">Paying clients with no ad lead behind them</p>
              <p className="text-[11px] text-neutral-400">
                Not counted. If one of them is an ad lead who paid under a different email, link them and they count from then on.
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {uncounted.map((c) => (
                <UncountedRow key={c.email} payer={c} leadOptions={leadOptions} busy={busy === `rule:${c.email}`} act={act} />
              ))}
            </div>
          </Surface>
        )}

        {term && <TermBox view={view} busy={busy} act={act} />}
      </div>
    </Section>
  );
}

// ─── This month so far ─────────────────────────────────────

function ThisMonth({ month, leadsTotal, syncedAt }: { month: MonthView; leadsTotal: number; syncedAt: string | null }) {
  const t = month.totals;
  const tone: Tone = t.dueCents > 0 ? "green" : "neutral";
  return (
    <Surface className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">This month so far</p>
          <p className="text-sm font-bold text-white">{month.label}</p>
        </div>
        <span className="text-[11px] text-neutral-400">{syncedAt ? `Leads read ${day(syncedAt)}` : "Leads not read yet"}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Ad spend" value={usd(t.adSpendCents)} sub={SPEND_SOURCE[month.adSpendSource]} tone={month.adSpendSource === "none" ? "amber" : "neutral"} />
        <MiniStat label="Ad leads" value={leadsTotal.toLocaleString("en-US")} sub="since they signed" />
        <MiniStat label="Paying ad clients" value={String(t.clients)} sub="this month" />
        <MiniStat label="Collected" value={usd(t.collectedCents)} sub="from ad clients" tone="cyan" />
        <MiniStat label="Net" value={usd(t.netCents)} sub="after ad spend" />
        <MiniStat label="Performance pay" value={usd(t.dueCents)} sub={`${t.percent}% is ${usd(t.grossCents)}, fee is ${usd(t.creditCents)}`} tone={tone} />
      </div>
      {month.adSpendNote && month.adSpendSource !== "meta" && <p className="mt-3 text-[11px] text-amber-200/90">{month.adSpendNote}</p>}
    </Surface>
  );
}

// ─── One ended month ───────────────────────────────────────

type Act = (key: string, body: Record<string, unknown>) => Promise<boolean>;

const STATUS: Record<MonthView["status"], { tone: Tone; label: string }> = {
  open: { tone: "neutral", label: "Running" },
  draft: { tone: "amber", label: "Not sent" },
  sent: { tone: "green", label: "Sent" },
  none_due: { tone: "neutral", label: "Nothing due" },
};

function MonthRow({ month, open, onToggle, busy, act, clientLabel }: { month: MonthView; open: boolean; onToggle: () => void; busy: string | null; act: Act; clientLabel: string }) {
  const t = month.totals;
  const draft = month.status === "draft";
  const status = draft && t.collectedCents === 0 && month.extras.length === 0 ? { tone: "neutral" as Tone, label: "Nothing collected" } : STATUS[month.status];
  const key = `m${month.monthIndex}`;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{month.label}</p>
          <p className="truncate text-[11px] text-neutral-400">
            {usd(t.collectedCents)} collected · {usd(t.adSpendCents)} ad spend · {usd(t.netCents)} net
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-white" style={NUM_FONT}>
          {usd(t.dueCents)}
        </span>
        <Chip size="xs" tone={status.tone} dot className="shrink-0">
          {status.label}
        </Chip>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/5 bg-black/20 px-4 py-4">
          <Inset className="divide-y divide-white/5">
            {mathRows(t).map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
                <span className={`text-sm ${r.strong ? "font-bold text-white" : "text-neutral-300"}`}>{r.label}</span>
                <span className={`shrink-0 text-sm ${r.strong ? "font-extrabold text-white" : "font-semibold text-neutral-200"}`} style={NUM_FONT}>
                  {r.value}
                </span>
              </div>
            ))}
          </Inset>
          <p className="text-[11px] text-neutral-400">
            Ad spend {SPEND_SOURCE[month.adSpendSource]}.{month.adSpendNote && month.adSpendSource !== "meta" ? ` ${month.adSpendNote}` : ""}
          </p>

          {month.lines.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Who paid</p>
              <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                {month.lines.map((l) => (
                  <div key={l.email} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {l.name}
                        {l.company ? <span className="font-normal text-neutral-400"> · {l.company}</span> : null}
                      </p>
                      <p className="text-xs leading-relaxed text-neutral-300">{trail(l.lead)}</p>
                      <p className="text-[11px] text-neutral-500">
                        {HOW_LABEL[l.how]} · {paymentsText(l)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-white" style={NUM_FONT}>
                      {usd(l.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {month.extras.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Added by you</p>
              <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                {month.extras.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{e.name}</p>
                      <p className="text-[11px] text-neutral-400">{[e.at ? day(e.at) : null, e.note].filter(Boolean).join(" · ") || "Paid outside the portal"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-white" style={NUM_FONT}>
                        {usd(e.amountCents)}
                      </span>
                      {draft && (
                        <button
                          type="button"
                          aria-label={`Remove ${e.name}`}
                          disabled={busy !== null}
                          onClick={() => void act(`${key}:rm`, { action: "remove_extra", month: month.monthIndex, id: e.id })}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft && <DraftControls month={month} busy={busy} act={act} clientLabel={clientLabel} />}

          {month.status === "sent" && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="green" icon={<Check className="h-3 w-3" aria-hidden="true" />}>
                Sent {day(month.sentAt)}
              </Chip>
              {month.invoice && (
                <>
                  <ButtonLink href={`/dashboard/invoices?id=${month.invoice.id}`} size="sm">
                    Invoice {month.invoice.number}
                  </ButtonLink>
                  <Chip size="xs" tone={month.invoice.status === "paid" ? "green" : "amber"} dot>
                    {month.invoice.status === "paid" ? `Paid ${day(month.invoice.paidAt)}` : "Awaiting payment"}
                  </Chip>
                </>
              )}
            </div>
          )}
          {month.status === "none_due" && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral">Closed {day(month.sentAt)} with nothing due</Chip>
              <Button size="sm" variant="ghost" busy={busy === `${key}:reopen`} onClick={() => void act(`${key}:reopen`, { action: "reopen", month: month.monthIndex })}>
                Reopen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DraftControls({ month, busy, act, clientLabel }: { month: MonthView; busy: string | null; act: Act; clientLabel: string }) {
  const key = `m${month.monthIndex}`;
  const [spend, setSpend] = useState(month.adSpendSource === "none" ? "" : String(month.totals.adSpendCents / 100));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState("");
  const [why, setWhy] = useState("");
  const due = month.totals.dueCents;
  const needsSpend = month.adSpendSource === "none" && month.totals.collectedCents > 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
        <Field label="Ad spend for the month ($)" hint={month.adSpendSource === "manual" ? "Your figure" : `Now ${SPEND_SOURCE[month.adSpendSource]}`}>
          {(id) => <input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="e.g. 15000" className={FIELD} />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" busy={busy === `${key}:spend`} disabled={spend.trim() === ""} onClick={() => void act(`${key}:spend`, { action: "set_spend", month: month.monthIndex, dollars: spend })}>
            Save ad spend
          </Button>
          {month.adSpendSource === "manual" && (
            <Button size="sm" variant="ghost" busy={busy === `${key}:spend-clear`} onClick={() => void act(`${key}:spend-clear`, { action: "set_spend", month: month.monthIndex, dollars: null })}>
              Read it from Meta instead
            </Button>
          )}
        </div>
      </div>

      {adding ? (
        <Inset className="space-y-3 p-3.5">
          <p className="text-xs text-neutral-300">Money an ad-sourced client paid them outside the portal. Use a minus amount to take a refund off.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} placeholder="Who paid" className={FIELD} />}</Field>
            <Field label="Amount ($)">{(id) => <input id={id} type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 7500" className={FIELD} />}</Field>
            <Field label="Date paid" hint="Optional">
              {(id) => <input id={id} type="date" value={at} onChange={(e) => setAt(e.target.value)} className={`${FIELD} [color-scheme:dark]`} />}
            </Field>
            <Field label="Note" hint="Optional">
              {(id) => <input id={id} value={why} onChange={(e) => setWhy(e.target.value.slice(0, 300))} placeholder="e.g. paid by check" className={FIELD} />}
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              busy={busy === `${key}:add`}
              disabled={!name.trim() || !amount.trim()}
              onClick={async () => {
                if (await act(`${key}:add`, { action: "add_extra", month: month.monthIndex, name, dollars: amount, at: at || null, note: why || null })) {
                  setAdding(false);
                  setName("");
                  setAmount("");
                  setAt("");
                  setWhy("");
                }
              }}
            >
              Add it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </Inset>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          + Add a payment made outside the portal
        </Button>
      )}

      {needsSpend && <Notice tone="warn">The ad spend couldn&apos;t be read for this month. Enter it above (type 0 if there was none) before sending.</Notice>}

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-400">
          {due > 0
            ? `Sending emails ${clientLabel} an invoice for ${usd(due)}, due in 7 days, and puts the client-by-client list in their portal.`
            : "Nothing is due for this month. Closing it sends no invoice; you can reopen it if a payment turns up."}
        </p>
        <Button
          size="sm"
          busy={busy === `${key}:send`}
          disabled={needsSpend}
          onClick={() => {
            const question = due > 0 ? `Send ${clientLabel} the performance pay invoice for ${month.label}: ${usd(due)}? This can't be changed afterwards.` : `Close ${month.label} with nothing due?`;
            if (window.confirm(question)) void act(`${key}:send`, { action: "send", month: month.monthIndex });
          }}
          className="shrink-0"
        >
          {due > 0 ? `Send invoice · ${usd(due)}` : "Close month · nothing due"}
        </Button>
      </div>
    </div>
  );
}

// ─── A paying client with no lead ──────────────────────────

function UncountedRow({
  payer,
  leadOptions,
  busy,
  act,
}: {
  payer: NonNullable<PerformanceView["uncounted"]>[number];
  leadOptions: NonNullable<PerformanceView["leadOptions"]>;
  busy: boolean;
  act: Act;
}) {
  const [linking, setLinking] = useState(false);
  const [leadId, setLeadId] = useState("");
  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{payer.name}</p>
          <p className="truncate text-[11px] text-neutral-400">
            {payer.company ? `${payer.company} · ` : ""}
            {payer.email} · first paid {day(payer.firstPaidAt)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-neutral-200" style={NUM_FONT}>
          {usd(payer.totalPaidCents)}
        </span>
        {!linking && leadOptions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setLinking(true)} className="shrink-0">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Link to a lead
          </Button>
        )}
      </div>
      {linking && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor={`lead-${payer.email}`}>
            The ad lead {payer.name} is
          </label>
          <select id={`lead-${payer.email}`} value={leadId} onChange={(e) => setLeadId(e.target.value)} className={`${FIELD} sm:flex-1`}>
            <option value="">Which ad lead is this?</option>
            {leadOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.email ? ` · ${l.email}` : ""} · {day(l.firstSeenAt)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              busy={busy}
              disabled={!leadId}
              onClick={async () => {
                if (await act(`rule:${payer.email}`, { action: "rule", email: payer.email, rule: "include", leadId, reason: "Same person, different email" })) setLinking(false);
              }}
            >
              Link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLinking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Term and non-renewal ──────────────────────────────────

function TermBox({ view, busy, act }: { view: PerformanceView; busy: string | null; act: Act }) {
  const term = view.term;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  if (!term || !view.terms) return null;
  const months = view.terms.termMonths;
  return (
    <Surface className="p-4">
      <p className="text-sm font-bold text-white">Term and renewal</p>
      {term.endsAt ? (
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-neutral-300">
            Notice of non-renewal received {day(term.noticeAt)}. {term.ended ? "The agreement ended" : "The agreement ends"} <b className="text-white">{day(term.endsAt)}</b>. Their last month still gets its
            statement after that; nothing is owed on money they collect later.
          </p>
          {!term.ended && (
            <Button
              size="sm"
              variant="secondary"
              busy={busy === "cancel:clear"}
              onClick={() => {
                if (window.confirm("Remove the notice? The agreement will renew again and autopay keeps running.")) void act("cancel:clear", { action: "clear_cancellation" });
              }}
            >
              Remove the notice
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-neutral-300">
            Signed {day(term.startsAt)}. Term {term.termNumber} runs to <b className="text-white">{day(term.currentEndsAt)}</b>, then renews for another {months} months. Written notice by{" "}
            <b className="text-white">{day(term.noticeDeadline)}</b> stops that renewal; later notice ends it a term later.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
            <Field label="Their notice arrived on">{(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} [color-scheme:dark]`} />}</Field>
            <Button
              size="sm"
              variant="danger"
              busy={busy === "cancel:record"}
              disabled={!date}
              onClick={() => {
                if (window.confirm(`Record their notice of non-renewal, received ${day(date)}? The portal works out the end date and stops their autopay then.`)) void act("cancel:record", { action: "record_cancellation", noticeDate: date });
              }}
            >
              Record a non-renewal notice
            </Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
