/**
 * Default engagement letter template content for the Digital Rainmaker System.
 *
 * Platform price $5,000/mo or $42,000/yr prepaid, plus a $5,000/mo Managed
 * Advertising Budget that Nexli deploys on the client's behalf (pass-through).
 * Ad management included, no revenue share; the only performance-based
 * compensation is the milestone Success Bonus. Initial term 6 months
 * (monthly) / 12 months (annual). All dollar amounts are interpolated from
 * the pricing constants in drs-pricing.ts so the contract can never drift
 * from what the billing engine actually charges.
 */

import {
  DRS_PRICING,
  TOTAL_MONTHLY_CENTS,
  TERM_MONTHS,
  ADVERTISED_SERVICE,
  SUCCESS_BONUS,
  successBonusSchedule,
  TRIPLE_GUARANTEE,
  type BillingPlan,
} from "./drs-pricing";

// ── Formatting helpers ──────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function fmtWhole(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

// Dual-pricing presentation (never "fee added at checkout") — see drs-pricing.ts.
const PAYMENT_METHODS_CLAUSE = `Payments may be made via ACH bank transfer or credit/debit card, processed through Stripe. Amounts listed in this Agreement are the discounted bank transfer (ACH) prices. Credit/debit card payments are charged at the corresponding card price; the exact amount of each payment option is presented at checkout before payment. The card price applies to the full invoiced amount, including any Managed Advertising Budget.`;

/** "six (6)" style wording for the term length. */
function termWords(months: number): string {
  const words: Record<number, string> = { 3: "three", 6: "six", 9: "nine", 12: "twelve", 18: "eighteen", 24: "twenty-four" };
  return words[months] ? `${words[months]} (${months})` : `${months} (${months})`;
}

// ── Digital Rainmaker System Template ───────────────────

export const DRS_TEMPLATE_NAME = "Digital Rainmaker System";

/**
 * Builds the full DRS engagement letter for the chosen billing plan. The fee
 * structure is a flat all-in-one Platform Investment — monthly or annual
 * prepaid — with no setup fees, covering the buildout AND ongoing
 * maintenance, plus the Managed Advertising Budget (Section 3(b)). Ad
 * management is included with no revenue share; the only performance-based
 * compensation is the milestone Success Bonus (Section 3). The Initial Term
 * is in Section 5(d). The Nexli Triple Guarantee (Section 4) carves out
 * express exceptions to the no-refund/no-credit and no-results-guarantee
 * clauses. Section numbering is identical for both plans.
 */

/** The Section 2(a) fee line for a plan — also the revision anchor used by the template refresh. */
export function drsFeeLine(plan: BillingPlan): string {
  return plan === "annual"
    ? `a) Annual Investment (Paid in Full): ${fmt(DRS_PRICING.ANNUAL_CENTS)} USD/year`
    : `a) Monthly Investment: ${fmt(TOTAL_MONTHLY_CENTS)} USD/month`;
}

const AD_SECTION_HEADING = "3. AD MANAGEMENT & SUCCESS BONUS";
const GUARANTEE_SECTION_HEADING = "4. THE NEXLI TRIPLE GUARANTEE";

// Phrases every currently shipped letter contains. ADD ONE whenever a clause
// is rewritten without changing a heading or the fee line, so the stored
// seeded templates (templates/route.ts) are refreshed instead of drifting.
const CURRENT_REVISION_MARKERS = [
  "Success Bonus on Termination", // Sep 20 2026: non-stacking bonus, billed at year end or departure
  "Managed Advertising Budget", // Oct 5 2026: $5,000/mo ad budget collected by Nexli (Sections 2, 3(b))
  "Initial Term and Renewal", // Oct 5 2026: 6/12-month initial term (Section 5(d))
];

/**
 * True when a stored DRS letter matches the currently shipped revision for
 * its plan: same fee line (so any price change is detected), the current
 * Section 3 and Section 4 headings, and every CURRENT_REVISION_MARKERS
 * phrase (so clause rewrites are detected).
 */
export function isCurrentDrsRevision(content: string, plan: BillingPlan): boolean {
  return (
    content.includes(drsFeeLine(plan)) &&
    content.includes(AD_SECTION_HEADING) &&
    content.includes(GUARANTEE_SECTION_HEADING) &&
    CURRENT_REVISION_MARKERS.every((m) => content.includes(m))
  );
}

