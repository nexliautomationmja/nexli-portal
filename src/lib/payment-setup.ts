// ══════════════════════════════════════════════════════════
// "How you get paid" — the Launch Pad item that replaced the Stripe login
// (Nov 2026). The firm tells us who processes their payments today (so we can
// check whether it has an API and build their invoicing on it) and which
// invoice amounts should be paid by card, ACH and wire.
//
// Client-safe (no db): shared by the Launch Pad form, the submit route and the
// admin Onboarding page. Amounts are whole US dollars.
// ══════════════════════════════════════════════════════════

/** Common choices, roughly by how often accounting firms use them. */
export const PROCESSORS = [
  "Stripe",
  "Square",
  "PayPal",
  "QuickBooks Payments",
  "CPACharge / AffiniPay",
  "Clover",
  "Authorize.net",
  "Helcim",
  "BILL (Bill.com)",
  "Melio",
  "Ignition",
  "TaxDome",
  "Canopy",
  "Karbon",
  "My bank's merchant services",
] as const;
export const OTHER_PROCESSOR = "Other";
export const NO_PROCESSOR = "We don't have one yet";

export type CardMode = "limit" | "any" | "none";
export type AchMode = "any" | "range" | "none";
export type WireMode = "over" | "any" | "none";

export interface PaymentSetup {
  /** A PROCESSORS entry, OTHER_PROCESSOR or NO_PROCESSOR. */
  processor: string;
  /** The name typed in when processor is "Other". */
  processorOther: string | null;
  /** Cards: up to `max` per invoice ("limit"), any amount, or not taken. */
  card: { mode: CardMode; max: number | null };
  /** ACH: any amount, a range (either end may be open), or not used. */
  ach: { mode: AchMode; min: number | null; max: number | null };
  /** Wire: invoices over `min`, any amount, or not used. */
  wire: { mode: WireMode; min: number | null };
  notes: string;
}

/** The biggest amount anyone can type (and the "no limit" stand-in). */
export const MAX_AMOUNT = 10_000_000;

/** "$2,500" / "2500" / "2,500.00" → 2500 (whole dollars); null when empty or not a number. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), MAX_AMOUNT) : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[$,\s]/g, "");
  if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const n = Math.round(Number(s));
  return n > 0 ? Math.min(n, MAX_AMOUNT) : null;
}

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** The processor's name as the firm gave it. */
export function processorName(p: Pick<PaymentSetup, "processor" | "processorOther">): string {
  return p.processor === OTHER_PROCESSOR ? p.processorOther || "Other" : p.processor;
}

export function cardLine(p: PaymentSetup): string {
  if (p.card.mode === "none") return "Not taken";
  if (p.card.mode === "any" || !p.card.max) return "Any amount";
  return `Up to ${usd(p.card.max)} per invoice`;
}

export function achLine(p: PaymentSetup): string {
  if (p.ach.mode === "none") return "Not used";
  const { min, max } = p.ach;
  if (p.ach.mode === "any" || (!min && !max)) return "Any amount";
  if (min && max) return `${usd(min)} to ${usd(max)}`;
  return min ? `${usd(min)} and up` : `Up to ${usd(max!)}`;
}

export function wireLine(p: PaymentSetup): string {
  if (p.wire.mode === "none") return "Not used";
  if (p.wire.mode === "any" || !p.wire.min) return "Any amount";
  return `Over ${usd(p.wire.min)}`;
}

/** [from, to] in dollars, inclusive; `to` = Infinity for no upper limit. */
type Span = [number, number];

function spans(p: PaymentSetup): Span[] {
  const out: Span[] = [];
  if (p.card.mode === "limit" && p.card.max) out.push([0, p.card.max]);
  else if (p.card.mode === "any") out.push([0, Infinity]);
  if (p.ach.mode === "any") out.push([0, Infinity]);
  else if (p.ach.mode === "range") out.push([p.ach.min ?? 0, p.ach.max ?? Infinity]);
  if (p.wire.mode === "any") out.push([0, Infinity]);
  else if (p.wire.mode === "over" && p.wire.min) out.push([p.wire.min, Infinity]);
  return out;
}

/**
 * Invoice amounts no method covers (e.g. cards up to $1,000 and wires over
 * $10,000 with no ACH leave $1,000–$10,000 without a way to pay). Gaps under
 * a dollar are ignored; "over $X" and "up to $X" meet at X.
 */
