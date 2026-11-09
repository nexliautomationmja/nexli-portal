/**
 * Default engagement letter template content for the Digital Rainmaker System.
 *
 * One-time $32,000 Setup Fee (Phase 1 implementation, itemized in Section 1
 * from SETUP_SCOPE), then platform upkeep $4,997/mo or $42,000 prepaid for
 * twelve months, plus a $5,000/mo Managed Advertising Budget that Nexli
 * deploys on the client's behalf (pass-through).
 * Ad management included; no revenue share, no performance fee, no bonus,
 * and no guarantees (Oct 12 2026 — the client keeps all the upside; Nexli's
 * upside is the Enterprise tier). Initial term 6 months (monthly) / 12
 * months (annual). All dollar amounts are interpolated from the pricing
 * constants in drs-pricing.ts so the contract can never drift from what the
 * billing engine actually charges.
 *
 * Nov 9 2026 revision (Marcel), so the letter says what nexli.net's Terms,
 * Refund, Delivery and Pricing pages say:
 *   - "Launch" is defined in Section 1 (build complete — or deemed complete
 *     under 5(c) — and the first monthly invoice issued). The Initial Term
 *     runs from Launch, not from the effective date.
 *   - The annual plan does NOT renew automatically: no $42,000 renewal
 *     invoice; continuing takes the client's written agreement.
 *   - Hosting is not part of Nexli's fees: the client keeps paying its own
 *     hosting, domain and email providers, as before.
 *   - Section 6: the website, domain, content, brand, ad accounts, ad
 *     creatives and data are the client's. The client's portal/dashboard
 *     (one system) and automations run on Nexli's platform; the monthly pays
 *     their upkeep, and they stop when it ends — with a data export and a
 *     copy of the website within 30 days.
 *   - Also: Client Data (10(b)), notices (11(d)), billing-error refunds
 *     (4(b)), third-party delays (5(a)), autopay (2, 4(a)) and the AAA
 *     Commercial Rules with the 2(a) fee exception (12).
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
import { NEXLI_LEGAL } from "./nexli-legal";

// ── Formatting helpers ──────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// Dual-pricing presentation (never "fee added at checkout") — see drs-pricing.ts.
// Nov 7 2026 (Marcel): the large up-front amounts are paid by bank transfer
// straight into Nexli's bank account (Mercury) — processors balk at them.
// Monthly invoices stay on Stripe (ACH or card, same price) and run on autopay.
function paymentMethodsClause(plan: BillingPlan): string {
  const upFront =
    plan === "annual"
      ? "The Setup Fee and the Annual Investment, and any further prepaid year Client agrees to, are"
      : "The Setup Fee is";
  return `${upFront} paid by ACH bank transfer or wire directly to Provider's bank account, using the payment instructions shown on the invoice; card payments are not accepted for ${plan === "annual" ? "these amounts" : "the Setup Fee"}. Monthly invoices are paid by ACH bank transfer or credit/debit card through Stripe, at the same price: no surcharge or card price applies to card payments. Client pays the first monthly invoice once, choosing ACH or card, and each later monthly invoice is then charged automatically to that payment method (autopay). The exact amount is shown on each invoice before payment.`;
}

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

// ── Revision helpers for SIGNED letters ─────────────────
// A signed letter keeps its own text forever, so billing reads the terms a
// client actually signed from these phrases rather than from today's code.

/** Only in letters (Nov 9 2026 on) whose Initial Term runs from Launch. */
export const LAUNCH_TERM_MARKER = "months from Launch";

/** Only in annual letters that renew automatically (Oct 18 – Nov 9 2026). */
export const ANNUAL_AUTO_RENEW_MARKER = "invoiced thirty (30) days before the anniversary";

/** True when this letter's Initial Term is counted from Launch (else from the effective date). */
export function drsTermRunsFromLaunch(content: string | null | undefined): boolean {
  return (content ?? "").includes(LAUNCH_TERM_MARKER);
}

/** True when this (annual) letter renews automatically at $42,000 a year. */
export function drsAnnualAutoRenews(content: string | null | undefined): boolean {
  return (content ?? "").includes(ANNUAL_AUTO_RENEW_MARKER);
}

// ── Digital Rainmaker System Template ───────────────────

