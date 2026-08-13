/**
 * Default engagement letter template content for the Digital Rainmaker
 * System variants and the Ad Management addendum.
 *
 * All dollar amounts are interpolated from the pricing constants in
 * drs-pricing.ts — the legal text is assembled by builder functions so the
 * contract can never drift from what the billing engine actually charges.
 */

import {
  ADS_TIERS,
  DRS_PRICING,
  STARTER_DRS_PRICING,
  type AdsTier,
} from "./drs-pricing";

// ── Formatting helpers ──────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// Dual-pricing presentation (never "fee added at checkout") — see drs-pricing.ts.
const PAYMENT_METHODS_CLAUSE = `Payments may be made via ACH bank transfer or credit/debit card, processed through Stripe. Amounts listed in this Agreement are the discounted bank transfer (ACH) prices. Credit/debit card payments are charged at the corresponding card price; the exact amount of each payment option is presented at checkout before payment.`;

const BILLED_MONTHLY_CLAUSE = "Billed monthly via ACH bank transfer or card through Stripe.";

// ── Original DRS Template ───────────────────────────────

export const ORIGINAL_DRS_TEMPLATE_NAME = "Digital Rainmaker System";

export function buildOriginalTemplate(): string {
  const initial = fmt(DRS_PRICING.INITIAL_SETUP_CENTS);
  const final = fmt(DRS_PRICING.FINAL_SETUP_CENTS);
  const monthly = fmt(DRS_PRICING.MONTHLY_SUBSCRIPTION_CENTS);
  const totalSetup = fmt(DRS_PRICING.INITIAL_SETUP_CENTS + DRS_PRICING.FINAL_SETUP_CENTS);

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

a) Initial Setup Fee: ${initial} USD — Due upon execution of this Agreement. This payment activates the Agreement and authorizes Provider to begin work.

b) Final Setup Fee: ${final} USD — Due thirty (30) calendar days after execution of this Agreement, along with the first month of the recurring subscription.

c) Monthly Subscription: ${monthly} USD/month — Recurring charge for continued access to the Digital Rainmaker System, including AI automations, dashboard access, and technical support. ${BILLED_MONTHLY_CLAUSE}

d) Total Setup Investment: ${totalSetup} USD
e) Ongoing Monthly: ${monthly} USD/month

3. PAYMENT TERMS

a) ${PAYMENT_METHODS_CLAUSE}

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the Initial Setup Fee (${initial}) is received.

d) The Monthly Subscription is month-to-month with no minimum commitment. Client may cancel at any time; however, no refunds or pro-rated credits will be issued for the current billing period. Client retains access through the end of the paid billing cycle.

4. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. The Final Setup Fee and Monthly Subscription shall become due as scheduled. Provider is not responsible for delays caused by Client's non-cooperation.

5. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the Monthly Subscription, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.

6. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

7. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.

8. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

9. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

10. TERMINATION

a) Either party may terminate the Monthly Subscription with thirty (30) days' written notice. Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) Upon termination, Client retains ownership of their website and content per Section 5(a). All access to Provider's proprietary systems ceases per Section 5(c).

11. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

12. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

13. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

14. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}

export const ORIGINAL_DRS_TEMPLATE_CONTENT = buildOriginalTemplate();

// ── Starter DRS Template ────────────────────────────────

export const STARTER_DRS_TEMPLATE_NAME = "Starter Digital Rainmaker System";

/**
 * Builds the full Starter DRS engagement letter. When an ads tier is given,
 * an "AD MANAGEMENT SERVICES" section is inserted as Section 3, all later
 * section numbers (and in-text cross-references) shift by one, and the fee
 * structure totals fold in the ad management fee.
 */
