/**
 * Default engagement letter template content for the Digital Rainmaker System.
 *
 * One-time $32,000 Setup Fee (Phase 1 implementation, itemized in Section 1
 * from SETUP_SCOPE), then platform upkeep $4,997/mo or $42,000/yr prepaid,
 * plus a $5,000/mo Managed Advertising Budget that Nexli deploys on the
 * client's behalf (pass-through).
 * Ad management included; no revenue share, no performance fee, no bonus,
 * and no guarantees (Oct 12 2026 — the client keeps all the upside; Nexli's
 * upside is the Enterprise tier). Initial term 6 months (monthly) / 12
 * months (annual). All dollar amounts are interpolated from the pricing
 * constants in drs-pricing.ts so the contract can never drift from what the
 * billing engine actually charges.
 */

import {
  DRS_PRICING,
  SETUP_SCOPE,
  ANNUAL_UPFRONT_CENTS,
  TOTAL_MONTHLY_CENTS,
  TERM_MONTHS,
  ADVERTISED_SERVICE,
  LAUNCH_TARGET_DAYS,
  type BillingPlan,
} from "./drs-pricing";

// ── Formatting helpers ──────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// Dual-pricing presentation (never "fee added at checkout") — see drs-pricing.ts.
const PAYMENT_METHODS_CLAUSE = `Payments may be made via ACH bank transfer or credit/debit card, processed through Stripe. Amounts listed in this Agreement are the discounted bank transfer (ACH) prices. Credit/debit card payments are charged at the corresponding card price; the exact amount of each payment option is presented at checkout before payment. The card price applies to the full invoiced amount, including any Managed Advertising Budget. The Setup Fee (and, on the annual plan, the first Annual Investment invoiced with it) is payable by ACH bank transfer or wire only.`;

/** English words for the small set of numbers the letter spells out. */
function numberWords(n: number): string {
  const words: Record<number, string> = {
    3: "three", 6: "six", 9: "nine", 12: "twelve", 18: "eighteen", 24: "twenty-four",
    30: "thirty", 50: "fifty", 60: "sixty", 90: "ninety", 100: "one hundred",
    120: "one hundred twenty", 150: "one hundred fifty", 180: "one hundred eighty",
  };
  return words[n] ?? String(n);
}

/** "six (6)" style wording for the term length. */
function termWords(months: number): string {
  return `${numberWords(months)} (${months})`;
}

// ── Client placeholder ──────────────────────────────────

/** The parties-block placeholder every generated letter (DRS + Enterprise) carries. */
export const CLIENT_PLACEHOLDER = "[CLIENT NAME / COMPANY]";

/**
 * Replaces every client placeholder in a letter with the client's firm name
 * (or the primary recipient's name). Blank labels leave the content as-is.
 */
export function fillClientPlaceholder(content: string, label: string | null | undefined): string {
  const name = (label ?? "").trim();
  if (!name) return content;
  return content.split(CLIENT_PLACEHOLDER).join(name);
}

// ── Digital Rainmaker System Template ───────────────────

export const DRS_TEMPLATE_NAME = "Digital Rainmaker System";

/**
 * Builds the full DRS engagement letter for the chosen billing plan. The fee
 * structure is a flat all-in-one Platform Investment — monthly or annual
 * prepaid — with no setup fees, covering the buildout AND ongoing
 * maintenance, plus the Managed Advertising Budget (Section 3(b)). Ad
 * management is included with no revenue share, no performance fee, and no
 * bonus (Section 3(c)); there are no guarantees. The Initial Term is in
 * Section 4(d). Section numbering is identical for both plans.
 */

/** The Section 2(a) Setup Fee line — a revision anchor used by the template refresh. */
export function drsFeeLine(_plan: BillingPlan): string {
  return `a) Setup Fee: ${fmt(DRS_PRICING.SETUP_FEE_CENTS)} USD (one-time)`;
}

/** The Section 2(b) recurring line per plan — the second revision anchor. */
export function drsPlanLine(plan: BillingPlan): string {
  return plan === "annual"
    ? `b) Annual Investment (Paid in Full): ${fmt(DRS_PRICING.ANNUAL_CENTS)} USD/year`
    : `b) Monthly Investment: ${fmt(TOTAL_MONTHLY_CENTS)} USD/month`;
}

const AD_SECTION_HEADING = "3. AD MANAGEMENT";

// Phrases every currently shipped letter contains. ADD ONE whenever a clause
// is rewritten without changing a heading or the fee line, so the stored
// seeded templates (templates/route.ts) are refreshed instead of drifting.
const CURRENT_REVISION_MARKERS = [
  "Managed Advertising Budget", // Oct 5 2026: $5,000/mo ad budget collected by Nexli (Sections 2, 3(b))
  "Initial Term and Renewal", // Oct 5 2026: 6/12-month initial term (Section 4(d))
  "no performance fee, bonus, or revenue share", // Oct 12 2026: guarantees + Success Bonus removed
  "Implementation (covered by the Setup Fee", // Oct 18 2026: $32,000 setup fee with itemized scope
  "invoiced when Provider completes the Phase 1 build", // Oct 18 2026: recurring billing starts at launch (Build complete)
  "payable by ACH bank transfer or wire only", // Oct 20 2026: setup invoices are bank/wire only
];