export const DRS_TEMPLATE_NAME = "Digital Rainmaker System";

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
  "waives any right to dispute, reverse or charge back", // Oct 26 2026: cards accepted again on setup; chargeback waiver
  "no surcharge or card price applies", // Oct 26 2026: card costs the same as ACH
  "directly to Provider's bank account", // Nov 7 2026: setup / annual / renewals by bank transfer (Mercury), not Stripe
  LAUNCH_TERM_MARKER, // Nov 9 2026: Launch defined; Initial Term counted from Launch
  "Provider's fees do not include Client's web hosting", // Nov 9 2026: hosting stays with the client's provider
  "Client Data", // Nov 9 2026: ownership rewrite (6), Client Data clause (10(b))
  "duplicate or erroneous charge", // Nov 9 2026: billing errors refunded (4(b))
];

// Same as CURRENT_REVISION_MARKERS, but only for phrases that exist in the
// annual letter alone (checked only when plan === "annual").
const ANNUAL_ONLY_MARKERS = [
  "applies equally to the first Annual Investment", // Oct 26 2026: waiver covers the full annual up-front invoice
  "does not renew automatically", // Nov 9 2026: no automatic $42,000 renewal (Sections 2(b), 4(d))
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

/**
 * Builds the full DRS engagement letter for the chosen billing plan: the
 * one-time Setup Fee (Section 2(a)), then the Monthly Investment or the
 * prepaid Annual Investment, plus the Managed Advertising Budget (Section
 * 3(b)). Ad management is included with no revenue share, no performance
 * fee, and no bonus (Section 3(c)); there are no guarantees (Section 8(c)).
 * The Initial Term is in Section 4(d). Section numbering and headings are
 * identical for both plans — the signing page maps its summaries by heading.
 */
export function buildDrsTemplate(plan: BillingPlan = "monthly"): string {
  const monthly = fmt(DRS_PRICING.MONTHLY_CENTS);
  const monthlyAnnualized = fmt(DRS_PRICING.MONTHLY_CENTS * 12);
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
  const annual = plan === "annual";

  // What the Platform Investment pays for (Phase 2) — never hosting.
  const upkeepScope =
    "maintenance, updates and support, ad management (including continued creative production), weekly updates and reporting, and AI usage";

  const setupClause = `${drsFeeLine(plan)} — Due upon execution of this Agreement. The Setup Fee covers the complete Phase 1 Implementation itemized in Section 1 — the platform build, automations, content front-load and advertising engineering. The Setup Fee is paid by ACH bank transfer or wire directly to Provider's bank account, using the instructions on the invoice; card payments are not accepted for the Setup Fee. Because the Setup Fee pays for implementation work that begins immediately and cannot be returned, the Setup Fee is non-refundable and non-disputable. Client knowingly and voluntarily waives any right to dispute, reverse or charge back the Setup Fee through Client's bank, card issuer or payment provider. Any such dispute is a material breach of this Agreement; Client agrees that this signed Agreement may be submitted as evidence that the charge was authorized and that this waiver was given, and Client remains liable for the full amount disputed plus any dispute fees and reasonable collection costs, including attorneys' fees.`;

  const feeStructure = annual
    ? `${setupClause}

${drsPlanLine("annual")} — Due upon execution of this Agreement together with the Setup Fee, invoiced together as a single invoice, for a total of ${annualUpfront} USD due at signing. This Platform Investment covers the Phase 2 ongoing operation of everything delivered in Phase 1 — ${upkeepScope} — for twelve (12) months from Launch, and reflects a savings versus the ${monthlyAnnualized} USD payable at the monthly rate. The first Annual Investment is paid together with the Setup Fee at a discount to the monthly rate. In consideration of that discount, the chargeback and dispute waiver in Section 2(a) applies equally to the first Annual Investment, so the entire ${annualUpfront} USD paid at signing is non-refundable and may not be disputed or charged back. It is paid by ACH bank transfer or wire directly to Provider's bank account, as is any further prepaid year Client agrees to; card payments are not accepted for these amounts. The Annual Investment does not renew automatically: nothing further is charged after the Initial Term unless, before it ends, Client agrees in writing to continue on the monthly plan or to prepay a further year, as set out in Section 4(d).

c) Managed Advertising Budget: ${adSpend} USD/month — Billed monthly from Launch through the end of the Initial Term, with the first month invoiced when Provider completes the Phase 1 build and launches the system and each subsequent invoice issued monthly thereafter, and deployed by Provider on Client's behalf under Section 3(b). The advertising budget is intentionally not collected up front; advertising begins once the first monthly invoice is paid. Billed via ACH bank transfer or card through Stripe; Client pays the first invoice once and each later month is charged automatically to the same payment method (autopay).

d) Initial Term: ${termWords(term)} ${LAUNCH_TERM_MARKER}, as set out in Section 4(d).`
    : `${setupClause}

${drsPlanLine("monthly")} — Comprising (i) a Platform Investment of ${monthly} USD/month, the Phase 2 ongoing operation of everything delivered in Phase 1 — ${upkeepScope}; and (ii) a Managed Advertising Budget of ${adSpend} USD/month that Provider deploys on Client's behalf under Section 3(b). Billed as a single monthly invoice via ACH bank transfer or card through Stripe. The first Monthly Investment is invoiced when Provider completes the Phase 1 build and launches the system (Launch), and monthly thereafter; Client pays the first invoice once and each later Monthly Investment is charged automatically to the same payment method (autopay). Advertising and the ongoing services in Phase 2 begin once the first Monthly Investment is paid.

c) Initial Term: ${termWords(term)} ${LAUNCH_TERM_MARKER}, as set out in Section 4(d).`;

  const continuation = annual
    ? "The annual plan does not renew automatically: this Agreement ends at the end of the Initial Term, and nothing further is charged, unless before then Client agrees in writing to continue on the monthly plan or to prepay a further year."
    : "After the Initial Term this Agreement continues month-to-month, and each Monthly Investment continues to be charged automatically, until either party terminates it on thirty (30) days' written notice.";

  return `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: ${NEXLI_LEGAL.name}, ${NEXLI_LEGAL.entity}, ${NEXLI_LEGAL.street}, ${NEXLI_LEGAL.cityLine} ("Provider" or "Nexli")

Client: ${CLIENT_PLACEHOLDER} ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure, automation and client-acquisition platform, in two phases:

Phase 1 — Implementation (covered by the Setup Fee in Section 2). Launched within ${launchDays} days of Provider receiving all required client materials (30 days maximum, subject to Section 5). Provider will build and deliver the following:

${scopeText}

Phase 2 — Ongoing Operation (covered by the ${annual ? "Annual Investment" : "Monthly Investment"} in Section 2). Beginning at Launch and for the term of this Agreement, Provider will maintain, update and support everything delivered in Phase 1 — Client's website, client portal and dashboard, funnel and automations; manage and optimize Client's advertising campaigns, including continued creative production; provide technical support; deliver weekly updates and performance reporting; and cover the AI usage required to operate the system.

Launch: "Launch" means the date Provider completes the Phase 1 build (or the build is deemed complete under Section 5(c)) and issues the first ${annual ? "monthly Managed Advertising Budget invoice" : "Monthly Investment invoice"} under Section 2. Advertising goes live once that invoice is paid.

Hosting: Provider's fees do not include Client's web hosting, domain or email services. Client keeps its own hosting, domain and email providers and continues to pay them directly.

2. FEE STRUCTURE

${feeStructure}

${AD_SECTION_HEADING}

a) Ad Management Included: Provider manages Client's advertising campaigns (the "acquisition system") as part of the Platform Investment in Section 2. There is no separate ad management retainer or fee, and no percentage of Client's revenue charged for this service.

b) Managed Advertising Budget: Client funds a Managed Advertising Budget of ${adSpend} USD per month, billed by Provider as set out in Section 2, which Provider deploys on Client's behalf to the advertising platforms (Meta, Google, etc.) at Provider's discretion to generate ${service} advisory leads for Client. The budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider reports where the budget went in its weekly updates to Client. Any portion of the budget not deployed in a given month carries forward and is deployed in subsequent months. Upon termination or expiration of this Agreement, any undeployed balance is deployed on Client's campaigns through the end of the then-current term or notice period and is not refundable. The budget may be increased only upon Client's written authorization.

c) Flat-Rate, No Revenue Share: The Setup Fee and the Platform Investment in Section 2 are Provider's only fees for its services; the Managed Advertising Budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider never takes a percentage of Client's revenue, never charges a fee per client the advertising brings in, and there is no performance fee, bonus, or revenue share of any kind under this Agreement. Every dollar of advisory revenue the acquisition system produces belongs to Client.

d) Attribution & Reporting: Leads and advisory clients generated through the acquisition system are attributed using the Nexli tracking system (UTM tracking and conversion attribution). Provider will provide performance reporting, including weekly updates, so both parties can see which leads, clients, and revenue are attributable to the advertising.

4. PAYMENT TERMS

a) ${paymentMethodsClause(plan)}

b) All fees are non-refundable and no refunds will be issued once payment is received, except that Provider refunds in full any duplicate or erroneous charge.

c) This Agreement becomes effective on the date Provider receives ${annual ? `the Setup Fee and the Annual Investment (together ${annualUpfront})` : `the Setup Fee (${setupFee})`} (the "effective date"), and Provider has no obligation to begin work until then.

d) Initial Term and Renewal: This Agreement has an Initial Term of ${termWords(term)} ${LAUNCH_TERM_MARKER}. Advertising systems typically need ninety (90) days or more to mature, and the Initial Term exists so the acquisition system has the time it needs to produce results for Client. Either party may give thirty (30) days' written notice of termination at any time, but termination takes effect no earlier than the end of the Initial Term, and billing under Section 2 continues through that date. ${continuation} No refunds or pro-rated credits will be issued for any billing period. Client retains access through the end of the paid billing cycle.

5. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's effective date, with Launch targeted within ${launchDays} days of Provider's receipt of all required client materials (Section 1). Delays caused by third parties outside Provider's control, including the carriers' review of Client's A2P 10DLC registration and the advertising platforms' review of Client's advertising accounts, extend these timelines by the length of the delay.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications. Client shall submit all onboarding items requested on Provider's Launch Pad (including payment processing setup, DNS access, and the other items listed there) within five (5) days of receiving the Launch Pad link; the ${launchDays}-day launch timeline runs from Provider's receipt of all such items.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables, and Launch may occur as defined in Section 1. Provider is not responsible for delays caused by Client's non-cooperation.

6. INTELLECTUAL PROPERTY

a) Client Ownership: Client owns its website (its design, copy, images and files), its domain name, its content and brand assets, its advertising accounts, the ad creatives produced for Client, and all Client Data (Section 10(b)). Provider claims no ownership of any of them.

b) Client's Portal, Dashboard and Automations: In Phase 1 Provider builds Client's own client portal and dashboard (one system) and Client's automations, configured for Client on Provider's platform. The Platform Investment in Section 2 pays for their upkeep — keeping them running, maintained, updated and supported — for as long as this Agreement is in effect.

c) Provider's Platform: The software, platform, automation workflows, templates, methods and know-how Provider uses to build and run Client's system remain the property of ${NEXLI_LEGAL.name}. Provider grants Client a non-exclusive, non-transferable right to use them while this Agreement is in effect. Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of them. Provider may reuse its general know-how, methods and templates that are not specific to Client.

d) When This Agreement Ends: Provider's upkeep ends at the end of the last paid billing cycle, and Client's portal, dashboard and automations, which run on Provider's platform, stop at the same time. Within thirty (30) days after this Agreement ends, at Client's request, Provider will deliver an export of Client Data and a complete copy of Client's website (its pages, copy and images) so Client can host it with any provider, and will hand over any access Provider holds to Client's domain, DNS and advertising accounts; Provider then removes its own access.

e) Portfolio: Provider may reference Client's website in its portfolio unless Client opts out in writing.

7. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

8. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, Client's hosting provider, DNS providers, or telecommunications carriers.

9. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

10. CONFIDENTIALITY

a) Confidential Information: Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

b) Client Data: "Client Data" means all information that Client, or Client's own clients, provide to or store in Client's website, client portal, dashboard and automations, including contacts, documents and tax information. Client Data belongs to Client. Provider uses Client Data only to provide the services under this Agreement, never sells it, and never uses it for Provider's own marketing. Provider protects Client Data with reasonable administrative, technical and physical safeguards appropriate to its sensitivity, and uses only service providers that are contractually bound to safeguard it. Provider will notify Client without undue delay, and in any event within seventy-two (72) hours of confirming it, of any unauthorized access to Client Data. Client remains responsible for its own obligations to its clients, including obtaining any consents the law requires. After the thirty (30) day period in Section 6(d), Provider deletes Client Data, except where the law requires Provider to keep it.

11. TERMINATION

a) Either party may terminate this Agreement with thirty (30) days' written notice, effective no earlier than the end of the Initial Term set out in Section 4(d). Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) When this Agreement ends, for any reason, Section 6(d) applies.

d) Notices: Written notice under this Agreement, including notice of termination, may be given by email — to Provider at ${NEXLI_LEGAL.email}, and to Client at the email address of Client's signer — or by mail to Provider at the address above.

12. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, with the arbitration held in the State of Florida. The arbitrator's decision shall be final and binding, and judgment on the award may be entered in any court of competent jurisdiction. Each party shall bear its own costs and attorneys' fees, except as provided in Section 2(a). Either party may seek injunctive relief in a court of competent jurisdiction to protect its intellectual property or confidential information.

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
