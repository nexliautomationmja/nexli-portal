/**
 * The Digital Rainmaker System engagement letter for the Nov 19 2026 pricing
 * (nexli.net commit d149283, "One monthly fee. No setup fee."): a $10,000
 * monthly Agency Fee billed from signing — or the six months up front for
 * $50,000 — plus 10% Performance Pay on Net Attributed Revenue, with the ad
 * budget paid by the client straight to the platform.
 *
 * It is a separate letter from the previous pricing's (buildDrsTemplate in
 * engagement-defaults.ts), which is not changed by any of this and stays
 * available on the composer's back tab.
 *
 * What Marcel decided (Nov 19 2026):
 *   - First $10,000 invoiced at signing; paying it opens the Launch Pad.
 *   - Initial Term six months FROM SIGNING (as nexli.net's Terms say),
 *     renewing six months at a time. Notice at least 30 days before a term
 *     ends stops the renewal; later notice ends it a term later.
 *   - Performance Pay each month on its own: 10% of (collected from clients
 *     the ads brought in − that month's ad spend) − the $10,000 paid for the
 *     month, never below zero. The last month is still invoiced; nothing
 *     accrues after the agreement ends.
 *   - Prepay: each prepaid month counts as $10,000 toward the 10%; later
 *     terms bill $10,000 a month unless prepaid again.
 *   - The client owns the website and the portal; Nexli owns the ad creative
 *     it makes.
 *
 * Judgment calls of mine in the wording (confirm with Marcel if they come
 * up): all revenue from an Attributed Client counts, not only tax planning;
 * ten days to dispute a statement line; a general no-chargeback clause
 * (4(b)) in place of the setup-fee waiver; the client approves its monthly
 * ad budget in writing; the client handles any disclosure its professional
 * rules require (3(j)).
 *
 * Like every Nexli letter, a SIGNED letter keeps its own text forever, so
 * billing and statements read the fee, the percentage and the billing choice
 * from the letter itself (the readers at the bottom), not from today's
 * constants. All dollar amounts are interpolated from drs-pricing.ts.
 *
 * Client-safe: no server-only imports.
 */

import {
  AGENCY,
  AGENCY_PREPAY_SAVING_CENTS,
  LAUNCH_TARGET_DAYS,
  SETUP_SCOPE,
  type AgencyBilling,
} from "./drs-pricing";
import { CLIENT_PLACEHOLDER } from "./engagement-defaults";
import { NEXLI_LEGAL } from "./nexli-legal";

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

const WORDS: Record<number, string> = {
  5: "five", 6: "six", 7: "seven", 10: "ten", 12: "twelve", 21: "twenty-one", 30: "thirty", 72: "seventy-two", 90: "ninety",
};

/** "six (6)" */
function n(value: number): string {
  return `${WORDS[value] ?? String(value)} (${value})`;
}

// ── Names and anchors ───────────────────────────────────

// Both names contain "Digital Rainmaker" (billing detects the offer by
// template name) and "Performance" (the composer tells them from the
// previous pricing's Monthly / Annual templates by it).
export const DRS_PERFORMANCE_MONTHLY_TEMPLATE_NAME = "Digital Rainmaker System — Performance (Monthly)";
export const DRS_PERFORMANCE_PREPAID_TEMPLATE_NAME = "Digital Rainmaker System — Performance (Prepaid)";

/** True for the two seeded templates of the Nov 19 2026 pricing. */
export function isPerformanceTemplateName(name: string | null | undefined): boolean {
  const s = (name ?? "").toLowerCase();
  return s.includes("digital rainmaker") && s.includes("performance");
}

/** Section 3's heading: only the Nov 19 2026 letter has it. */
export const PERFORMANCE_SECTION_HEADING = "3. PERFORMANCE PAY";

/** Section 2(a) of the monthly letter — a revision anchor, and where billing reads the fee. */
export function agencyFeeLine(feeCents: number = AGENCY.FEE_MONTHLY_CENTS): string {
  return `a) Agency Fee: ${fmt(feeCents)} USD/month`;
}

/** Section 2(a) of the prepaid letter. */
export function agencyPrepayLine(prepayCents: number = AGENCY.PREPAY_CENTS): string {
  return `a) Six-Month Prepayment: ${fmt(prepayCents)} USD`;
}

