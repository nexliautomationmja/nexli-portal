/**
 * Default engagement letter template content for the Digital Rainmaker System.
 *
 * One flat all-in-one price ($4,997/mo or $44,997/yr prepaid) plus a separate,
 * performance-based ad management arrangement. All dollar amounts are
 * interpolated from the pricing constants in drs-pricing.ts so the contract
 * can never drift from what the billing engine actually charges.
 */

import { DRS_PRICING, AD_PERFORMANCE, type BillingPlan } from "./drs-pricing";

// ── Formatting helpers ──────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// Dual-pricing presentation (never "fee added at checkout") — see drs-pricing.ts.
const PAYMENT_METHODS_CLAUSE = `Payments may be made via ACH bank transfer or credit/debit card, processed through Stripe. Amounts listed in this Agreement are the discounted bank transfer (ACH) prices. Credit/debit card payments are charged at the corresponding card price; the exact amount of each payment option is presented at checkout before payment.`;

// ── Digital Rainmaker System Template ───────────────────

export const DRS_TEMPLATE_NAME = "Digital Rainmaker System";

/**
 * Builds the full DRS engagement letter for the chosen billing plan. The fee
 * structure is a single flat all-in-one investment — monthly or annual
 * prepaid — with no setup fees. Ad management is a separate, performance-based
 * arrangement (Section 3). Section numbering is identical for both plans.
 */
export function buildDrsTemplate(plan: BillingPlan = "monthly"): string {
  const monthly = fmt(DRS_PRICING.MONTHLY_CENTS);
  const annual = fmt(DRS_PRICING.ANNUAL_CENTS);
  const monthlyAnnualized = fmt(DRS_PRICING.MONTHLY_CENTS * 12);
  const adPct = AD_PERFORMANCE.PERCENT_OF_CLOSED_DEAL;
  const service = AD_PERFORMANCE.ADVERTISED_SERVICE;

  const feeStructure =
    plan === "annual"
      ? `a) Annual Investment (Paid in Full): ${annual} USD/year — Due upon execution of this Agreement. This all-in-one investment covers the complete Digital Rainmaker System — website, AI automations, dashboard access, and technical support — for twelve (12) months, and reflects a savings versus the ${monthlyAnnualized} USD payable at the monthly rate. Billed via ACH bank transfer or card through Stripe, and renews annually unless canceled.

b) There are no separate setup fees. This payment activates the Agreement and authorizes Provider to begin work.`
      : `a) Monthly Investment: ${monthly} USD/month — All-in-one recurring investment covering the complete Digital Rainmaker System, including the website, AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer or card through Stripe.

b) There are no separate setup fees. The first monthly payment is due upon execution of this Agreement and activates the Agreement, authorizing Provider to begin work.`;

  return `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure and automation platform, consisting of the following:

Phase 1 — Setup & Build (30 Days Maximum)

a) Website Development & Deployment — Design and build a professional website under Client's domain. Client must provide DNS editor access with their hosting provider to enable deployment.

b) Nexli Whitelabel Dashboard Setup — Configure Client's dedicated whitelabel dashboard with automated workflows and client management capabilities.

c) AI Automation Implementation — Deploy AI-powered automations including lead capture, follow-up sequences, appointment scheduling, and client communication workflows.

d) A2P 10DLC Verification — Register and verify Client's business for compliant SMS/text messaging through the Campaign Registry.

e) Payment Processing Integration — Create a Stripe account for Client or connect Client's existing payment processor via API to enable invoicing and payment collection through the dashboard.

2. FEE STRUCTURE

${feeStructure}

3. AD MANAGEMENT (PERFORMANCE-BASED)

Ad management is an optional, separate, performance-based service. Provider only earns when the advertising produces closed business:

a) Performance Fee: Provider shall be paid a performance fee equal to ${adPct}% of the closed deal value of each ${service} engagement that is generated through Provider-managed advertising campaigns and attributed via the Nexli tracking system. The fee applies to ${service} deals; other services Client may sell to those clients are outside this fee.

b) No Ad Management Retainer: There is no monthly ad management fee. Provider is paid solely on the ${adPct}% performance basis described above — if the advertising does not produce a closed ${service} deal, no performance fee is owed.

c) Ad Spend: Client is responsible for ad spend paid directly to the advertising platform (Meta, Google, etc.). Ad spend is the Client's own budget and is separate from and in addition to the performance fee.

d) Attribution & Reporting: Closed deals are attributed using the Nexli tracking system (UTM tracking and conversion attribution). Provider will provide performance reporting so both parties can see which deals are attributable to the advertising.

4. PAYMENT TERMS

a) ${PAYMENT_METHODS_CLAUSE}

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the ${plan === "annual" ? `Annual Investment (${annual})` : `first Monthly Investment (${monthly})`} is received.

d) The platform investment is ${plan === "annual" ? "billed annually and renews each year" : "month-to-month with no minimum commitment"}. Client may cancel at any time; however, no refunds or pro-rated credits will be issued for the current billing period. Client retains access through the end of the paid billing cycle.

5. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications.

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

a) Either party may terminate the platform investment with thirty (30) days' written notice. Access continues through the end of the current paid billing cycle.

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

/**
 * Generates the full DRS engagement letter content for the chosen billing plan.
 */
export function generateDrsContent(plan: BillingPlan = "monthly"): string {
  return buildDrsTemplate(plan);
}