export function buildStarterTemplate(adsTier?: AdsTier): string {
  const ads = adsTier ? ADS_TIERS[adsTier] : null;
  const adsCents = ads?.cents ?? 0;
  const adsFee = ads ? fmt(ads.cents) : "";

  const initial = fmt(STARTER_DRS_PRICING.INITIAL_SETUP_CENTS);
  const final = fmt(STARTER_DRS_PRICING.FINAL_SETUP_CENTS);
  const retainer = fmt(STARTER_DRS_PRICING.MONTHLY_RETAINER_CENTS);
  const totalSetup = fmt(STARTER_DRS_PRICING.INITIAL_SETUP_CENTS + STARTER_DRS_PRICING.FINAL_SETUP_CENTS);
  const signingTotal = fmt(STARTER_DRS_PRICING.INITIAL_SETUP_CENTS + STARTER_DRS_PRICING.MONTHLY_RETAINER_CENTS + adsCents);
  const ongoing = fmt(STARTER_DRS_PRICING.MONTHLY_RETAINER_CENTS + adsCents);

  // Section numbers shift by one when the ads section is inserted as Section 3.
  const shift = ads ? 1 : 0;
  const secPayment = 3 + shift;
  const secTimeline = 4 + shift;
  const secIp = 5 + shift;
  const secAdditional = 6 + shift;
  const secLiability = 7 + shift;
  const secIndemnification = 8 + shift;
  const secConfidentiality = 9 + shift;
  const secTermination = 10 + shift;
  const secDispute = 11 + shift;
  const secLaw = 12 + shift;
  const secEntire = 13 + shift;
  const secEsig = 14 + shift;

  // Fee structure items, lettered a) b) c) … in order.
  const feeItems = [
    `Initial Setup Fee: ${initial} USD — Due upon execution of this Agreement. This payment activates the Agreement and authorizes Provider to begin work.`,
    `Monthly Retainer: ${retainer} USD/month — Recurring charge for continued access to the Starter Digital Rainmaker System, including AI automations, dashboard access, and technical support. ${BILLED_MONTHLY_CLAUSE}`,
    ...(ads
      ? [`Ad Management Fee — ${ads.label}: ${adsFee} USD/month — See Section 3 for full details.`]
      : []),
    `Total Due Upon Signing: ${signingTotal} USD (Initial Setup Fee ${initial} + First Month's Retainer ${retainer}${ads ? ` + First Month's Ad Management ${adsFee}` : ""})`,
    `Final Setup Fee: ${final} USD — Due thirty (30) calendar days after the Initial Setup Fee is paid.`,
    `Total Setup Investment: ${totalSetup} USD`,
    `Ongoing Monthly: ${ongoing} USD/month${ads ? ` (Retainer ${retainer} + Ad Management ${adsFee})` : ""}`,
  ];
  const letter = (i: number) => String.fromCharCode("a".charCodeAt(0) + i);
  // The last two items (Total Setup Investment / Ongoing Monthly) sit on
  // adjacent lines with no blank line between them, matching the original layout.
  const feeStructure = feeItems
    .map((item, i) => `${letter(i)}) ${item}`)
    .slice(0, -1)
    .join("\n\n")
    .concat(`\n${letter(feeItems.length - 1)}) ${feeItems[feeItems.length - 1]}`);

  const adsSection = ads
    ? `3. AD MANAGEMENT SERVICES

In addition to the services described in Section 1, Provider will manage paid advertising campaigns on Client's behalf under the following terms:

a) Ad Management Tier: ${ads.label}

b) Monthly Management Fee: ${adsFee} USD/month — Recurring charge for campaign management services. First month included with the Initial Setup Fee. Billed monthly alongside the Platform Retainer thereafter.

c) Recommended Client Ad Spend: ${ads.spendRange}

d) Services include: Campaign strategy, setup, and ongoing optimization; ad creative development and A/B testing; audience targeting and retargeting setup; weekly performance reporting and monthly strategy reviews; UTM tracking and conversion attribution.

e) Client is responsible for ad spend paid directly to the advertising platform (Meta, Google, etc.). Ad spend is separate from and in addition to the management fee.

`
    : "";

  return `STARTER DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Starter Digital Rainmaker System, a comprehensive digital infrastructure and automation platform, consisting of the following:

Phase 1 — Setup & Build (30 Days Maximum)

a) Website Development & Deployment — Design and build a professional website under Client's domain. Client must provide DNS editor access with their hosting provider to enable deployment.

b) Nexli Whitelabel Dashboard Setup — Configure Client's dedicated whitelabel dashboard with automated workflows and client management capabilities.

c) AI Automation Implementation — Deploy AI-powered automations including lead capture, follow-up sequences, appointment scheduling, and client communication workflows.

d) A2P 10DLC Verification — Register and verify Client's business for compliant SMS/text messaging through the Campaign Registry.

e) Payment Processing Integration — Create a Stripe account for Client or connect Client's existing payment processor via API to enable invoicing and payment collection through the dashboard.

2. FEE STRUCTURE

${feeStructure}

${adsSection}${secPayment}. PAYMENT TERMS

a) ${PAYMENT_METHODS_CLAUSE}

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the total due upon signing (${signingTotal}) is received.

d) The Monthly Retainer is month-to-month with no minimum commitment. Client may cancel at any time; however, no refunds or pro-rated credits will be issued for the current billing period. Client retains access through the end of the paid billing cycle.

${secTimeline}. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. The Final Setup Fee and Monthly Retainer shall become due as scheduled. Provider is not responsible for delays caused by Client's non-cooperation.

${secIp}. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Starter Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Starter Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the Monthly Retainer, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.

${secAdditional}. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

${secLiability}. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.

${secIndemnification}. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Starter Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

${secConfidentiality}. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

${secTermination}. TERMINATION

a) Either party may terminate the Monthly Retainer with thirty (30) days' written notice. Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) Upon termination, Client retains ownership of their website and content per Section ${secIp}(a). All access to Provider's proprietary systems ceases per Section ${secIp}(c).

${secDispute}. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

${secLaw}. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

${secEntire}. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

${secEsig}. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}

export const STARTER_DRS_TEMPLATE_CONTENT = buildStarterTemplate();

// ── Ad Management Addendum ──────────────────────────────

export function generateAdsAddendum(tier: AdsTier): string {
  const info = ADS_TIERS[tier];
  const feeFormatted = fmt(info.cents);

  return `

AD MANAGEMENT SERVICES

In addition to the services described in Section 1, Provider will manage paid advertising campaigns on Client's behalf under the following terms:

Ad Management Tier: ${info.label}
- Monthly Management Fee: ${feeFormatted} USD/month
- Recommended Client Ad Spend: ${info.spendRange}

Services include:
- Campaign strategy, setup, and ongoing optimization
- Ad creative development and A/B testing
- Audience targeting and retargeting setup
- Weekly performance reporting and monthly strategy reviews
- UTM tracking and conversion attribution

The first month's ad management fee (${feeFormatted}) is included with the Initial Setup Fee invoice. Subsequent months are billed alongside the monthly Platform Retainer.

Client is responsible for ad spend paid directly to the advertising platform (Meta, Google, etc.). Ad spend is separate from and in addition to the management fee.`;
}

// ── Starter content with ads injected ───────────────────

/**
 * Generates the full Starter DRS engagement letter content, optionally
 * including the ad management section with updated fee totals.
 */
export function generateStarterContent(adsTier?: AdsTier): string {
  return buildStarterTemplate(adsTier);
}
