/**
 * Which of a firm's paying clients came from the ads (pure, client-safe).
 *
 * The letter's Section 3(d): an Attributed Client is someone whose first
 * recorded contact with the firm came through the acquisition system, on or
 * after signing, per the Nexli tracking system — and who wasn't already a
 * paying client. Here that means: a contact in the firm's CRM that came in
 * from an ad (a saved PerfLead) who later pays one of the firm's portal
 * invoices. The join is the payer's email, then phone, then the firm's own
 * pipeline lead linked to that contact; Marcel can link or exclude by hand
 * (ClientRule), and those decisions stick.
 */

export interface PerfLead {
  id: string;
  ghlContactId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** ISO: when the contact first came in (GoHighLevel dateAdded). */
  firstSeenAt: string;
  /** facebook | instagram | other | unknown */
  platform: string | null;
  campaign: string | null;
  ad: string | null;
  landingUrl: string | null;
  booked: boolean;
}

export interface FirmInvoice {
  id: string;
  invoiceNumber: string;
  clientEmail: string;
  clientName: string;
  clientPhone: string | null;
  clientCompany: string | null;
  status: string;
  /** Cents. */
  amountPaid: number;
  paidAt: string | null;
  updatedAt: string;
  /** metadata.payments[] — written for manual and bank-transfer payments (exact dates). */
  payments: { amountCents: number; at: string }[];
}

export interface ClientRule {
  /** The payer's email, lowercased. */
  email: string;
  rule: "include" | "exclude";
  /** include: the lead this payer is. */
  leadId: string | null;
  reason: string | null;
}

/** A firm's own pipeline lead that carries a CRM contact id: a second way to tie an email to a contact. */
export interface PipelineLink {
  email: string;
  ghlContactId: string;
}

export interface Payment {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  /** ISO. */
  at: string;
  /** The date is the invoice's last update, not a recorded payment date (a part-paid card or ACH invoice). */
  estimated: boolean;
}

export type MatchHow = "email" | "phone" | "pipeline" | "manual";

export interface Payer {
  email: string;
  name: string;
  company: string | null;
  payments: Payment[];
  lead: PerfLead | null;
  how: MatchHow | null;
  /** Matched to an ad lead but left out: by Marcel's rule, or because they paid the firm before the ad. */
  excluded: { by: "rule" | "existing_client"; reason: string } | null;
  firstPaidAt: string | null;
}

export const normEmail = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

/** The last ten digits (US numbers written any way compare equal); null when there aren't ten. */
export function normPhone(s: string | null | undefined): string | null {
  const digits = (s ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

const VOID = new Set(["draft", "void", "canceled"]);

/**
 * The payments recorded on one invoice. Recorded entries (manual, wire)
 * keep their own dates; whatever else was paid is dated at paidAt when the
 * invoice is fully paid, otherwise at its last update (flagged estimated).
 */
export function paymentsOf(inv: FirmInvoice): Payment[] {
  if (VOID.has(inv.status) || inv.amountPaid <= 0) return [];
  const out: Payment[] = [];
  let recorded = 0;
  for (const p of inv.payments) {
    if (!(p.amountCents > 0) || Number.isNaN(Date.parse(p.at))) continue;
    out.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amountCents: Math.round(p.amountCents), at: new Date(p.at).toISOString(), estimated: false });
    recorded += Math.round(p.amountCents);
  }
  const rest = inv.amountPaid - recorded;
  if (rest > 0) {
    const exact = inv.status === "paid" && inv.paidAt && !Number.isNaN(Date.parse(inv.paidAt));
    out.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountCents: rest,
      at: new Date(exact ? (inv.paidAt as string) : inv.updatedAt).toISOString(),
      estimated: !exact,
    });
  }
  // Recorded entries can't exceed what the invoice says was paid (a correction after the fact): trust the invoice.
  if (rest < 0) {
    let over = -rest;
    for (let i = out.length - 1; i >= 0 && over > 0; i--) {
      const cut = Math.min(over, out[i].amountCents);
      out[i] = { ...out[i], amountCents: out[i].amountCents - cut };
      over -= cut;
    }
  }
  return out.filter((p) => p.amountCents > 0).sort((a, b) => a.at.localeCompare(b.at));
}

const dayOf = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

/**
 * Every payer on the firm's invoices, each matched (or not) to an ad lead.
 * When two leads share an email or phone, the earliest one is the first
 * contact and wins.
 */
