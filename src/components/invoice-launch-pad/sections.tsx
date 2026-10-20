"use client";

// ─── Invoice pay page sections (Launch Pad visual system) ──
// Presentational only — shared by the live pay page for invoices Nexli
// issues (/invoice/[token] → invoice-launch-pad-client.tsx) and the design
// preview (/invoice/preview). Dual pricing framing: the listed amount is the
// bank transfer (ACH) price; card payments are charged at the card price.

import { useState } from "react";
import { SETUP_SCOPE } from "@/lib/drs-pricing";
import {
  ACCENT,
  SYNE,
  CTA_CLASSES,
  SECONDARY_BTN,
  labelCls,
  Icon,
  PATHS,
  LpCard,
  IconChip,
  Pill,
  ShimmerCard,
} from "@/components/launch-pad";
import { NUM_FONT, READ_FONT } from "@/components/engagement-launch-pad/styles";
import { INVOICE_PATHS as P } from "./icons";
import { fmtDay, fmtLongDay, money } from "./format";
import type { BillingType, HeroStatus, InvoiceKind, InvoiceLine, PayMethod } from "./types";

const BILLING_PILL: Record<BillingType, { label: string; cls: string }> = {
  one_time: { label: "One-time", cls: "bg-white/5 text-neutral-300 border border-white/10" },
  monthly: { label: "Monthly", cls: ACCENT.blue.badgeDone },
  yearly: { label: "Yearly", cls: ACCENT.violet.badgeDone },
};

// ─── Card header ───────────────────────────────────────────