/** Section 2's Performance Pay line (b on monthly, c on prepaid). */
export function performanceLine(percent: number = AGENCY.PERFORMANCE_PERCENT): string {
  return `) Performance Pay: ${percent}% of Net Attributed Revenue`;
}

// Phrases every currently shipped performance letter contains. ADD ONE
// whenever a clause is rewritten, so the signing page's summaries (which
// describe this revision) hide on letters that say something else.
const PERFORMANCE_REVISION_MARKERS = [
  PERFORMANCE_SECTION_HEADING,
  "the greater of the Agency Fee for that Month or", // 3(a): the rule
  "Each Month stands on its own", // 3(a): no carry-over
  "whose first recorded contact with Client came through the acquisition system", // 3(d)
  "No Performance Pay accrues on amounts Client receives after this Agreement ends", // 3(i): no tail
  "paid by Client directly to the advertising platform", // 2: ad budget never passes through Nexli
  "months from the date of last signature below", // term counted from signing
  "at least thirty (30) days before the end of the then-current term", // 4(d): renewal notice
  "remain Provider's property", // 6(b): ad creative
];

// ── The letter ──────────────────────────────────────────

/**
 * Builds the letter for the chosen way of paying the Agency Fee. Section
 * numbering and headings are identical for both — the signing page maps its
 * summaries by heading.
 */