export function matchPayers(input: { leads: PerfLead[]; invoices: FirmInvoice[]; rules: ClientRule[]; links: PipelineLink[] }): Payer[] {
  const leads = [...input.leads].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt));
  const byId = new Map(leads.map((l) => [l.id, l]));
  const byEmail = new Map<string, PerfLead>();
  const byPhone = new Map<string, PerfLead>();
  const byContact = new Map<string, PerfLead>();
  for (const l of leads) {
    const e = normEmail(l.email);
    if (e && !byEmail.has(e)) byEmail.set(e, l);
    const p = normPhone(l.phone);
    if (p && !byPhone.has(p)) byPhone.set(p, l);
    if (!byContact.has(l.ghlContactId)) byContact.set(l.ghlContactId, l);
  }
  const linkByEmail = new Map<string, PerfLead>();
  for (const k of input.links) {
    const lead = byContact.get(k.ghlContactId);
    const e = normEmail(k.email);
    if (lead && e && !linkByEmail.has(e)) linkByEmail.set(e, lead);
  }
  const rules = new Map(input.rules.map((r) => [normEmail(r.email), r]));

  const groups = new Map<string, { name: string; company: string | null; phones: Set<string>; payments: Payment[] }>();
  for (const inv of input.invoices) {
    const pays = paymentsOf(inv);
    if (!pays.length) continue;
    const email = normEmail(inv.clientEmail);
    if (!email) continue;
    const g = groups.get(email) ?? { name: inv.clientName, company: inv.clientCompany, phones: new Set<string>(), payments: [] };
    if (!g.company && inv.clientCompany) g.company = inv.clientCompany;
    const ph = normPhone(inv.clientPhone);
    if (ph) g.phones.add(ph);
    g.payments.push(...pays);
    groups.set(email, g);
  }

  const payers: Payer[] = [];
  for (const [email, g] of groups) {
    const payments = g.payments.sort((a, b) => a.at.localeCompare(b.at));
    const firstPaidAt = payments[0]?.at ?? null;
    const rule = rules.get(email);
    let lead: PerfLead | null = null;
    let how: MatchHow | null = null;
    if (rule?.rule === "include" && rule.leadId && byId.has(rule.leadId)) {
      lead = byId.get(rule.leadId) as PerfLead;
      how = "manual";
    } else if (byEmail.has(email)) {
      lead = byEmail.get(email) as PerfLead;
      how = "email";
    } else {
      const phone = [...g.phones].find((p) => byPhone.has(p));
      if (phone) {
        lead = byPhone.get(phone) as PerfLead;
        how = "phone";
      } else if (linkByEmail.has(email)) {
        lead = linkByEmail.get(email) as PerfLead;
        how = "pipeline";
      }
    }
    let excluded: Payer["excluded"] = null;
    if (lead) {
      if (rule?.rule === "exclude") excluded = { by: "rule", reason: rule.reason?.trim() || "Left out by you" };
      // Already paying the firm before the ad brought them in: not an Attributed Client (letter 3(d)).
      // A link made by hand says otherwise, and wins.
      else if (how !== "manual" && firstPaidAt && firstPaidAt < lead.firstSeenAt)
        excluded = { by: "existing_client", reason: `Already a client: paid ${dayOf(firstPaidAt)}, before coming in through the ads on ${dayOf(lead.firstSeenAt)}` };
    }
    payers.push({ email, name: g.name, company: g.company, payments, lead, how, excluded, firstPaidAt });
  }
  return payers.sort((a, b) => a.name.localeCompare(b.name));
}

/** What a payer paid inside [start, end). */
export function paidIn(payer: Payer, start: Date, end: Date): Payment[] {
  const a = start.toISOString();
  const b = end.toISOString();
  return payer.payments.filter((p) => p.at >= a && p.at < b);
}

export const sumCents = (items: { amountCents: number }[]): number => items.reduce((t, i) => t + i.amountCents, 0);

/** One client's line on a month's statement. */
export interface StatementLine {
  email: string;
  name: string;
  company: string | null;
  amountCents: number;
  payments: Payment[];
  /** The proof: when and how they came in. */
  lead: { firstSeenAt: string; platform: string | null; campaign: string | null; ad: string | null; landingUrl: string | null; booked: boolean };
  how: MatchHow;
}

/** The attributed clients who paid in [start, end), largest first. */
export function statementLines(payers: Payer[], start: Date, end: Date): StatementLine[] {
  const lines: StatementLine[] = [];
  for (const p of payers) {
    if (!p.lead || !p.how || p.excluded) continue;
    const payments = paidIn(p, start, end);
    const amountCents = sumCents(payments);
    if (amountCents <= 0) continue;
    const { firstSeenAt, platform, campaign, ad, landingUrl, booked } = p.lead;
    lines.push({ email: p.email, name: p.name, company: p.company, amountCents, payments, lead: { firstSeenAt, platform, campaign, ad, landingUrl, booked }, how: p.how });
  }
  return lines.sort((a, b) => b.amountCents - a.amountCents);
}

/** Payers who paid in [start, end) but don't count: no ad lead, or left out. */
export function uncountedPayers(payers: Payer[], start: Date, end: Date): { payer: Payer; amountCents: number }[] {
  return payers
    .filter((p) => !p.lead || p.excluded)
    .map((p) => ({ payer: p, amountCents: sumCents(paidIn(p, start, end)) }))
    .filter((x) => x.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
}

/** A payment Marcel adds by hand: money an ad-sourced client paid outside the portal (letter 3(g)), or a correction (negative). */
export interface ExtraLine {
  id: string;
  name: string;
  amountCents: number;
  /** YYYY-MM-DD, as he entered it. */
  at: string | null;
  note: string | null;
}

export interface StatementTotals {
  collectedCents: number;
  adSpendCents: number;
  netCents: number;
  percent: number;
  /** percent × net, before the credit. */
  grossCents: number;
  /** The Agency Fee credited for the month. */
  creditCents: number;
  dueCents: number;
  /** Ad-sourced clients who paid in the month. */
  clients: number;
}

/** The month's numbers: collected (lines + extras) − ad spend = net; percent of net − the fee = due. Never below zero. */
export function statementTotals(
  lines: { amountCents: number }[],
  extras: { amountCents: number }[],
  adSpendCents: number,
  terms: { percent: number; feeCents: number }
): StatementTotals {
  const collectedCents = Math.max(0, sumCents(lines) + sumCents(extras));
  const spend = Math.max(0, Math.round(adSpendCents));
  const netCents = Math.max(0, collectedCents - spend);
  const grossCents = Math.round((netCents * terms.percent) / 100);
  return {
    collectedCents,
    adSpendCents: spend,
    netCents,
    percent: terms.percent,
    grossCents,
    creditCents: terms.feeCents,
    dueCents: Math.max(0, grossCents - terms.feeCents),
    clients: lines.length,
  };
}
