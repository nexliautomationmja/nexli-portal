"use client";

// ══════════════════════════════════════════════════════════
// /invoice/[token] — Launch Pad pay page for invoices NEXLI issues (owner =
// the Nexli admin; page.tsx decides). Invoices a client firm sends its own
// clients stay on the classic, firm-branded invoice-client.tsx.
// Same sections as the design preview (/invoice/preview).
// Dual pricing: the listed amount is the bank transfer (ACH) price; card
// payments are charged at the card price (cardPriceCents). Autopay-eligible
// invoices (first DRS monthly) start a Stripe subscription at checkout and
// show per-month prices from the API (autopay.monthlyAchCents / CardCents).
// ══════════════════════════════════════════════════════════

import { useEffect, useState, useSyncExternalStore } from "react";
import { cardPriceCents } from "@/lib/drs-pricing";
import {
  LaunchPadShell,
  LpMessage,
  LpSpinner,
  useForceDark,
} from "@/components/launch-pad";
import {
  InvoiceHero,
  PaidReceipt,
  ReceiptButton,
  CoversCard,
  TotalsCard,
  PayCard,
  InlineNote,
  AchPendingCard,
  AutopayOnCard,
  NextSteps,
  NotesCard,
  InvoiceFooter,
  InvoiceBadgeIcon,
  DAY_MS,
  monthlySplit,
  paymentMethodLabel,
  type BillingType,
  type HeroStatus,
  type InvoiceKind,
  type InvoiceLine,
  type PayMethod,
} from "@/components/invoice-launch-pad";

// ─── API shape (GET /api/invoice/[token]) ──────────────────

interface AutopayInfo {
  eligible: boolean;
  active: boolean;
  method: PayMethod | null;
  monthlyAchCents: number;
  monthlyCardCents: number;
  nextChargeDate: string | null;
  status: string | null;
}

interface InvoiceResponse {
  invoice: {
    invoiceNumber: string;
    status: string;
    currency: string;
    subtotal: number;
    taxRate: number | null;
    taxAmount: number | null;
    total: number;
    amountPaid: number;
    balanceDue: number;
    issueDate: string;
    dueDate: string;
    notes: string | null;
    terms: string | null;
    clientName: string;
    clientEmail: string;
    clientCompany: string | null;
    paymentUrl: string | null;
    paidAt: string | null;
    achOnly: boolean;
    paymentMethod: string | null;
    achSettlementStatus: string | null;
    kind: InvoiceKind;
    autopay: AutopayInfo | null;
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    billingType: BillingType;
    order: number;
  }[];
  from: { name: string; company: string };
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: InvoiceResponse };

type ReturnParam = "success" | "canceled" | null;

// ─── Helpers ───────────────────────────────────────────────

