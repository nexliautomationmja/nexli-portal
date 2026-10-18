"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DRS_PRICING,
  SETUP_SCOPE,
  cardPriceCents,
} from "@/lib/drs-pricing";
import { ENTERPRISE_TIERS } from "@/lib/enterprise-pricing";
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
  LaunchPadShell,
  useForceDark,
} from "@/components/launch-pad";
import { NUM_FONT, READ_FONT } from "@/components/engagement-launch-pad/styles";

// ══════════════════════════════════════════════════════════
// /invoice/preview — DESIGN PREVIEW of the client invoice / pay page on the
// Launch Pad visual system. Nothing is fetched, charged or saved: the pay
// buttons only show an inline preview message. The live page is
// /invoice/[token] (invoice-client.tsx) and is untouched.
// Dual pricing framing is kept exactly: the listed amount is the bank
// transfer (ACH) price; card payments are charged at the card price.
// ══════════════════════════════════════════════════════════

// ─── Local icon paths (lucide) ─────────────────────────────
const P = {
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  calculator: (
    <>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
    </>
  ),
  bank: (
    <>
      <path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
      <path d="m12 2 8 5H4Z" />
    </>
  ),
  card: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
};

// ─── Sample data ───────────────────────────────────────────

type SampleKind = "setup" | "annual" | "monthly" | "enterprise";
type Status = "due" | "overdue" | "paid";
type BillingType = "one_time" | "monthly" | "yearly";

interface LineItem {
  description: string;
  billingType: BillingType;
  amountCents: number;
}

interface Sample {
  label: string;
  number: string;
  items: LineItem[];
  achOnly: boolean;
  notes: string;
  terms: string;
}

const FROM = "Nexli Automation LLC";
const CLIENT_FIRST = "James";
const CLIENT_NAME = "James Snack";
const CLIENT_FIRM = "Snack CPA, LLC";

const ENTERPRISE_CORE = ENTERPRISE_TIERS.core;

const SAMPLES: Record<SampleKind, Sample> = {
  setup: {
    label: "Setup Fee",
    number: "INV-2026-0142",
    items: [
      {
        description: "Digital Rainmaker System — Setup Fee (Phase 1 Implementation)",
        billingType: "one_time",
        amountCents: DRS_PRICING.SETUP_FEE_CENTS,
      },
    ],
    achOnly: false,
    notes:
      "One-time Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System, as itemized in Section 1 of your engagement letter. Due at signing; onboarding opens once it is paid. Non-refundable once work begins.",
    terms: "Due on receipt.",
  },
  annual: {
    label: "Annual up-front",
    number: "INV-2026-0143",
    items: [
      {
        description: "Digital Rainmaker System — Setup Fee (Phase 1 Implementation)",
        billingType: "one_time",
        amountCents: DRS_PRICING.SETUP_FEE_CENTS,
      },
      {
        description: "Annual Platform (12 months, paid in full)",
        billingType: "yearly",
        amountCents: DRS_PRICING.ANNUAL_CENTS,
      },
    ],
    achOnly: false,
    notes:
      "Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System, as itemized in Section 1 of your engagement letter, plus the annual platform investment for your first 12 months, paid in full. Due at signing; onboarding opens once it is paid. The Managed Advertising Budget is billed monthly once your build is complete.",
    terms: "Due on receipt.",
  },
  monthly: {
    label: "Monthly",
    number: "INV-2026-0144",
    items: [
      {
        description: "Monthly Platform",
        billingType: "monthly",
        amountCents: DRS_PRICING.MONTHLY_CENTS,
      },
      {
        description: "Managed Advertising Budget — deployed on your ad accounts, pass-through",
        billingType: "monthly",
        amountCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
      },
    ],
    achOnly: false,
    notes:
      "Monthly investment for the Digital Rainmaker System: platform upkeep (hosting, maintenance, ad management, support, reporting, AI usage) + Managed Advertising Budget deployed on your behalf at no markup. Your build is complete; services and ads start once this invoice is paid. Billed automatically each month.",
    terms: "Due on receipt. Billed automatically each month.",
  },
  enterprise: {
    label: "Enterprise (ACH only)",
    number: "INV-2026-0145",
    items: [
      {
        description: `Nexli Enterprise License — ${ENTERPRISE_CORE.label} (6-month implementation + 12-month license)`,
        billingType: "one_time",
        amountCents: ENTERPRISE_CORE.priceCents,
      },
    ],
    achOnly: true,
    notes:
      "Nexli Enterprise License, paid 100% up front by bank transfer (ACH) or wire. Implementation is scheduled once funds clear.",
    terms: "Due on receipt. Bank transfer (ACH) or wire only.",
  },
};