export function buildDrsPerformanceLetter(billing: AgencyBilling = "monthly"): string {
  const prepaid = billing === "prepay";
  const fee = fmt(AGENCY.FEE_MONTHLY_CENTS);
  const prepay = fmt(AGENCY.PREPAY_CENTS);
  const saving = fmt(AGENCY_PREPAY_SAVING_CENTS);
  const percent = AGENCY.PERFORMANCE_PERCENT;
  const minBudget = fmt(AGENCY.MIN_AD_BUDGET_CENTS);
  const term = n(AGENCY.TERM_MONTHS);
  const notice = n(AGENCY.CANCEL_NOTICE_DAYS);
  const launchDays = LAUNCH_TARGET_DAYS;
  // The worked example nexli.net's /pricing and /terms use.
  const exampleNet = 12_000_000;
  const exampleTotal = Math.round((exampleNet * percent) / 100);
  const breakEven = Math.round((AGENCY.FEE_MONTHLY_CENTS * 100) / percent);

  // Section 1 Phase 1: every group/item from SETUP_SCOPE, lettered a) b) c)…
  let letterIndex = 0;
  const scopeText = SETUP_SCOPE.map((group) => {
    const items = group.items
      .map((item) => {
        const letter = String.fromCharCode(97 + letterIndex++);
        return `${letter}) ${item.name} — ${item.detail}`;
      })
      .join("\n\n");
    return `${group.title}\n\n${items}`;
  }).join("\n\n");

  // What the Agency Fee pays for once the build is done — never hosting.
  const upkeepScope =
    "maintenance, updates and support, ad management (including continued creative production), weekly updates and reporting, and AI usage";
  const oneSystem =
    "The fee is for the complete system: parts of it cannot be removed, paused or priced separately, and the fee is not reduced if Client chooses not to use part of it.";

  // Section 2's clauses are lettered in order; the prepaid letter has one more.
  const letters = prepaid ? { performance: "c", budget: "d", term: "e" } : { performance: "b", budget: "c", term: "d" };

  const feeClauses = prepaid
    ? `${agencyPrepayLine()} — Due upon execution of this Agreement, in place of the ${n(AGENCY.TERM_MONTHS)} monthly Agency Fees of ${fee} USD for the Initial Term (a saving of ${saving} USD). It pays for the complete Phase 1 build itemized in Section 1 and for the Phase 2 ongoing operation of all of it — ${upkeepScope} — for the Initial Term. There is no separate setup fee. ${oneSystem} The Six-Month Prepayment is non-refundable, in whole and in part.

b) Agency Fee after the Initial Term: ${fee} USD/month — Each renewal term under Section 4(d) is billed at this monthly Agency Fee, the first one due on the first day of the renewal term and each later one due monthly after that. Client pays the first of them once, by credit or debit card or ACH bank transfer, and each later Agency Fee is then charged automatically to that payment method (autopay). Client may instead prepay a renewal term, before it begins, at the Six-Month Prepayment amount then offered by Provider.`
    : `${agencyFeeLine()} — The first Agency Fee is due upon execution of this Agreement, and each later Agency Fee is due monthly after that. Client pays the first invoice once, by credit or debit card or ACH bank transfer, and each later Agency Fee is then charged automatically to that payment method (autopay). The Agency Fee pays for the complete Phase 1 build itemized in Section 1 and for the Phase 2 ongoing operation of all of it — ${upkeepScope}. There is no separate setup fee. ${oneSystem}`;

  const feeStructure = `${feeClauses}

${letters.performance}${performanceLine()} for each Month, with the Agency Fee for that Month credited against it, so that only the difference, if any, is invoiced. Section 3 sets out how it is calculated, and it is never a percentage of Client's total revenue.

${letters.budget}) Advertising Budget: at least ${minBudget} USD/month — Client's advertising budget is separate from Provider's fees. It is paid by Client directly to the advertising platform (Meta, Google, etc.), on Client's own payment method and in Client's own advertising account. Provider does not collect, hold, place or invoice it, and cannot refund it. Client approves its monthly budget in writing (email is sufficient); Provider manages Client's campaigns within the approved budget and does not exceed it without Client's written approval. Client keeps a valid payment method on its advertising account so the campaigns can run, and no fee under this Agreement is reduced or paused if Client lowers or pauses its budget.

${letters.term}) Initial Term: ${term} months from the date of last signature below, renewing for successive terms of ${term} months, as set out in Section 4(d).`;

  const prepaidCredit = prepaid
    ? ` For each Month of a term that Client has prepaid, the Agency Fee for that Month (${fee} USD) is treated as paid and is credited in the same way.`
    : "";

  const effective = prepaid
    ? `the Six-Month Prepayment (${prepay})`
    : `the first Agency Fee (${fee})`;

  const renewalBilling = prepaid
    ? ` Each renewal term is billed at the monthly Agency Fee, on autopay, unless Client prepays that term before it begins (Section 2(b)).`
    : "";

  return `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: ${NEXLI_LEGAL.name}, ${NEXLI_LEGAL.entity}, ${NEXLI_LEGAL.street}, ${NEXLI_LEGAL.cityLine} ("Provider" or "Nexli")

Client: ${CLIENT_PLACEHOLDER} ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure, automation and client-acquisition platform, in two phases. Both are paid for by the ${prepaid ? "Six-Month Prepayment and the Agency Fee" : "Agency Fee"} in Section 2. There is no setup fee.

Phase 1 — Build (included in the Agency Fee; no setup fee). The build takes about ${launchDays} days from kickoff, subject to Section 5. Provider will build and deliver the following:

${scopeText}

Phase 2 — Ongoing Operation (included in the Agency Fee). For the term of this Agreement, Provider will maintain, update and support everything delivered in Phase 1 — Client's website, client portal and dashboard, funnel and automations; manage and optimize Client's advertising campaigns, including continued creative production; provide technical support; deliver weekly updates and performance reporting; and cover the AI usage required to operate the system.

Launch: "Launch" means the day the Phase 1 build is complete (or deemed complete under Section 5(c)) and Client's advertising goes live. Billing and the Initial Term begin at signing, not at Launch: the build runs inside the first month.

Hosting: Provider's fees do not include Client's web hosting, domain or email services. Client keeps its own hosting, domain and email providers and continues to pay them directly.

2. FEE STRUCTURE

${feeStructure}

${PERFORMANCE_SECTION_HEADING}

a) The Rule: For each Month, Provider's compensation is the greater of the Agency Fee for that Month or ${percent}% of Net Attributed Revenue for that Month. The Agency Fee already paid for that Month is credited against it, not added to it, and only the difference, if any, is invoiced ("Performance Pay").${prepaidCredit} If ${percent}% of Net Attributed Revenue for a Month is equal to or less than the Agency Fee, no Performance Pay is owed for that Month, and the Agency Fee is not reduced, refunded or carried forward. Each Month stands on its own: a Month with little or no Net Attributed Revenue does not reduce the Performance Pay owed for any other Month.

b) Example: If Net Attributed Revenue for a Month is ${fmt(exampleNet)}, Provider's total compensation for that Month is ${fmt(exampleTotal)}; because the ${fee} Agency Fee has already been paid, the Performance Pay invoice is ${fmt(exampleTotal - AGENCY.FEE_MONTHLY_CENTS)}. If Net Attributed Revenue for a Month is ${fmt(breakEven)} or less, no Performance Pay is owed for that Month.

c) Month: "Month" means each one-month period of this Agreement, the first beginning on the date of last signature below and each later one beginning on the same day of the following calendar month (or on the last day of that month, where it has no such day).

d) Attributed Client: "Attributed Client" means a person or business whose first recorded contact with Client came through the acquisition system — the advertising campaigns, landing pages, funnels, forms and booking pages Provider builds or manages for Client — on or after the date of last signature below, as recorded by the Nexli tracking system (first-touch attribution, including UTM tracking and conversion attribution), together with any business that person owns or controls. A person or business that was already a paying client of Client before that first recorded contact is not an Attributed Client.

e) Attributed Revenue: "Attributed Revenue" for a Month means all amounts Client actually receives during that Month from Attributed Clients, for any of Client's services, less any refunds Client actually pays to Attributed Clients during that Month and any sales tax or government filing fees Client collects from them and passes through. It is what Client collects, not what Client bills, and it is never Client's total revenue: revenue from clients who are not Attributed Clients is outside this Section.

f) Net Attributed Revenue: "Net Attributed Revenue" for a Month means Attributed Revenue for that Month less the Advertising Spend for that Month, and is never less than zero. "Advertising Spend" means the amounts the advertising platforms charge Client during that Month for the campaigns Provider manages for Client.

g) Records: Client will issue its invoices to Attributed Clients, and record the payments it receives from them, through the client portal and dashboard Provider builds for Client under Section 1. An amount Client receives from an Attributed Client outside the portal still counts as Attributed Revenue, and Client will record it in the portal within ${n(AGENCY.RECORD_DAYS)} business days of receiving it. Provider may rely on the portal's records and the Nexli tracking system to prepare each statement, and Client will provide, on reasonable request, records sufficient to confirm the amounts received from Attributed Clients.

h) Statements and Invoices: Within ${n(AGENCY.STATEMENT_DAYS)} days after the end of each Month, Provider will give Client a statement for that Month showing the Attributed Clients, the amounts received from each, the Advertising Spend, the Net Attributed Revenue and the calculation of any Performance Pay, together with an invoice for any Performance Pay owed. Each Performance Pay invoice is due within ${n(AGENCY.PERFORMANCE_DUE_DAYS)} days of its date. If Client believes a statement is wrong, Client will tell Provider in writing, with the supporting records, within ${n(AGENCY.DISPUTE_DAYS)} days of receiving it; Provider will correct any error, and any part of a statement not disputed within that time is final. An amount later found to have been left out of a statement is added to the next one.

i) Last Month and After: Performance Pay is owed for every Month of this Agreement, including the last, and the statement and invoice for the last Month are issued after this Agreement ends and remain payable. No Performance Pay accrues on amounts Client receives after this Agreement ends.

j) Client's Professional Rules: Performance Pay is compensation for Provider's marketing and technology services. Provider does not provide tax, accounting or legal services. Client is responsible for any disclosure to its clients, and any other step, that Client's professional or licensing rules require in connection with Performance Pay.

4. PAYMENT TERMS

a) How Each Charge Is Paid: Every charge under this Agreement may be paid by credit or debit card, ACH bank transfer or wire, at the same price: no surcharge or card price applies to card payments. Card and ACH payments are processed through Stripe; wire instructions are shown on the invoice or available from Provider on request. Agency Fees run on autopay: Client pays the first Agency Fee invoice once, by card or ACH, and each later Agency Fee is charged automatically to that payment method on its due date. The exact amount is shown on each invoice before payment.

b) All fees are non-refundable once charged, in whole and in part, and no partial-month or partial-term refunds are issued, except that Provider refunds in full any duplicate or erroneous charge. Client will not dispute, reverse or charge back a fee properly charged under this Agreement through Client's bank, card issuer or payment provider. Any such dispute is a material breach of this Agreement; Client agrees that this signed Agreement may be submitted as evidence that the charge was authorized, and Client remains liable for the full amount disputed plus any dispute fees and reasonable collection costs, including attorneys' fees.

c) This Agreement becomes effective on the date Provider receives ${effective} (the "effective date"), and Provider has no obligation to begin work until then. The Initial Term and the first Month are nonetheless counted from the date of last signature below.

d) Initial Term and Renewal: This Agreement has an Initial Term of ${term} months from the date of last signature below. Advertising systems typically need ${n(90)} days or more to mature, and the Initial Term exists so the acquisition system has the time it needs to produce results for Client. At the end of the Initial Term, and of each renewal term, this Agreement renews automatically for a further term of ${term} months, unless either party gives the other written notice of non-renewal at least ${notice} days before the end of the then-current term. Notice may be given at any time, but it takes effect only at the end of a term: notice given at least ${notice} days before the end of the current term ends this Agreement at the end of that term, and notice given later ends it at the end of the following term. The Agency Fees falling due within a term, and the Performance Pay for each of its Months, remain payable through the end of that term.${renewalBilling}

5. PROJECT TIMELINE & CLIENT COOPERATION

a) Work begins at a kickoff call once this Agreement is effective (Section 4(c)). The Phase 1 build shall be completed within ${n(30)} calendar days of the effective date, with Launch targeted within ${launchDays} days of Provider's receipt of all required client materials. Delays caused by third parties outside Provider's control, including the carriers' review of Client's A2P 10DLC registration and the advertising platforms' review of Client's advertising accounts, extend these timelines by the length of the delay. Billing and the Initial Term do not wait for Launch (Section 1).

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications. Client shall submit all onboarding items requested on Provider's Launch Pad (including payment processing setup, DNS access, access to Client's advertising account with a valid payment method on it, and the other items listed there) within ${n(5)} days of receiving the Launch Pad link; the ${launchDays}-day launch timeline runs from Provider's receipt of all such items.

c) If Client fails to provide required access, materials, or cooperation within the 30-day build period, the build shall be deemed complete regardless of outstanding deliverables. Provider is not responsible for delays caused by Client's non-cooperation, and no fee is reduced, paused or refunded because of them.

6. INTELLECTUAL PROPERTY

a) Client Ownership: Client owns what Provider builds for it under Section 1 — its website (its design, copy, images and files), its client portal and dashboard, its sales funnel and its automations — together with its domain name, its content and brand assets, its advertising accounts (including their history, audiences and data), and all Client Data (Section 10(b)). Provider's fees pay for building them and for Provider's upkeep and management of them.

b) Ad Creative: The ad creative Provider produces for Client's campaigns (the videos and images), and the tools Provider uses to make it, remain Provider's property. While this Agreement is in effect Client may use that creative in the campaigns Provider manages for Client.

c) Provider's Platform: Client's client portal, dashboard and automations are configured for Client and run on Provider's platform. The software, platform, automation workflows, templates, methods and know-how Provider uses to build and run Client's system remain the property of ${NEXLI_LEGAL.name}. Provider grants Client a non-exclusive, non-transferable right to use them while this Agreement is in effect. Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of them. Provider may reuse its general know-how, methods and templates that are not specific to Client.

d) When This Agreement Ends: Provider's upkeep and management end when this Agreement ends, and Client's portal, dashboard and automations, which run on Provider's platform, stop at the same time. Within ${n(30)} days after this Agreement ends, at Client's request, Provider will deliver an export of Client Data and a complete copy of Client's website (its pages, copy and images) so Client can host it with any provider, and will hand over any access Provider holds to Client's domain, DNS and advertising accounts; Provider then removes its own access. Client keeps what it owns under Section 6(a); the ad creative remains Provider's.

e) Portfolio: Provider may reference Client's website in its portfolio unless Client opts out in writing.

7. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

8. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the ${n(12)} months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system. Performance Pay is a way of calculating Provider's compensation, not a promise of any result.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, the advertising platforms, Client's hosting provider, DNS providers, or telecommunications carriers.

9. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

10. CONFIDENTIALITY

a) Confidential Information: Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

b) Client Data: "Client Data" means all information that Client, or Client's own clients, provide to or store in Client's website, client portal, dashboard and automations, including contacts, documents and tax information. Client Data belongs to Client. Provider uses Client Data only to provide the services under this Agreement, including preparing the statements in Section 3, never sells it, and never uses it for Provider's own marketing. Provider protects Client Data with reasonable administrative, technical and physical safeguards appropriate to its sensitivity, and uses only service providers that are contractually bound to safeguard it. Provider will notify Client without undue delay, and in any event within ${n(72)} hours of confirming it, of any unauthorized access to Client Data. Client remains responsible for its own obligations to its clients, including obtaining any consents the law requires. After the ${n(30)} day period in Section 6(d), Provider deletes Client Data, except where the law requires Provider to keep it.

11. TERMINATION

a) Either party may end this Agreement by written notice of non-renewal under Section 4(d). It then ends at the end of the term that Section sets out, and access continues through that date.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform. The fees falling due within the then-current term remain payable.

c) When this Agreement ends, for any reason, Section 6(d) applies, and Section 3(i) continues to apply to the last Month.

d) Notices: Written notice under this Agreement, including notice of non-renewal, may be given by email — to Provider at ${NEXLI_LEGAL.email}, and to Client at the email address of Client's signer — or by mail to Provider at the address above.

12. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, with the arbitration held in the State of Florida. The arbitrator's decision shall be final and binding, and judgment on the award may be entered in any court of competent jurisdiction. Each party shall bear its own costs and attorneys' fees, except as provided in Section 4(b). Either party may seek injunctive relief in a court of competent jurisdiction to protect its intellectual property or confidential information.

13. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

14. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

15. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}

export const DRS_PERFORMANCE_MONTHLY_TEMPLATE_CONTENT = buildDrsPerformanceLetter("monthly");
export const DRS_PERFORMANCE_PREPAID_TEMPLATE_CONTENT = buildDrsPerformanceLetter("prepay");

// ── Readers for SIGNED letters ──────────────────────────

/** True for a letter on the Nov 19 2026 pricing (it has Section 3 "PERFORMANCE PAY"). */
export function isPerformanceLetter(content: string | null | undefined): boolean {
  return (content ?? "").includes(PERFORMANCE_SECTION_HEADING);
}

/** How this letter pays the Agency Fee for its Initial Term. */
export function agencyBillingOfLetter(content: string | null | undefined): AgencyBilling {
  return (content ?? "").includes("a) Six-Month Prepayment:") ? "prepay" : "monthly";
}

function centsOf(text: string | undefined): number | null {
  if (!text) return null;
  const cents = Math.round(Number(text.replace(/,/g, "")) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** The money terms a performance letter states, read from its own text. */
export interface PerformanceLetterTerms {
  billing: AgencyBilling;
  /** The monthly Agency Fee in cents — also what each month credits against the percentage. */
  feeCents: number;
  /** The Six-Month Prepayment in cents (prepaid letters only). */
  prepayCents: number | null;
  /** Performance Pay percentage of Net Attributed Revenue. */
  percent: number;
  /** Initial Term (and each renewal term), in months. */
  termMonths: number;
}

/**
 * What a performance letter says about money. Anything its text doesn't
 * state falls back to today's constants (a hand-edited letter).
 */
export function performanceLetterTerms(content: string | null | undefined): PerformanceLetterTerms {
  const text = content ?? "";
  const billing = agencyBillingOfLetter(text);
  const fee = /Agency Fee(?: after the Initial Term)?: \$([\d,]+(?:\.\d{1,2})?) USD\/month/.exec(text);
  const prepay = /a\) Six-Month Prepayment: \$([\d,]+(?:\.\d{1,2})?) USD/.exec(text);
  const pct = /\) Performance Pay: (\d+(?:\.\d+)?)% of Net Attributed Revenue/.exec(text);
  const term = /Initial Term of [a-z-]+ \((\d+)\) months from the date of last signature/.exec(text);
  const percent = pct ? Number(pct[1]) : NaN;
  const months = term ? Number(term[1]) : NaN;
  return {
    billing,
    feeCents: centsOf(fee?.[1]) ?? AGENCY.FEE_MONTHLY_CENTS,
    prepayCents: billing === "prepay" ? centsOf(prepay?.[1]) ?? AGENCY.PREPAY_CENTS : null,
    percent: Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : AGENCY.PERFORMANCE_PERCENT,
    termMonths: Number.isFinite(months) && months > 0 ? months : AGENCY.TERM_MONTHS,
  };
}

/**
 * True when a stored performance letter matches the currently shipped
 * revision for its billing choice: today's fee line, today's percentage, and
 * every PERFORMANCE_REVISION_MARKERS phrase. The signing page shows its
 * plain-English summaries only then.
 */
export function isCurrentPerformanceRevision(content: string, billing: AgencyBilling): boolean {
  return (
    content.includes(billing === "prepay" ? agencyPrepayLine() : agencyFeeLine()) &&
    content.includes(performanceLine()) &&
    PERFORMANCE_REVISION_MARKERS.every((m) => content.includes(m))
  );
}

/** Generates the letter the composer sends for the chosen billing. */
export function generateDrsPerformanceContent(billing: AgencyBilling = "monthly"): string {
  return buildDrsPerformanceLetter(billing);
}