// Same as CURRENT_REVISION_MARKERS, but only for phrases that exist in the
// annual letter alone (checked only when plan === "annual").
const ANNUAL_ONLY_MARKERS = [
  "invoiced thirty (30) days before the anniversary", // Oct 18 2026: automated $42,000 annual renewal (Section 2(b))
];

/**
 * True when a stored DRS letter matches the currently shipped revision for
 * its plan: same fee line (so any price change is detected), the current
 * Section 3 heading, and every CURRENT_REVISION_MARKERS phrase — plus, for
 * the annual plan, every ANNUAL_ONLY_MARKERS phrase (so clause rewrites are
 * detected).
 */
export function isCurrentDrsRevision(content: string, plan: BillingPlan): boolean {
  return (
    content.includes(drsFeeLine(plan)) &&
    content.includes(drsPlanLine(plan)) &&
    content.includes(AD_SECTION_HEADING) &&
    CURRENT_REVISION_MARKERS.every((m) => content.includes(m)) &&
    (plan !== "annual" || ANNUAL_ONLY_MARKERS.every((m) => content.includes(m)))
  );
}

export function buildDrsTemplate(plan: BillingPlan = "monthly"): string {
  const monthly = fmt(DRS_PRICING.MONTHLY_CENTS);
  const annual = fmt(DRS_PRICING.ANNUAL_CENTS);
  const monthlyAnnualized = fmt(DRS_PRICING.MONTHLY_CENTS * 12);
  const totalMonthly = fmt(TOTAL_MONTHLY_CENTS);
  const setupFee = fmt(DRS_PRICING.SETUP_FEE_CENTS);
  const annualUpfront = fmt(ANNUAL_UPFRONT_CENTS);
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
  const adSpend = fmt(DRS_PRICING.AD_SPEND_MONTHLY_CENTS);
  const term = TERM_MONTHS[plan];
  const service = ADVERTISED_SERVICE;
  const launchDays = LAUNCH_TARGET_DAYS;

  const setupClause = `${drsFeeLine(plan)} — Due upon execution of this Agreement. The Setup Fee covers the complete Phase 1 Implementation itemized in Section 1 — the platform build, automations, content front-load and advertising engineering — and is non-refundable once Provider begins work. The Setup Fee is payable by ACH bank transfer or wire only; card payments are not accepted for the Setup Fee.`;

  const feeStructure =
    plan === "annual"
      ? `${setupClause}

${drsPlanLine("annual")} — Due upon execution of this Agreement together with the Setup Fee, invoiced together as a single invoice, for a total of ${annualUpfront} USD due at signing. This Platform Investment covers the Phase 2 ongoing operation of everything delivered in Phase 1 — hosting, maintenance, ad management, support, reporting and AI usage — for twelve (12) months, and reflects a savings versus the ${monthlyAnnualized} USD payable at the monthly rate. Because it is invoiced together with the Setup Fee, the first Annual Investment is payable by ACH bank transfer or wire only; renewal Annual Investments may be paid by ACH bank transfer or card through Stripe. The Annual Investment renews annually unless terminated under Section 11. Each renewal Annual Investment of ${annual} USD is invoiced thirty (30) days before the anniversary of the effective date and is due on the anniversary.

c) Managed Advertising Budget: ${adSpend} USD/month — Billed monthly, with the first month invoiced when Provider completes the Phase 1 build and launches the system and each subsequent invoice issued monthly thereafter, and deployed by Provider on Client's behalf under Section 3(b). The advertising budget is intentionally not collected up front; advertising begins once the first monthly invoice is paid. Billed via ACH bank transfer or card through Stripe.

d) Initial Term: ${termWords(term)} months from the effective date, as set out in Section 4(d).`
      : `${setupClause}

${drsPlanLine("monthly")} — Comprising (i) a Platform Investment of ${monthly} USD/month, the Phase 2 ongoing operation of everything delivered in Phase 1 — hosting, maintenance, ad management, support, reporting and AI usage; and (ii) a Managed Advertising Budget of ${adSpend} USD/month that Provider deploys on Client's behalf under Section 3(b). Billed as a single monthly invoice via ACH bank transfer or card through Stripe. The first Monthly Investment is invoiced when Provider completes the Phase 1 build and launches the system, and monthly thereafter. Advertising and the ongoing services in Phase 2 begin once the first Monthly Investment is paid.

c) Initial Term: ${termWords(term)} months from the effective date, as set out in Section 4(d).`;

  return `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure, automation and client-acquisition platform, in two phases:

Phase 1 — Implementation (covered by the Setup Fee in Section 2). Launched within ${launchDays} days of Provider receiving all required client materials (30 days maximum). Provider will build and deliver the following:

${scopeText}

Phase 2 — Ongoing Operation (covered by the Monthly Investment in Section 2). Beginning at launch and for the term of this Agreement, Provider will host and maintain everything delivered in Phase 1; manage and optimize Client's advertising campaigns, including continued creative production; provide technical support; deliver weekly updates and performance reporting; and cover the AI usage required to operate the system.

2. FEE STRUCTURE

${feeStructure}

${AD_SECTION_HEADING}

a) Ad Management Included: Provider manages Client's advertising campaigns (the "acquisition system") as part of the Platform Investment in Section 2. There is no ad management retainer, no setup fee, and no percentage of Client's revenue charged for this service.

b) Managed Advertising Budget: Client funds a Managed Advertising Budget of ${adSpend} USD per month, billed by Provider as set out in Section 2, which Provider deploys on Client's behalf to the advertising platforms (Meta, Google, etc.) at Provider's discretion to generate ${service} advisory leads for Client. The budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider reports the budget deployed to date in its weekly updates to Client. Any portion of the budget not deployed in a given month carries forward and is deployed in subsequent months. Upon termination or expiration of this Agreement, any undeployed balance is deployed on Client's campaigns through the end of the then-current term or notice period and is not refundable. The budget may be increased only upon Client's written authorization.

c) Flat-Rate, No Revenue Share: The Setup Fee and the Platform Investment in Section 2 are Provider's only fees for its services; the Managed Advertising Budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider never takes a percentage of Client's revenue, never charges a fee per client the advertising brings in, and there is no performance fee, bonus, or revenue share of any kind under this Agreement. Every dollar of advisory revenue the acquisition system produces belongs to Client.

d) Attribution & Reporting: Leads and advisory clients generated through the acquisition system are attributed using the Nexli tracking system (UTM tracking and conversion attribution). Provider will provide performance reporting, including weekly updates, so both parties can see which leads, clients, and revenue are attributable to the advertising.

4. PAYMENT TERMS

a) ${PAYMENT_METHODS_CLAUSE}

b) All fees are non-refundable and no refunds will be issued once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until ${plan === "annual" ? `the Setup Fee and the Annual Investment (together ${annualUpfront})` : `the Setup Fee (${setupFee})`} ${plan === "annual" ? "are" : "is"} received.

d) Initial Term and Renewal: This Agreement has an Initial Term of ${termWords(term)} months from the effective date. Advertising systems typically need ninety (90) days or more to mature, and the Initial Term exists so the acquisition system has the time it needs to produce results for Client. Either party may give thirty (30) days' written notice of termination at any time, but termination takes effect no earlier than the end of the Initial Term, and billing under Section 2 continues through that date. After the Initial Term this Agreement continues ${plan === "annual" ? "for successive twelve (12) month renewal terms" : "month-to-month"} until terminated on thirty (30) days' written notice. No refunds or pro-rated credits will be issued for any billing period. Client retains access through the end of the paid billing cycle.

5. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's effective date, with launch targeted within ${launchDays} days of Provider's receipt of all required client materials (Section 1).

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications. Client shall submit all onboarding items requested on Provider's Launch Pad (including payment processing setup, DNS access, and the other items listed there) within five (5) days of receiving the Launch Pad link; the ${launchDays}-day launch timeline runs from Provider's receipt of all such items.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. Provider is not responsible for delays caused by Client's non-cooperation.

6. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the platform investment, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.

7. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

8. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.

9. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

10. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

11. TERMINATION

a) Either party may terminate this Agreement with thirty (30) days' written notice, effective no earlier than the end of the Initial Term set out in Section 4(d). Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) Upon termination, Client retains ownership of their website and content per Section 6(a). All access to Provider's proprietary systems ceases per Section 6(c).

12. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

13. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

14. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

15. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}

export const DRS_TEMPLATE_CONTENT = buildDrsTemplate("monthly");

// Named per-plan templates seeded for every user. Both names contain
// "Digital Rainmaker" so the auto-invoicing template detection matches.
export const DRS_MONTHLY_TEMPLATE_NAME = "Digital Rainmaker System — Monthly";
export const DRS_MONTHLY_TEMPLATE_CONTENT = buildDrsTemplate("monthly");

export const DRS_ANNUAL_TEMPLATE_NAME = "Digital Rainmaker System — Annual";
export const DRS_ANNUAL_TEMPLATE_CONTENT = buildDrsTemplate("annual");

/**
 * Generates the full DRS engagement letter content for the chosen billing plan.
 */
export function generateDrsContent(plan: BillingPlan = "monthly"): string {
  return buildDrsTemplate(plan);
}