const SAMPLE_ORDER: SampleKind[] = ["setup", "annual", "monthly", "enterprise"];
const STATUS_ORDER: Status[] = ["due", "overdue", "paid"];
const STATUS_LABEL: Record<Status, string> = { due: "Due", overdue: "Overdue", paid: "Paid" };

const NEXT_STEPS: Record<SampleKind, string[]> = {
  setup: ["Pay this invoice", "Your Launch Pad opens", "We start your build"],
  annual: ["Pay this invoice", "Your Launch Pad opens", "We start your build"],
  monthly: ["Pay", "Ads and services go live", "Weekly updates from your team"],
  enterprise: ["Wire / ACH", "Funds clear", "Kickoff week scheduled"],
};

const BILLING_PILL: Record<BillingType, { label: string; cls: string }> = {
  one_time: { label: "One-time", cls: "bg-white/5 text-neutral-300 border border-white/10" },
  monthly: { label: "Monthly", cls: ACCENT.blue.badgeDone },
  yearly: { label: "Yearly", cls: ACCENT.violet.badgeDone },
};

// ─── Helpers ───────────────────────────────────────────────

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const DAY_MS = 86_400_000;

// "Today" is read on the client only (server snapshot = null) so server-
// rendered dates can't disagree with the viewer's timezone on hydration.
let cachedToday: Date | null = null;
const noopSubscribe = () => () => {};
function getToday(): Date {
  if (!cachedToday) cachedToday = new Date();
  return cachedToday;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Page ──────────────────────────────────────────────────

export function InvoicePreviewClient() {
  // No /invoice/layout.tsx today, but force dark the same way the engagement
  // preview does in case a light-mode layout is added later.
  useForceDark();
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add("dark"));
    return () => cancelAnimationFrame(id);
  }, []);

  const [kind, setKind] = useState<SampleKind>("annual");
  const [status, setStatus] = useState<Status>("due");
  const [burst, setBurst] = useState(0);
  const [payClicked, setPayClicked] = useState<"ach" | "card" | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const clientToday = useSyncExternalStore(noopSubscribe, getToday, () => null);
  // Before hydration, fall back to a fixed date; it is replaced on mount.
  const today = clientToday ?? new Date(Date.UTC(2026, 9, 18, 12));

  const sample = SAMPLES[kind];
  const total = useMemo(() => sample.items.reduce((s, i) => s + i.amountCents, 0), [sample]);
  const paid = status === "paid";
  const amountPaid = paid ? total : 0;
  const balance = total - amountPaid;
  const achPrice = paid ? total : balance;
  const cardPrice = cardPriceCents(achPrice);
  const savings = cardPrice - achPrice;

  // Dates relative to today: Due → issued/due today; Overdue → issued 23
  // days ago, due 9 days ago; Paid → issued 2 days ago, paid today.
  const OVERDUE_DAYS = 9;
  const issued =
    status === "overdue"
      ? new Date(today.getTime() - 23 * DAY_MS)
      : status === "paid"
        ? new Date(today.getTime() - 2 * DAY_MS)
        : today;
  const due = status === "overdue" ? new Date(today.getTime() - OVERDUE_DAYS * DAY_MS) : issued;
  const paidOn = today;

  function pickStatus(s: Status) {
    if (s === "paid" && status !== "paid") setBurst((b) => b + 1);
    setStatus(s);
    setPayClicked(null);
  }

  function pickKind(k: SampleKind) {
    setKind(k);
    setPayClicked(null);
    setScopeOpen(false);
  }

  const badgeIcon = <Icon d={P.receipt} size={14} className="text-cyan-400" />;
  const showScope = kind === "setup" || kind === "annual";

  return (
    <LaunchPadShell maxWidth="3xl" badge="Invoice" badgeIcon={badgeIcon} burst={burst}>
      {/* ─── Preview controls ─── */}
      <div className="lp-card space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Design preview — nothing here is charged or saved
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <Segmented
            label="Sample invoice"
            options={SAMPLE_ORDER.map((k) => ({ value: k, label: SAMPLES[k].label }))}
            value={kind}
            onChange={pickKind}
          />
          <Segmented
            label="Invoice status"
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            value={status}
            onChange={pickStatus}
          />
        </div>
      </div>

      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Invoice <span style={NUM_FONT}>{sample.number}</span>
            </p>
            <h1
              className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1"
              style={SYNE}
            >
              Hi{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                {CLIENT_FIRST}
              </span>
              , here&apos;s your invoice
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-neutral-300" style={READ_FONT}>
              From <span className="font-semibold text-white">{FROM}</span> · Issued{" "}
              <span style={NUM_FONT}>{fmtDay(issued)}</span> · Due{" "}
              <span style={NUM_FONT}>{fmtDay(due)}</span>
            </p>
            <p className="text-xs mt-1 text-neutral-500" style={READ_FONT}>
              Billed to {CLIENT_NAME}, {CLIENT_FIRM}
            </p>
          </div>
          <div className="sm:text-right shrink-0">
            <p className={labelCls}>{paid ? "Amount paid" : "Amount due"}</p>
            <p className="text-4xl sm:text-5xl font-extrabold text-white leading-none" style={NUM_FONT}>
              {money(paid ? total : balance)}
            </p>
            <div className="mt-3">
              {status === "due" && <Pill tone="warn">Due {fmtDay(due)}</Pill>}
              {status === "overdue" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <span style={NUM_FONT}>{OVERDUE_DAYS}</span>&nbsp;days overdue
                </span>
              )}
              {paid && (
                <Pill tone="done" accent="emerald">
                  Paid {fmtDay(paidOn)} ✓
                </Pill>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Paid receipt ─── */}
      {paid && (
        <ShimmerCard className="lp-card">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-xl font-black text-white" style={SYNE}>
            Payment received — thank you
          </h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left sm:text-center">
            <ReceiptStat label="Paid on" value={today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
            <ReceiptStat label="Amount" value={money(total)} />
            <ReceiptStat label="Method" value="Bank transfer (ACH)" words />
          </dl>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled
              title="Available on the real page"
              className={`${SECONDARY_BTN} inline-flex items-center justify-center gap-2 cursor-not-allowed`}
            >
              <Icon d={P.download} size={15} /> Download receipt
            </button>
          </div>
          <p className="text-[11px] mt-3 text-amber-300/80">(Preview — nothing was charged)</p>
        </ShimmerCard>
      )}

      {/* ─── What this covers ─── */}
      <LpCard className="lp-card" style={{ animationDelay: "0.1s" }}>
        <CardHeader accent="blue" icon={P.list} title="What this covers" />
        <ul className="mt-5 divide-y divide-white/10">
          {sample.items.map((item) => {
            const pill = BILLING_PILL[item.billingType];
            return (
              <li key={item.description} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug" style={READ_FONT}>
                    {item.description}
                  </p>
                  <span className={`inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${pill.cls}`}>
                    {pill.label}
                  </span>
                </div>
                <p className="text-base font-bold text-white sm:text-right shrink-0" style={NUM_FONT}>
                  {money(item.amountCents)}
                </p>
              </li>
            );
          })}
        </ul>

        {kind === "monthly" && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SplitTile
              accent="blue"
              label="Platform upkeep"
              amount={money(DRS_PRICING.MONTHLY_CENTS)}
              sub="Hosting, maintenance, ad management, support, reporting, AI usage"
            />
            <SplitTile
              accent="emerald"
              label="Ad budget"
              amount={money(DRS_PRICING.AD_SPEND_MONTHLY_CENTS)}
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
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
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

      {/* ─── Totals ─── */}
      <LpCard className="lp-card" style={{ animationDelay: "0.15s" }}>
        <CardHeader accent="violet" icon={P.calculator} title="Totals" />
        <dl className="mt-5 space-y-2 text-sm" style={READ_FONT}>
          <TotalRow label="Subtotal" value={money(total)} />
          <TotalRow label="Tax" value={money(0)} />
          <TotalRow label="Total" value={money(total)} strong />
          <TotalRow label="Amount paid" value={money(amountPaid)} />
        </dl>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-end justify-between gap-4">
          <div>
            <p className={labelCls}>Balance due</p>
            <p className="text-[11px] text-neutral-500">Bank transfer (ACH) price</p>
          </div>
          <p className={`text-3xl font-extrabold ${paid ? "text-emerald-300" : "text-white"}`} style={NUM_FONT}>
            {money(balance)}
          </p>
        </div>
      </LpCard>

      {/* ─── Pay ─── */}
      {!paid && (
        <LpCard className="lp-card" style={{ animationDelay: "0.2s" }}>
          <CardHeader
            accent="emerald"
            icon={PATHS.lock}
            title="Pay this invoice"
            sub={sample.achOnly ? "Bank transfer (ACH) or wire only." : "Choose how you'd like to pay."}
          />
          <div className={`mt-5 grid grid-cols-1 gap-3 ${sample.achOnly ? "" : "sm:grid-cols-2"}`}>
            {/* Bank transfer */}
            <div className="rounded-xl p-4 sm:p-5 bg-emerald-500/[0.06] border border-emerald-500/30 flex flex-col">
              <div className="flex items-center gap-2">
                <Icon d={P.bank} size={18} className="text-emerald-400 shrink-0" />
                <p className="text-sm font-bold text-white flex-1">Bank transfer (ACH)</p>
                {!sample.achOnly && (
                  <Pill tone="done" accent="emerald">
                    Save&nbsp;<span style={NUM_FONT}>{money(savings)}</span>&nbsp;vs card
                  </Pill>
                )}
              </div>
              <p className="text-3xl font-extrabold text-white mt-3" style={NUM_FONT}>
                {money(achPrice)}
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Bank transfer (ACH) price</p>
              <button
                type="button"
                onClick={() => setPayClicked("ach")}
                className={`${CTA_CLASSES} mt-4 w-full`}
              >
                Pay <span style={NUM_FONT}>{money(achPrice)}</span> by bank transfer
              </button>
            </div>

            {/* Card */}
            {!sample.achOnly && (
              <div className="rounded-xl p-4 sm:p-5 bg-white/[0.03] border border-white/10 flex flex-col">
                <div className="flex items-center gap-2">
                  <Icon d={P.card} size={18} className="text-neutral-300 shrink-0" />
                  <p className="text-sm font-bold text-white flex-1">Credit / debit card</p>
                </div>
                <p className="text-3xl font-extrabold text-white mt-3" style={NUM_FONT}>
                  {money(cardPrice)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">Card price</p>
                <button
                  type="button"
                  onClick={() => setPayClicked("card")}
                  className={`${SECONDARY_BTN} mt-4 w-full`}
                >
                  Pay <span style={NUM_FONT}>{money(cardPrice)}</span> by card
                </button>
              </div>
            )}
          </div>

          {sample.achOnly && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-neutral-400" style={READ_FONT}>
                Card payments are not accepted on this invoice. Work is scheduled once funds clear.
              </p>
              <p className="text-xs text-neutral-500" style={READ_FONT}>
                Wire instructions available on request.
              </p>
            </div>
          )}

          {payClicked && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 bg-amber-400/10 border border-amber-400/30"
            >
              <Icon d={P.info} size={16} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-200">
                Preview — in the live page this opens secure Stripe checkout (
                {payClicked === "ach" ? "bank transfer" : "card"},{" "}
                <span style={NUM_FONT}>{money(payClicked === "ach" ? achPrice : cardPrice)}</span>).
              </p>
            </div>
          )}

          <div className="mt-4 space-y-1">
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Icon d={PATHS.lock} size={13} className="text-emerald-400 shrink-0" />
              Secure checkout by Stripe
            </p>
            {!sample.achOnly && (
              <p className="text-[11px] text-neutral-500" style={READ_FONT}>
                Amounts shown are the bank transfer (ACH) price; card payments are charged at the card price.
              </p>
            )}
          </div>
        </LpCard>
      )}

      {/* ─── What happens next ─── */}
      <section className="lp-card" style={{ animationDelay: "0.25s" }} aria-labelledby="next-heading">
        <p id="next-heading" className={labelCls}>
          What happens next
        </p>
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {NEXT_STEPS[kind].map((step, i) => {
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

      {/* ─── Notes / terms ─── */}
      <div className="lp-card rounded-2xl p-5 sm:p-6 bg-white/[0.02] border border-white/5" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon d={P.fileText} size={15} className="text-neutral-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Notes &amp; terms</p>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400" style={READ_FONT}>
          {sample.notes}
        </p>
        <p className="text-xs leading-relaxed text-neutral-500 mt-2" style={READ_FONT}>
          <span className="font-semibold text-neutral-400">Terms:</span> {sample.terms}
        </p>
      </div>

      <footer className="text-center pb-6 space-y-2">
        <p className="text-[11px] text-neutral-500">
          Questions about this invoice? Your Nexli team is one message away.
        </p>
        <p className="text-[10px] text-neutral-600">
          Nexli Automation LLC • Powered by the Digital Rainmaker System
        </p>
      </footer>
    </LaunchPadShell>
  );
}

// ─── Pieces ────────────────────────────────────────────────

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap self-start rounded-2xl sm:rounded-full p-1 gap-0.5 bg-white/5 border border-white/10"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            value === o.value ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-neutral-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CardHeader({
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

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-semibold text-white" : "text-neutral-400"}>{label}</dt>
      <dd className={strong ? "font-bold text-white" : "text-neutral-300"} style={NUM_FONT}>
        {value}
      </dd>
    </div>
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
