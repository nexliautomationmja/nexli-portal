"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DRS_PRICING, cardPriceCents } from "@/lib/drs-pricing";
import { ENTERPRISE_TIERS } from "@/lib/enterprise-pricing";
import { LaunchPadShell, useForceDark } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import {
  InvoiceHero,
  PaidReceipt,
  ReceiptButton,
  CoversCard,
  TotalsCard,
  PayCard,
  InlineNote,
  AutopayOnCard,
  NextSteps,
  NotesCard,
  InvoiceFooter,
  InvoiceBadgeIcon,
  DAY_MS,
  money,
  monthlySplit,
  type HeroStatus,
  type InvoiceLine,
  type PayMethod,
} from "@/components/invoice-launch-pad";

// ══════════════════════════════════════════════════════════
// /invoice/preview — DESIGN PREVIEW of the Launch Pad invoice / pay page.
// Nothing is fetched, charged or saved: the pay buttons only show an inline
// preview message. The live page for invoices Nexli issues is
// /invoice/[token] → invoice-launch-pad-client.tsx, built on the same
// sections (@/components/invoice-launch-pad).
// Dual pricing framing is kept exactly: the listed amount is the bank
// transfer (ACH) price; card payments are charged at the card price.
// ══════════════════════════════════════════════════════════

// ─── Sample data ───────────────────────────────────────────

type SampleKind = "setup" | "annual" | "monthly" | "enterprise";
type Status = "due" | "overdue" | "paid" | "autopay";

interface Sample {
  label: string;
  number: string;
  items: InvoiceLine[];
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
    achOnly: true, // setup invoices: bank transfer / wire only
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
    achOnly: true, // setup invoices: bank transfer / wire only
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
const STATUS_ORDER: Status[] = ["due", "overdue", "paid", "autopay"];
const STATUS_LABEL: Record<Status, string> = {
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
  autopay: "Autopay on",
};

// ─── Helpers ───────────────────────────────────────────────

// "Today" is read on the client only (server snapshot = null) so server-
// rendered dates can't disagree with the viewer's timezone on hydration.
let cachedToday: Date | null = null;
const noopSubscribe = () => () => {};
function getToday(): Date {
  if (!cachedToday) cachedToday = new Date();
  return cachedToday;
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
  const [payClicked, setPayClicked] = useState<PayMethod | null>(null);
  const [manageClicked, setManageClicked] = useState(false);
  const clientToday = useSyncExternalStore(noopSubscribe, getToday, () => null);
  // Before hydration, fall back to a fixed date; it is replaced on mount.
  const today = clientToday ?? new Date(Date.UTC(2026, 9, 18, 12));

  const sample = SAMPLES[kind];
  const total = useMemo(() => sample.items.reduce((s, i) => s + i.amountCents, 0), [sample]);
  // "Autopay on" (Monthly only) = this month's invoice paid, autopay active.
  const autopayOn = status === "autopay";
  const paid = status === "paid" || autopayOn;
  const amountPaid = paid ? total : 0;
  const balance = total - amountPaid;
  const achPrice = paid ? total : balance;
  const cardPrice = cardPriceCents(achPrice);
  // The Monthly sample is autopay-eligible: its pay card starts autopay.
  const autopayEligible = kind === "monthly";

  // Dates relative to today: Due → issued/due today; Overdue → issued 23
  // days ago, due 9 days ago; Paid → issued 2 days ago, paid today.
  const OVERDUE_DAYS = 9;
  const issued =
    status === "overdue"
      ? new Date(today.getTime() - 23 * DAY_MS)
      : paid
        ? new Date(today.getTime() - 2 * DAY_MS)
        : today;
  const due = status === "overdue" ? new Date(today.getTime() - OVERDUE_DAYS * DAY_MS) : issued;
  const paidOn = today;
  const nextCharge = new Date(today.getTime() + 30 * DAY_MS);

  const heroStatus: HeroStatus = paid
    ? { kind: "paid", paidOn }
    : status === "overdue"
      ? { kind: "overdue", days: OVERDUE_DAYS }
      : { kind: "due", due };

  function pickStatus(s: Status) {
    if ((s === "paid" || s === "autopay") && !paid) setBurst((b) => b + 1);
    setStatus(s);
    setPayClicked(null);
    setManageClicked(false);
  }

  function pickKind(k: SampleKind) {
    setKind(k);
    // "Autopay on" only exists for the Monthly sample.
    if (k !== "monthly" && status === "autopay") setStatus("paid");
    setPayClicked(null);
    setManageClicked(false);
  }

  const statusOptions = STATUS_ORDER.filter((s) => s !== "autopay" || kind === "monthly");

  return (
    <LaunchPadShell maxWidth="3xl" badge="Invoice" badgeIcon={<InvoiceBadgeIcon />} burst={burst}>
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
            options={statusOptions.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            value={status}
            onChange={pickStatus}
          />
        </div>
      </div>

      <InvoiceHero
        invoiceNumber={sample.number}
        firstName={CLIENT_FIRST}
        from={FROM}
        issued={issued}
        due={due}
        billedTo={`${CLIENT_NAME}, ${CLIENT_FIRM}`}
        amountLabel={paid ? "Amount paid" : "Amount due"}
        amountCents={paid ? total : balance}
        status={heroStatus}
      />

      {paid && (
        <PaidReceipt
          paidOn={paidOn}
          amountCents={total}
          methodLabel="Bank transfer (ACH)"
          action={
            <ReceiptButton disabled title="Available on the real page">
              Download receipt
            </ReceiptButton>
          }
          footnote={<p className="text-[11px] mt-3 text-amber-300/80">(Preview — nothing was charged)</p>}
        />
      )}

      {autopayOn && (
        <AutopayOnCard
          method="ach"
          nextChargeDate={nextCharge}
          managing={false}
          onManage={() => setManageClicked(true)}
        >
          {manageClicked && (
            <InlineNote tone="amber">
              Preview — in the live page this opens the secure Stripe billing portal to change card or bank
              details.
            </InlineNote>
          )}
        </AutopayOnCard>
      )}

      <CoversCard
        key={kind}
        items={sample.items}
        showScope={kind === "setup" || kind === "annual"}
        split={kind === "monthly" ? monthlySplit(sample.items) : null}
      />

      <TotalsCard
        subtotalCents={total}
        taxCents={0}
        totalCents={total}
        amountPaidCents={amountPaid}
        balanceCents={balance}
        paid={paid}
      />

      {!paid && (
        <PayCard
          achCents={achPrice}
          cardCents={cardPrice}
          achOnly={sample.achOnly}
          autopay={autopayEligible}
          paying={null}
          onPay={setPayClicked}
        >
          {payClicked && (
            <InlineNote tone="amber">
              Preview — in the live page this opens secure Stripe checkout (
              {payClicked === "ach" ? "bank transfer" : "card"},{" "}
              <span style={NUM_FONT}>
                {money(payClicked === "ach" ? achPrice : cardPrice)}
                {autopayEligible ? "/mo, autopay" : ""}
              </span>
              ).
            </InlineNote>
          )}
        </PayCard>
      )}

      <NextSteps kind={kind} paid={paid} autopay={autopayEligible} />

      <NotesCard notes={sample.notes} terms={sample.terms} />

      <InvoiceFooter />
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
          className={`min-h-11 sm:min-h-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            value === o.value ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-neutral-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
