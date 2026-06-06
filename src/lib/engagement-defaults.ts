/**
 * Default engagement letter template content for the Digital Rainmaker
 * System variants and the Ad Management addendum.
 */

import { ADS_TIERS, type AdsTier } from "./digital-rainmaker";

// ── Original DRS Template ───────────────────────────────

export const ORIGINAL_DRS_TEMPLATE_NAME = "Digital Rainmaker System";

export const ORIGINAL_DRS_TEMPLATE_CONTENT = `DIGITAL RAINMAKER SYSTEM
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

a) Initial Setup Fee: $10,000.00 USD — Due upon execution of this Agreement. This payment activates the Agreement and authorizes Provider to begin work.

b) Final Setup Fee: $10,000.00 USD — Due thirty (30) calendar days after execution of this Agreement, along with the first month of the recurring subscription.

c) Monthly Subscription: $997.00 USD/month — Recurring charge for continued access to the Digital Rainmaker System, including AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer.

d) Total Setup Investment: $20,000.00 USD
e) Ongoing Monthly: $997.00 USD/month

3. PAYMENT TERMS

a) All payments are processed via ACH bank transfer through Stripe.

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the Initial Setup Fee ($10,000.00) is received.

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

// ── Starter DRS Template ────────────────────────────────

export const STARTER_DRS_TEMPLATE_NAME = "Starter Digital Rainmaker System";

export const STARTER_DRS_TEMPLATE_CONTENT = `STARTER DIGITAL RAINMAKER SYSTEM
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

a) Initial Setup Fee: $7,500.00 USD — Due upon execution of this Agreement. This payment activates the Agreement and authorizes Provider to begin work.

b) Monthly Retainer: $997.00 USD/month — Recurring charge for continued access to the Starter Digital Rainmaker System, including AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer.

c) Total Due Upon Signing: $8,497.00 USD (Initial Setup Fee $7,500.00 + First Month's Retainer $997.00)

d) Final Setup Fee: $7,500.00 USD — Due thirty (30) calendar days after the Initial Setup Fee is paid.

e) Total Setup Investment: $15,000.00 USD
f) Ongoing Monthly: $997.00 USD/month

3. PAYMENT TERMS

a) All payments are processed via ACH bank transfer through Stripe.

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the total due upon signing ($8,497.00) is received.

d) The Monthly Retainer is month-to-month with no minimum commitment. Client may cancel at any time; however, no refunds or pro-rated credits will be issued for the current billing period. Client retains access through the end of the paid billing cycle.

4. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. The Final Setup Fee and Monthly Retainer shall become due as scheduled. Provider is not responsible for delays caused by Client's non-cooperation.

5. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Starter Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Starter Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the Monthly Retainer, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.

6. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.

7. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.

8. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Starter Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.

9. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

10. TERMINATION

a) Either party may terminate the Monthly Retainer with thirty (30) days' written notice. Access continues through the end of the current paid billing cycle.

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

// ── Ad Management Addendum ──────────────────────────────

export function generateAdsAddendum(tier: AdsTier): string {
  const info = ADS_TIERS[tier];
  const feeFormatted = `$${(info.cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

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
 * including the ad management addendum with updated fee totals.
 */
export function generateStarterContent(adsTier?: AdsTier): string {
  let content = STARTER_DRS_TEMPLATE_CONTENT;

  if (!adsTier) return content;

  const info = ADS_TIERS[adsTier];
  const adsFee = info.cents / 100;
  const feeFormatted = `$${adsFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const monthlyTotal = 997 + adsFee;
  const signingTotal = 7500 + 997 + adsFee;

  // 1. Insert ads addendum as a new section before Section 3 (PAYMENT TERMS)
  const paymentTermsIndex = content.indexOf("3. PAYMENT TERMS");
  if (paymentTermsIndex !== -1) {
    const adsSection = `3. AD MANAGEMENT SERVICES

In addition to the services described in Section 1, Provider will manage paid advertising campaigns on Client's behalf under the following terms:

a) Ad Management Tier: ${info.label}

b) Monthly Management Fee: ${feeFormatted} USD/month — Recurring charge for campaign management services. First month included with the Initial Setup Fee. Billed monthly alongside the Platform Retainer thereafter.

c) Recommended Client Ad Spend: ${info.spendRange}

d) Services include: Campaign strategy, setup, and ongoing optimization; ad creative development and A/B testing; audience targeting and retargeting setup; weekly performance reporting and monthly strategy reviews; UTM tracking and conversion attribution.

e) Client is responsible for ad spend paid directly to the advertising platform (Meta, Google, etc.). Ad spend is separate from and in addition to the management fee.

`;
    // Insert ads section and renumber subsequent sections
    content = content.slice(0, paymentTermsIndex) + adsSection + content.slice(paymentTermsIndex);

    // Renumber sections 3-14 → 4-15
    for (let i = 14; i >= 3; i--) {
      content = content.replace(new RegExp(`^${i}\\. `, "gm"), `${i + 1}. `);
    }
    // Fix the ads section number back to 3
    content = content.replace("4. AD MANAGEMENT SERVICES", "3. AD MANAGEMENT SERVICES");
  }

  // 2. Update fee structure section 2 to include ads line item
  content = content.replace(
    `b) Monthly Retainer: $997.00 USD/month — Recurring charge for continued access to the Starter Digital Rainmaker System, including AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer.

c) Total Due Upon Signing: $8,497.00 USD (Initial Setup Fee $7,500.00 + First Month's Retainer $997.00)`,
    `b) Monthly Retainer: $997.00 USD/month — Recurring charge for continued access to the Starter Digital Rainmaker System, including AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer.

c) Ad Management Fee — ${info.label}: ${feeFormatted} USD/month — See Section 3 for full details.

d) Total Due Upon Signing: $${signingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD (Initial Setup Fee $7,500.00 + First Month's Retainer $997.00 + First Month's Ad Management ${feeFormatted})`
  );

  // Update lettering after the inserted item
  content = content.replace(
    `d) Final Setup Fee: $7,500.00 USD`,
    `e) Final Setup Fee: $7,500.00 USD`
  );

  content = content.replace(
    `e) Total Setup Investment: $15,000.00 USD
f) Ongoing Monthly: $997.00 USD/month`,
    `f) Total Setup Investment: $15,000.00 USD
g) Ongoing Monthly: $${monthlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD/month (Retainer $997.00 + Ad Management ${feeFormatted})`
  );

  // 3. Update payment terms to reflect ads in initial payment
  content = content.replace(
    `This Agreement does not become effective and Provider has no obligation to begin work until the total due upon signing ($8,497.00) is received.`,
    `This Agreement does not become effective and Provider has no obligation to begin work until the total due upon signing ($${signingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}) is received.`
  );

  return content;
}