let cachedToday: Date | null = null;
const noopSubscribe = () => () => {};
function getToday(): Date {
  if (!cachedToday) cachedToday = new Date();
  return cachedToday;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isPaid(inv: InvoiceResponse["invoice"]): boolean {
  return inv.status === "paid" || (inv.balanceDue <= 0 && inv.amountPaid > 0);
}

function isAchPending(inv: InvoiceResponse["invoice"]): boolean {
  return !isPaid(inv) && inv.achSettlementStatus === "pending";
}

/** Has checkout landed yet (webhook processed)? */
function isSettledAfterCheckout(inv: InvoiceResponse["invoice"]): boolean {
  return isPaid(inv) || isAchPending(inv) || Boolean(inv.autopay?.active);
}

/** ?payment=success|canceled, read once on the client. */
function readReturnParam(): ReturnParam {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("payment");
  return v === "success" || v === "canceled" ? v : null;
}

const SUCCESS_POLLS = 6;
const SUCCESS_POLL_MS = 2500;

// ─── Page ──────────────────────────────────────────────────

export function InvoiceLaunchPadClient({ token }: { token: string }) {
  // No /invoice/layout.tsx today; force dark anyway and re-apply next frame
  // in case a light-mode layout is added later (parent effects run after ours).
  useForceDark();
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add("dark"));
    return () => cancelAnimationFrame(id);
  }, []);

  const [returnParam] = useState<ReturnParam>(readReturnParam);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [burst, setBurst] = useState(0);
  const [paying, setPaying] = useState<PayMethod | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const clientToday = useSyncExternalStore(noopSubscribe, getToday, () => null);

  // Drop ?payment=… from the address bar so a refresh doesn't replay it.
  useEffect(() => {
    if (!returnParam) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [returnParam]);

  // Load the invoice. Arriving from a successful checkout, the webhook may
  // not have landed yet — poll briefly until it shows paid / processing.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(attempt: number) {
      try {
        const res = await fetch(`/api/invoice/${token}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "error",
            error:
              res.status === 410
                ? body.error || "This invoice is no longer valid"
                : "Invoice not found",
          });
          return;
        }
        const data = body as InvoiceResponse;
        setState({ status: "ready", data });

        if (returnParam !== "success") return;
        if (isSettledAfterCheckout(data.invoice)) {
          setConfirming(false);
          setBurst((b) => (b === 0 ? 1 : b));
          return;
        }
        if (attempt < SUCCESS_POLLS) {
          setConfirming(true);
          timer = setTimeout(() => load(attempt + 1), SUCCESS_POLL_MS);
        } else {
          setConfirming(false);
        }
      } catch {
        if (!cancelled && attempt === 0) {
          setState({ status: "error", error: "Failed to load invoice" });
        }
      }
    }

    load(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, returnParam]);

  async function handlePay(method: PayMethod) {
    if (paying) return;
    setPaying(method);
    setPayError(null);
    try {
      const res = await fetch(`/api/invoice/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        if (data.error === "payments_not_configured") {
          setPayError(
            "Online payment isn't available on this invoice right now. Reply to your invoice email and we'll sort it out."
          );
        } else if (data.error === "card_not_accepted") {
          setPayError(
            "Card payments are not accepted on this invoice. Please pay by bank transfer (ACH) or wire."
          );
        } else if (data.error === "payment_processing") {
          setPayError(
            "A payment for this invoice is already processing or autopay is already on, so there's nothing to pay right now. We'll email your receipt when it clears."
          );
        } else {
          setPayError(data.error || "We couldn't open checkout. Please try again.");
        }
        setPaying(null);
        return;
      }
      // Keep the button busy while the browser navigates to Stripe.
      window.location.href = data.checkoutUrl;
    } catch {
      setPayError("Something went wrong. Please try again.");
      setPaying(null);
    }
  }

  async function handleManage() {
    if (managing) return;
    setManaging(true);
    setManageError(null);
    try {
      const res = await fetch(`/api/invoice/${token}/billing-portal`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setManageError(
          data.error === "no_autopay"
            ? "We couldn't find autopay for this invoice. Reply to your invoice email and we'll help."
            : "We couldn't open autopay settings. Please try again."
        );
        setManaging(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setManageError("Something went wrong. Please try again.");
      setManaging(false);
    }
  }

  // ─── Loading / error ─────────────────────────────
  if (state.status === "loading") return <LpSpinner fullScreen />;
  if (state.status === "error") {
    return (
      <LpMessage
        emoji="🔒"
        title={state.error}
        body="This invoice link may have expired or been replaced. Check your latest invoice email, or reply to it and we'll help."
      />
    );
  }

  const { invoice: inv, lineItems, from } = state.data;
  const today = clientToday ?? new Date(inv.issueDate);
  const currency = inv.currency;

  const paid = isPaid(inv);
  const achPending = isAchPending(inv);
  const autopay = inv.autopay;
  const autopayActive = Boolean(autopay?.active);
  const autopayEligible = Boolean(autopay?.eligible) && !autopayActive;

  const issued = new Date(inv.issueDate);
  const due = new Date(inv.dueDate);
  const paidOn = inv.paidAt ? new Date(inv.paidAt) : today;
  const overdueDays = Math.floor((startOfDay(today) - startOfDay(due)) / DAY_MS);
  const overdue = !paid && !achPending && overdueDays > 0;

  const heroStatus: HeroStatus = paid
    ? { kind: "paid", paidOn }
    : achPending
      ? { kind: "processing" }
      : overdue
        ? { kind: "overdue", days: overdueDays }
        : { kind: "due", due };

  const balance = Math.max(0, inv.balanceDue);
  const achCents = autopayEligible && autopay ? autopay.monthlyAchCents : balance;
  const cardCents = autopayEligible && autopay ? autopay.monthlyCardCents : cardPriceCents(balance);
  const showPay = !paid && !achPending && !autopayActive && balance > 0;

  const items: InvoiceLine[] = lineItems.map((l) => ({
    description: l.description,
    billingType: l.billingType,
    amountCents: l.amount,
  }));

  const firstName = inv.clientName.trim().split(/\s+/)[0] ?? "";
  const billedTo = [inv.clientName, inv.clientCompany].filter(Boolean).join(", ") || null;
  const fromName = from.company || from.name || "Nexli Automation LLC";

  return (
    <LaunchPadShell maxWidth="3xl" badge="Invoice" badgeIcon={<InvoiceBadgeIcon />} burst={burst}>
      <InvoiceHero
        invoiceNumber={inv.invoiceNumber}
        firstName={firstName}
        from={fromName}
        issued={issued}
        due={due}
        billedTo={billedTo}
        amountLabel={paid ? "Amount paid" : achPending ? "Payment processing" : "Amount due"}
        amountCents={paid ? inv.amountPaid || inv.total : balance}
        currency={currency}
        status={heroStatus}
      />

      {paid && (
        <PaidReceipt
          paidOn={paidOn}
          amountCents={inv.amountPaid || inv.total}
          methodLabel={paymentMethodLabel(inv.paymentMethod)}
          currency={currency}
          action={<ReceiptButton onClick={() => window.print()}>Print receipt</ReceiptButton>}
        />
      )}

      {achPending && <AchPendingCard />}

      {!paid && !achPending && confirming && (
        <div className="lp-card">
          <InlineNote tone="neutral">Confirming your payment — this page updates automatically.</InlineNote>
        </div>
      )}

      {autopayActive && autopay && (
        <AutopayOnCard
          method={autopay.method}
          nextChargeDate={autopay.nextChargeDate ? new Date(autopay.nextChargeDate) : null}
          unpaid={!paid && !achPending}
          managing={managing}
          onManage={handleManage}
        >
          {manageError && <InlineNote tone="error">{manageError}</InlineNote>}
        </AutopayOnCard>
      )}

      <CoversCard
        items={items}
        currency={currency}
        showScope={inv.kind === "setup" || inv.kind === "annual"}
        split={inv.kind === "monthly" ? monthlySplit(items) : null}
      />

      <TotalsCard
        subtotalCents={inv.subtotal}
        taxCents={inv.taxAmount ?? 0}
        totalCents={inv.total}
        amountPaidCents={inv.amountPaid}
        balanceCents={paid ? 0 : balance}
        paid={paid}
        currency={currency}
      />

      {showPay && returnParam === "canceled" && (
        <div className="lp-card -mb-6">
          <InlineNote tone="neutral">Payment canceled — you can try again below.</InlineNote>
        </div>
      )}

      {showPay && (
        <PayCard
          achCents={achCents}
          cardCents={cardCents}
          achOnly={inv.achOnly}
          autopay={autopayEligible}
          currency={currency}
          paying={paying}
          onPay={handlePay}
        >
          {payError && <InlineNote tone="error">{payError}</InlineNote>}
        </PayCard>
      )}

      <NextSteps kind={inv.kind} paid={paid} autopay={autopayEligible || autopayActive} />

      <NotesCard notes={inv.notes} terms={inv.terms} />

      <InvoiceFooter />
    </LaunchPadShell>
  );
}