export function coverageGaps(p: PaymentSetup): Span[] {
  const sorted = spans(p).sort((a, b) => a[0] - b[0]);
  const gaps: Span[] = [];
  let reach = 0;
  for (const [from, to] of sorted) {
    if (from > reach + 1) gaps.push([reach, from]);
    reach = Math.max(reach, to);
    if (reach === Infinity) return gaps;
  }
  gaps.push([reach, Infinity]);
  return gaps;
}

export function gapLine([from, to]: Span): string {
  return to === Infinity ? `over ${usd(from)}` : from === 0 ? `up to ${usd(to)}` : `between ${usd(from)} and ${usd(to)}`;
}

/** The methods an invoice of `amount` dollars would offer under these answers. */
export function methodsFor(p: PaymentSetup, amount: number): ("card" | "ach" | "wire")[] {
  const out: ("card" | "ach" | "wire")[] = [];
  if (p.card.mode === "any" || (p.card.mode === "limit" && p.card.max && amount <= p.card.max)) out.push("card");
  if (p.ach.mode === "any" || (p.ach.mode === "range" && amount >= (p.ach.min ?? 0) && amount <= (p.ach.max ?? Infinity))) out.push("ach");
  if (p.wire.mode === "any" || (p.wire.mode === "over" && p.wire.min && amount > p.wire.min)) out.push("wire");
  return out;
}

const CARD_MODES: CardMode[] = ["limit", "any", "none"];
const ACH_MODES: AchMode[] = ["any", "range", "none"];
const WIRE_MODES: WireMode[] = ["over", "any", "none"];
const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Check what the Launch Pad form sent. The error is written for the client
 * (it shows under the form).
 */
export function cleanPaymentSetup(raw: unknown): { ok: true; value: PaymentSetup } | { ok: false; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const card = (r.card && typeof r.card === "object" ? r.card : {}) as Record<string, unknown>;
  const ach = (r.ach && typeof r.ach === "object" ? r.ach : {}) as Record<string, unknown>;
  const wire = (r.wire && typeof r.wire === "object" ? r.wire : {}) as Record<string, unknown>;

  const processor = text(r.processor, 120);
  const listed = (PROCESSORS as readonly string[]).includes(processor) || processor === OTHER_PROCESSOR || processor === NO_PROCESSOR;
  if (!processor || !listed) return { ok: false, error: "Pick who processes your payments today." };
  const processorOther = processor === OTHER_PROCESSOR ? text(r.processorOther, 120) : "";
  if (processor === OTHER_PROCESSOR && !processorOther) return { ok: false, error: "Type the name of your payment processor." };

  const value: PaymentSetup = {
    processor,
    processorOther: processorOther || null,
    card: { mode: pick(card.mode, CARD_MODES, "limit"), max: parseAmount(card.max) },
    ach: { mode: pick(ach.mode, ACH_MODES, "any"), min: parseAmount(ach.min), max: parseAmount(ach.max) },
    wire: { mode: pick(wire.mode, WIRE_MODES, "over"), min: parseAmount(wire.min) },
    notes: text(r.notes, 1000),
  };
  if (value.card.mode !== "limit") value.card.max = null;
  if (value.ach.mode !== "range") value.ach = { mode: value.ach.mode, min: null, max: null };
  if (value.wire.mode !== "over") value.wire.min = null;

  if (value.card.mode === "limit" && !value.card.max) return { ok: false, error: "Enter the most you want charged to a card, or pick “Any amount”." };
  if (value.ach.mode === "range") {
    const { min, max } = value.ach;
    if (!min && !max) return { ok: false, error: "Enter the ACH amounts (from, up to, or both), or pick “Any amount”." };
    if (min && max && min >= max) return { ok: false, error: "For ACH, the “from” amount has to be less than the “up to” amount." };
  }
  if (value.wire.mode === "over" && !value.wire.min) return { ok: false, error: "Enter the amount wires should start at, or pick “Any amount”." };
  if (value.card.mode === "none" && value.ach.mode === "none" && value.wire.mode === "none") {
    return { ok: false, error: "Pick at least one way for clients to pay." };
  }
  return { ok: true, value };
}

/** A stored submission that is a PaymentSetup (not a legacy Stripe stand-in). */
export function asPaymentSetup(sub: unknown): PaymentSetup | null {
  const s = sub as Partial<PaymentSetup> | null;
  return s && typeof s === "object" && typeof s.processor === "string" && s.card && s.ach && s.wire ? (s as PaymentSetup) : null;
}