export function CardHeader({
  accent,
  icon,
  title,
  sub,
}: {
  accent: "blue" | "violet" | "emerald";
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <IconChip accent={accent}>
        <Icon d={icon} size={22} className={ACCENT[accent].icon} />
      </IconChip>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-white" style={SYNE}>
          {title}
        </h2>
        {sub && <p className="text-sm text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────

export function InvoiceHero({
  invoiceNumber,
  firstName,
  from,
  issued,
  due,
  billedTo,
  amountLabel,
  amountCents,
  currency,
  status,
}: {
  invoiceNumber: string;
  firstName: string;
  from: string;
  issued: Date;
  due: Date;
  billedTo: string | null;
  amountLabel: string;
  amountCents: number;
  currency?: string;
  status: HeroStatus;
}) {
  return (
    <section className="lp-card" style={{ animationDelay: "0.05s" }}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Invoice <span style={NUM_FONT}>{invoiceNumber}</span>
          </p>
          <h1
            className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1"
            style={SYNE}
          >
            {firstName ? (
              <>
                Hi{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                  {firstName}
                </span>
                , here&apos;s your invoice
              </>
            ) : (
              <>
                Here&apos;s your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                  invoice
                </span>
              </>
            )}
          </h1>
          <p className="text-sm mt-3 leading-relaxed text-neutral-300" style={READ_FONT}>
            From <span className="font-semibold text-white">{from}</span> · Issued{" "}
            <span style={NUM_FONT}>{fmtDay(issued)}</span> · Due{" "}
            <span style={NUM_FONT}>{fmtDay(due)}</span>
          </p>
          {billedTo && (
            <p className="text-xs mt-1 text-neutral-500" style={READ_FONT}>
              Billed to {billedTo}
            </p>
          )}
        </div>
        <div className="sm:text-right sm:shrink-0 min-w-0">
          <p className={labelCls}>{amountLabel}</p>
          <p className="text-4xl sm:text-5xl font-extrabold text-white leading-none" style={NUM_FONT}>
            {money(amountCents, currency)}
          </p>
          <div className="mt-3">
            {status.kind === "due" && <Pill tone="warn">Due {fmtDay(status.due)}</Pill>}
            {status.kind === "overdue" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <span style={NUM_FONT}>{status.days}</span>&nbsp;{status.days === 1 ? "day" : "days"} overdue
              </span>
            )}
            {status.kind === "processing" && <Pill tone="warn">Processing</Pill>}
            {status.kind === "paid" && (
              <Pill tone="done" accent="emerald">
                Paid {fmtDay(status.paidOn)} ✓
              </Pill>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Paid receipt ──────────────────────────────────────────

export function PaidReceipt({
  paidOn,
  amountCents,
  methodLabel,
  currency,
  action,
  footnote,
}: {
  paidOn: Date;
  amountCents: number;
  methodLabel: string;
  currency?: string;
  /** Optional button row (e.g. print / download receipt). */
  action?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <ShimmerCard className="lp-card">
      <div className="text-3xl mb-1">🎉</div>
      <h2 className="text-xl font-black text-white" style={SYNE}>
        Payment received — thank you
      </h2>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left sm:text-center">
        <ReceiptStat label="Paid on" value={fmtLongDay(paidOn)} />
        <ReceiptStat label="Amount" value={money(amountCents, currency)} />
        <ReceiptStat label="Method" value={methodLabel} words />
      </dl>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
      {footnote}
    </ShimmerCard>
  );
}

function ReceiptStat({ label, value, words }: { label: string; value: string; words?: boolean }) {
  return (
    <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/10">
      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</dt>
      <dd className="text-sm font-bold text-white mt-0.5" style={words ? READ_FONT : NUM_FONT}>
        {value}
      </dd>
    </div>
  );
}

/** Receipt action button (download / print). */
export function ReceiptButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${SECONDARY_BTN} inline-flex items-center justify-center gap-2 ${disabled ? "cursor-not-allowed" : ""}`}
    >
      <Icon d={P.download} size={15} /> {children}
    </button>
  );
}

// ─── What this covers ──────────────────────────────────────

export function CoversCard({
  items,
  currency,
  showScope,
  split,
}: {
  items: InvoiceLine[];
  currency?: string;
  /** Show the "Included in your setup" accordion (setup / annual invoices). */
  showScope: boolean;
  /** Monthly invoices: platform vs ad-budget split tiles. */
  split?: { platformCents: number; adCents: number } | null;
}) {
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <LpCard className="lp-card" style={{ animationDelay: "0.1s" }}>
      <CardHeader accent="blue" icon={P.list} title="What this covers" />
      <ul className="mt-5 divide-y divide-white/10">
        {items.map((item, i) => {
          const pill = BILLING_PILL[item.billingType] ?? BILLING_PILL.one_time;
          return (
            <li
              key={`${i}-${item.description}`}
              className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug [overflow-wrap:anywhere]" style={READ_FONT}>
                  {item.description}
                </p>
                <span className={`inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${pill.cls}`}>
                  {pill.label}
                </span>
              </div>
              <p className="text-base font-bold text-white sm:text-right shrink-0" style={NUM_FONT}>
                {money(item.amountCents, currency)}
              </p>
            </li>
          );
        })}
      </ul>

      {split && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SplitTile
            accent="blue"
            label="Platform upkeep"
            amount={money(split.platformCents, currency)}
            sub="Hosting, maintenance, ad management, support, reporting, AI usage"
          />
          <SplitTile
            accent="emerald"
            label="Ad budget"
            amount={money(split.adCents, currency)}
            sub="Pass-through, no markup — deployed on your ad accounts"
          />
        </div>
      )}

      {showScope && (
        <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/10">
          <button
            type="button"
            onClick={() => setScopeOpen((o) => !o)}
            aria-expanded={scopeOpen}
            aria-controls="setup-scope"
            className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-white">Included in your setup</span>
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              <span style={NUM_FONT}>{SETUP_SCOPE.reduce((n, g) => n + g.items.length, 0)}</span> items
              <Icon
                d={P.chevronDown}
                size={16}
                className={`transition-transform ${scopeOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {scopeOpen && (
            <div id="setup-scope" className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SETUP_SCOPE.map((g) => (
                <div key={g.title}>
                  <p className={labelCls}>{g.title}</p>
                  <ul className="space-y-1">
                    {g.items.map((it) => (
                      <li key={it.name} className="flex items-start gap-2 text-xs text-neutral-300" style={READ_FONT}>
                        <Icon d={PATHS.check} size={13} className="text-cyan-400 mt-0.5 shrink-0" />
                        {it.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </LpCard>
  );
}

function SplitTile({
  accent,
  label,
  amount,
  sub,
}: {
  accent: "blue" | "emerald";
  label: string;
  amount: string;
  sub: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${ACCENT[accent].noteStrip}`}>
      <p className={labelCls}>{label}</p>
      <p className="text-2xl font-extrabold text-white" style={NUM_FONT}>
        {amount}
        <span className="text-xs font-semibold text-neutral-400">/mo</span>
      </p>
      <p className="text-[11px] text-neutral-400 mt-1" style={READ_FONT}>
        {sub}
      </p>
    </div>
  );
}

// ─── Totals ────────────────────────────────────────────────

export function TotalsCard({
  subtotalCents,
  taxCents,
  totalCents,
  amountPaidCents,
  balanceCents,
  paid,
  currency,
}: {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  paid: boolean;
  currency?: string;
}) {
  return (
    <LpCard className="lp-card" style={{ animationDelay: "0.15s" }}>
      <CardHeader accent="violet" icon={P.calculator} title="Totals" />
      <dl className="mt-5 space-y-2 text-sm" style={READ_FONT}>
        <TotalRow label="Subtotal" value={money(subtotalCents, currency)} />
        <TotalRow label="Tax" value={money(taxCents, currency)} />
        <TotalRow label="Total" value={money(totalCents, currency)} strong />
        <TotalRow label="Amount paid" value={money(amountPaidCents, currency)} />
      </dl>
      <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className={labelCls}>Balance due</p>
          <p className="text-[11px] text-neutral-500">Bank transfer (ACH) price</p>
        </div>
        <p className={`text-3xl font-extrabold ${paid ? "text-emerald-300" : "text-white"}`} style={NUM_FONT}>
          {money(balanceCents, currency)}
        </p>
      </div>
    </LpCard>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={`min-w-0 ${strong ? "font-semibold text-white" : "text-neutral-400"}`}>{label}</dt>
      <dd className={strong ? "font-bold text-white" : "text-neutral-300"} style={NUM_FONT}>
        {value}
      </dd>
    </div>
  );
}

// ─── Pay ───────────────────────────────────────────────────

export function PayCard({
  achCents,
  cardCents,
  achOnly,
  autopay,
  currency,
  paying,
  onPay,
  children,
}: {
  /** Bank transfer (ACH) price — the balance, or the monthly ACH amount for autopay. */
  achCents: number;
  /** Card price — cardPriceCents(balance), or the monthly card amount for autopay. */
  cardCents: number;
  achOnly: boolean;
  /** Autopay-eligible: amounts are per month and paying turns on autopay. */
  autopay: boolean;
  currency?: string;
  paying: PayMethod | null;
  onPay: (method: PayMethod) => void;
  /** Inline notices / errors, rendered under the tiles. */
  children?: React.ReactNode;
}) {
  const savings = cardCents - achCents;
  const perMo = autopay ? "/mo" : "";
  const busy = paying !== null;

  return (
    <LpCard className="lp-card" style={{ animationDelay: "0.2s" }}>
      <CardHeader
        accent="emerald"
        icon={autopay ? P.repeat : PATHS.lock}
        title={autopay ? "Start your monthly service" : "Pay this invoice"}
        sub={
          autopay
            ? "Pay today and you're set: we'll charge the same method automatically each month — no invoice to chase."
            : achOnly
              ? "Bank transfer (ACH) or wire only."
              : "Choose how you'd like to pay."
        }
      />
      <div className={`mt-5 grid grid-cols-1 gap-3 ${achOnly ? "" : "sm:grid-cols-2"}`}>
        {/* Bank transfer */}
        <div className="rounded-xl p-4 sm:p-5 bg-emerald-500/[0.06] border border-emerald-500/30 flex flex-col">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <Icon d={P.bank} size={18} className="text-emerald-400 shrink-0" />
            <p className="text-sm font-bold text-white flex-auto sm:flex-1 min-w-0">Bank transfer (ACH)</p>
            {!achOnly && savings > 0 && (
              <Pill tone="done" accent="emerald">
                Save&nbsp;<span style={NUM_FONT}>{money(savings, currency)}{perMo}</span>&nbsp;vs card
              </Pill>
            )}
          </div>
          <p className="text-3xl font-extrabold text-white mt-3" style={NUM_FONT}>
            {money(achCents, currency)}
            {autopay && <span className="text-sm font-semibold text-neutral-400">/mo</span>}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {autopay ? "by bank transfer · autopay" : "Bank transfer (ACH) price"}
          </p>
          <button
            type="button"
            onClick={() => onPay("ach")}
            disabled={busy}
            className={`${CTA_CLASSES} mt-4 w-full`}
          >
            {paying === "ach" ? (
              "Opening secure checkout…"
            ) : autopay ? (
              "Pay & turn on autopay"
            ) : (
              // One inline run: CTA_CLASSES is a flex row, so bare text +
              // <span> siblings would become separate flex items and wrap
              // as three columns on phones.
              <span>
                Pay <span style={NUM_FONT}>{money(achCents, currency)}</span> by bank transfer
              </span>
            )}
          </button>
        </div>

        {/* Card */}
        {!achOnly && (
          <div className="rounded-xl p-4 sm:p-5 bg-white/[0.03] border border-white/10 flex flex-col">
            <div className="flex items-center gap-2">
              <Icon d={P.card} size={18} className="text-neutral-300 shrink-0" />
              <p className="text-sm font-bold text-white flex-1">Credit / debit card</p>
            </div>
            <p className="text-3xl font-extrabold text-white mt-3" style={NUM_FONT}>
              {money(cardCents, currency)}
              {autopay && <span className="text-sm font-semibold text-neutral-400">/mo</span>}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{autopay ? "by card · autopay" : "Card price"}</p>
            <button
              type="button"
              onClick={() => onPay("card")}
              disabled={busy}
              className={`${SECONDARY_BTN} mt-4 w-full`}
            >
              {paying === "card" ? (
                "Opening secure checkout…"
              ) : autopay ? (
                "Pay & turn on autopay"
              ) : (
                <>
                  Pay <span style={NUM_FONT}>{money(cardCents, currency)}</span> by card
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {achOnly && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-neutral-400" style={READ_FONT}>
            Card payments are not accepted on this invoice. Work is scheduled once funds clear.
          </p>
          <p className="text-xs text-neutral-500" style={READ_FONT}>
            Wire instructions available on request.
          </p>
        </div>
      )}

      {children}

      <div className="mt-4 space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <Icon d={PATHS.lock} size={13} className="text-emerald-400 shrink-0" />
          Secure checkout by Stripe
        </p>
        {autopay && (
          <p className="text-[11px] text-neutral-500" style={READ_FONT}>
            Autopay uses the method you choose today. To change card or bank details later, use Manage
            autopay. Your initial term and cancellation terms are in your agreement.
          </p>
        )}
        {!achOnly && (
          <p className="text-[11px] text-neutral-500" style={READ_FONT}>
            Amounts shown are the bank transfer (ACH) price; card payments are charged at the card price.
          </p>
        )}
      </div>
    </LpCard>
  );
}

// ─── Inline note (pay errors, canceled checkout, previews) ─

export function InlineNote({
  tone,
  children,
}: {
  tone: "amber" | "error" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-400/10 border-amber-400/30"
      : tone === "error"
        ? "bg-rose-500/10 border-rose-500/30"
        : "bg-white/[0.04] border-white/10";
  const iconCls = tone === "amber" ? "text-amber-300" : tone === "error" ? "text-rose-300" : "text-neutral-400";
  const textCls = tone === "amber" ? "text-amber-200" : tone === "error" ? "text-rose-200" : "text-neutral-300";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 border ${cls}`}
    >
      <Icon d={P.info} size={16} className={`${iconCls} shrink-0 mt-0.5`} />
      <p className={`text-xs font-semibold min-w-0 [overflow-wrap:anywhere] ${textCls}`}>{children}</p>
    </div>
  );
}

// ─── Bank transfer processing ──────────────────────────────

export function AchPendingCard() {
  return (
    <div
      className="lp-card rounded-2xl p-5 sm:p-6 bg-amber-400/10 border border-amber-400/30 flex items-start gap-3"
      style={{ animationDelay: "0.2s" }}
      role="status"
    >
      <Icon d={P.clock} size={22} className="text-amber-300 shrink-0 mt-0.5" />
      <div>
        <h2 className="text-base sm:text-lg font-bold text-amber-100" style={SYNE}>
          Bank transfer processing
        </h2>
        <p className="text-sm text-amber-200/90 mt-1" style={READ_FONT}>
          Bank transfer processing — this usually takes 3–5 business days. We&apos;ll email your receipt when it
          clears.
        </p>
      </div>
    </div>
  );
}

// ─── Autopay on ────────────────────────────────────────────

export function AutopayOnCard({
  method,
  nextChargeDate,
  unpaid,
  managing,
  onManage,
  children,
}: {
  method: PayMethod | null;
  nextChargeDate: Date | null;
  /** This invoice is still open — it will be charged automatically. */
  unpaid?: boolean;
  managing: boolean;
  onManage: () => void;
  /** Inline error, if Manage autopay failed. */
  children?: React.ReactNode;
}) {
  const methodLabel = method === "card" ? "Card" : method === "ach" ? "Bank transfer" : null;
  return (
    <div
      className={`lp-card rounded-2xl p-5 sm:p-6 ${ACCENT.emerald.successStrip}`}
      style={{ animationDelay: "0.2s" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <IconChip accent="emerald" float={false}>
            <Icon d={P.repeat} size={22} className={ACCENT.emerald.icon} />
          </IconChip>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white" style={SYNE}>
              Autopay is on
              {methodLabel && <> · {methodLabel}</>}
              {nextChargeDate && (
                <>
                  {" "}
                  · next charge <span style={NUM_FONT}>{fmtDay(nextChargeDate)}</span>
                </>
              )}
            </h2>
            <p className="text-sm text-emerald-100/80 mt-0.5" style={READ_FONT}>
              {unpaid
                ? "This invoice is charged automatically — nothing for you to do."
                : "We charge the same method automatically each month — no invoice to chase."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onManage}
          disabled={managing}
          className={`${SECONDARY_BTN} w-full sm:w-auto shrink-0`}
        >
          {managing ? "Opening…" : "Manage autopay"}
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── What happens next ─────────────────────────────────────

function nextSteps(kind: InvoiceKind, autopay: boolean): string[] {
  switch (kind) {
    case "setup":
    case "annual":
      return ["Pay this invoice", "Your Launch Pad opens", "We start your build"];
    case "monthly":
      return [
        autopay ? "Pay & turn on autopay" : "Pay this invoice",
        "Ads and services go live",
        autopay ? "Autopay handles each month" : "Weekly updates from your team",
      ];
    case "ad_budget":
      return [
        autopay ? "Pay & turn on autopay" : "Pay this invoice",
        "Your ads go live",
        autopay ? "Autopay handles each month" : "Weekly updates from your team",
      ];
    case "renewal":
      return ["Pay this invoice", "Your platform continues for another year", "Same team, same weekly updates"];
    case "enterprise":
      return ["Wire / ACH", "Funds clear", "Kickoff week scheduled"];
    default:
      return ["Pay this invoice", "Receipt emailed to you", "Your Nexli team takes it from there"];
  }
}

export function NextSteps({
  kind,
  paid,
  autopay = false,
}: {
  kind: InvoiceKind;
  /** Marks step one done. */
  paid: boolean;
  autopay?: boolean;
}) {
  return (
    <section className="lp-card" style={{ animationDelay: "0.25s" }} aria-labelledby="next-heading">
      <p id="next-heading" className={labelCls}>
        What happens next
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {nextSteps(kind, autopay).map((step, i) => {
          const done = paid && i === 0;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                done ? ACCENT.emerald.successStrip : "bg-white/[0.03] border-white/10"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white" : "bg-white/10 text-neutral-300"
                }`}
                style={NUM_FONT}
              >
                {done ? <Icon d={PATHS.check} size={14} /> : i + 1}
              </span>
              <span className="text-sm font-semibold text-white" style={READ_FONT}>
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── Notes / terms ─────────────────────────────────────────

export function NotesCard({ notes, terms }: { notes?: string | null; terms?: string | null }) {
  if (!notes && !terms) return null;
  return (
    <div
      className="lp-card rounded-2xl p-5 sm:p-6 bg-white/[0.02] border border-white/5"
      style={{ animationDelay: "0.3s" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon d={P.fileText} size={15} className="text-neutral-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Notes &amp; terms</p>
      </div>
      {notes && (
        <p className="text-xs leading-relaxed text-neutral-400 whitespace-pre-line [overflow-wrap:anywhere]" style={READ_FONT}>
          {notes}
        </p>
      )}
      {terms && (
        <p className={`text-xs leading-relaxed text-neutral-500 whitespace-pre-line [overflow-wrap:anywhere] ${notes ? "mt-2" : ""}`} style={READ_FONT}>
          <span className="font-semibold text-neutral-400">Terms:</span> {terms}
        </p>
      )}
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────

export function InvoiceFooter() {
  return (
    <footer className="text-center pb-6 space-y-2">
      <p className="text-[11px] text-neutral-500">
        Questions about this invoice? Your Nexli team is one message away.
      </p>
      <p className="text-[10px] text-neutral-600">Nexli Automation LLC • Powered by the Digital Rainmaker System</p>
    </footer>
  );
}

/** Shell badge icon. */
export function InvoiceBadgeIcon() {
  return <Icon d={P.receipt} size={14} className="text-cyan-400" />;
}