export function buildDrsTemplate(plan: BillingPlan = "monthly"): string {
  const monthly = fmt(DRS_PRICING.MONTHLY_CENTS);
  const annual = fmt(DRS_PRICING.ANNUAL_CENTS);
  const monthlyAnnualized = fmt(DRS_PRICING.MONTHLY_CENTS * 12);
  const totalMonthly = fmt(TOTAL_MONTHLY_CENTS);
  const adSpend = fmt(DRS_PRICING.AD_SPEND_MONTHLY_CENTS);
  const term = TERM_MONTHS[plan];
  const service = ADVERTISED_SERVICE;
  const g = TRIPLE_GUARANTEE;
  const launchCredit = fmt(g.LAUNCH_CREDIT_CENTS);
  const bonusPct = SUCCESS_BONUS.BONUS_PERCENT_OF_MILESTONE;
  const bonusSchedule = successBonusSchedule()
    .map(
      (t) =>
        `— When Attributed Revenue in a Contract Year reaches ${fmtWhole(t.milestoneCents)}: one-time bonus of ${fmt(t.bonusCents)} USD`
    )
    .join("\n\n");

  const feeStructure =
    plan === "annual"
      ? `${drsFeeLine("annual")} — Due upon execution of this Agreement. This all-in-one Platform Investment covers the buildout and ongoing maintenance of the complete Digital Rainmaker System — website, AI automations, dashboard access, ad management, and technical support — for twelve (12) months, and reflects a savings versus the ${monthlyAnnualized} USD payable at the monthly rate. Billed via ACH bank transfer or card through Stripe, and renews annually unless terminated under Section 12.

b) Managed Advertising Budget: ${adSpend} USD/month — Billed monthly beginning upon execution of this Agreement and deployed by Provider on Client's behalf under Section 3(b). Billed via ACH bank transfer or card through Stripe.

c) There are no separate setup fees. The Annual Investment payment activates the Agreement and authorizes Provider to begin work.

d) Initial Term: ${termWords(term)} months from the effective date, as set out in Section 5(d).`
      : `${drsFeeLine("monthly")} — Comprising (i) a Platform Investment of ${monthly} USD/month, the all-in-one recurring investment covering the buildout and ongoing maintenance of the complete Digital Rainmaker System, including the website, AI automations, dashboard access, ad management, and technical support; and (ii) a Managed Advertising Budget of ${adSpend} USD/month that Provider deploys on Client's behalf under Section 3(b). Billed as a single monthly invoice via ACH bank transfer or card through Stripe.

b) There are no separate setup fees. The first Monthly Investment is due upon execution of this Agreement and activates the Agreement, authorizing Provider to begin work.

c) Initial Term: ${termWords(term)} months from the effective date, as set out in Section 5(d).`;

  return `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure and automation platform, consisting of the following:

Phase 1 — Setup & Build (launched within ${g.LAUNCH_DAYS} days of Provider receiving all required client materials per the Section 4(b) guarantee; 30 days maximum)

a) Website Development & Deployment — Design and build a professional website under Client's domain. Client must provide DNS editor access with their hosting provider to enable deployment.

b) Nexli Whitelabel Dashboard Setup — Configure Client's dedicated whitelabel dashboard with automated workflows and client management capabilities.

c) AI Automation Implementation — Deploy AI-powered automations including lead capture, follow-up sequences, appointment scheduling, and client communication workflows.

d) A2P 10DLC Verification — Register and verify Client's business for compliant SMS/text messaging through the Campaign Registry.

e) Payment Processing Integration — Create a Stripe account for Client or connect Client's existing payment processor via API to enable invoicing and payment collection through the dashboard.

2. FEE STRUCTURE

${feeStructure}

${AD_SECTION_HEADING}

a) Ad Management Included: Provider manages Client's advertising campaigns (the "acquisition system") as part of the Platform Investment in Section 2. There is no ad management retainer, no setup fee, and no percentage of Client's revenue charged for this service.

b) Managed Advertising Budget: Client funds a Managed Advertising Budget of ${adSpend} USD per month, billed by Provider as set out in Section 2, which Provider deploys on Client's behalf to the advertising platforms (Meta, Google, etc.) at Provider's discretion in pursuit of the Section 4(a) guarantee. The budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider reports the budget deployed to date in its weekly updates to Client. Any portion of the budget not deployed in a given month carries forward and is deployed in subsequent months. Upon termination or expiration of this Agreement, any undeployed balance is deployed on Client's campaigns through the end of the then-current term or notice period and is not refundable. The budget may be increased only upon Client's written authorization.

c) Success Bonus: "Attributed Revenue" means revenue actually collected by Client from tax advisory clients generated through Provider-managed advertising campaigns and attributed via the Nexli tracking system. Client's pre-existing clients, and ${service} engagements not attributable to the acquisition system, are excluded. "Contract Year" means each successive twelve (12) month period beginning on the effective date of this Agreement; cumulative Attributed Revenue resets to zero at the start of each Contract Year. For each Contract Year, Client shall pay Provider a single Success Bonus equal to ${bonusPct}% of the highest milestone below that cumulative Attributed Revenue reached during that Contract Year. Milestone bonuses do not stack — only the bonus for the highest milestone reached applies. No Success Bonus is owed for a Contract Year in which cumulative Attributed Revenue does not reach the first milestone. The Success Bonus is invoiced by Provider at the earlier of (i) the last day of the Contract Year or (ii) the effective date of termination of this Agreement or cessation of the Services for any reason, and is due within fifteen (15) days of the invoice date.

Only the bonus for the highest milestone reached applies:

${bonusSchedule}

d) Attribution & Reporting: Attributed Revenue is measured using the Nexli tracking system (UTM tracking and conversion attribution). Provider will provide performance reporting so both parties can see which clients and revenue are attributable to the advertising and where cumulative Attributed Revenue stands against the milestones above.

${GUARANTEE_SECTION_HEADING}

Provider stands behind the Digital Rainmaker System with the following three guarantees, offered so Client can start with confidence. If any provision of this Section 4 conflicts with any other provision of this Agreement (including the non-refundability and no-credit provisions of Section 5 and the results disclaimer in Section 9), this Section 4 controls.

a) ${g.QUALIFIED_OPPORTUNITIES} Qualified Advisory Opportunities in ${g.OPPORTUNITY_WINDOW_DAYS} Days: Provider guarantees at least ${g.QUALIFIED_OPPORTUNITIES} qualified tax advisory opportunities on Client's calendar within ${g.OPPORTUNITY_WINDOW_DAYS} days of campaign launch. If Provider does not hit that target, Provider continues working for free until it does — for monthly plans, Monthly Investment billing is suspended until the target is reached; for annual plans, the Agreement term is extended at no additional charge until the target is reached. This guarantee applies while Client's advertising campaigns remain active and Client is meeting its cooperation obligations under Section 6.

b) ${g.LAUNCH_DAYS}-Day Launch Guarantee: Once Provider has received all required assets, access, approvals, and onboarding information from Client, Provider guarantees Client's acquisition system will be built and launched within ${g.LAUNCH_DAYS} days. If Provider misses that deadline because of delays on Provider's end, Client receives a ${launchCredit} credit ${plan === "annual" ? "applied, at Client's election, toward Client's next invoice from Provider or refunded to Client within thirty (30) days" : "toward Client's next monthly payment"}.

c) Flat-Rate, No Revenue Share: The Platform Investment in Section 2 is Provider's only fee for its services; the Managed Advertising Budget is passed through to the advertising platforms at no markup and is not Provider's compensation. Provider never takes a percentage of Client's revenue and never charges a fee per client the advertising brings in. The only performance-based compensation under this Agreement is the Success Bonus in Section 3(c), which is owed solely after Provider's acquisition system has already produced the milestone revenue for Client, whether billed at the end of the Contract Year or on termination.

5. PAYMENT TERMS

a) ${PAYMENT_METHODS_CLAUSE}

b) Except as expressly provided in Section 4 (The Nexli Triple Guarantee), all fees are non-refundable and no refunds will be issued once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the ${plan === "annual" ? `Annual Investment (${annual})` : `first Monthly Investment (${totalMonthly})`} is received.

d) Initial Term and Renewal: This Agreement has an Initial Term of ${termWords(term)} months from the effective date. Advertising systems typically need ninety (90) days or more to mature, and the Initial Term exists so the acquisition system has the time it needs to produce results for Client. Either party may give thirty (30) days' written notice of termination at any time, but termination takes effect no earlier than the end of the Initial Term, and billing under Section 2 continues through that date. After the Initial Term this Agreement continues ${plan === "annual" ? "for successive twelve (12) month renewal terms" : "month-to-month"} until terminated on thirty (30) days' written notice. Except as expressly provided in Section 4 (The Nexli Triple Guarantee), no refunds or pro-rated credits will be issued for any billing period. Client retains access through the end of the paid billing cycle.

6. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution, with launch due within ${g.LAUNCH_DAYS} days of Provider's receipt of all required client materials per the Section 4(b) guarantee.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications. Client shall submit all onboarding items requested on Provider's Launch Pad (including payment processing setup, DNS access, and the other items listed there) within five (5) days of receiving the Launch Pad link; the ${g.LAUNCH_DAYS}-day launch guarantee in Section 4(b) runs from Provider's receipt of all such items.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. Provider is not responsible for delays caused by Client's non-cooperation.

7. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the platform investment, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.

8. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

9. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Except as expressly set forth in Section 4 (The Nexli Triple Guarantee), Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.

10. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

11. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

12. TERMINATION

a) Either party may terminate this Agreement with thirty (30) days' written notice, effective no earlier than the end of the Initial Term set out in Section 5(d). Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) Upon termination, Client retains ownership of their website and content per Section 7(a). All access to Provider's proprietary systems ceases per Section 7(c).

d) Success Bonus on Termination: If this Agreement terminates or Client discontinues the Services for any reason before the end of a Contract Year, the Success Bonus for the highest milestone reached in that Contract Year as of the termination date becomes due and is invoiced at termination per Section 3(c). This obligation survives termination of this Agreement.

13. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

14. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

15. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

16. ELECTRONIC SIGNATURES

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
