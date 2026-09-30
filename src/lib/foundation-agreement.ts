/**
 * Firm Foundation Service Agreement — plain-text engagement letter body.
 *
 * Mirrors the 14-section layout and boilerplate of the Digital Rainmaker
 * System templates in ./engagement-defaults.ts, adapted to the $497/mo
 * Foundation subscription. Keep the title free of the phrase
 * "digital rainmaker" (see ./digital-rainmaker.ts template detection).
 */

import {
  FOUNDATION_LIVE_IN_DAYS,
  FOUNDATION_MIN_TERM_DAYS,
  FOUNDATION_MONTHLY_CENTS,
} from "./foundation-config";

export interface FoundationAgreementInput {
  firmName: string;
  ownerName: string;
  effectiveDate: Date;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const NUMBER_WORDS: Record<number, string> = {
  7: "seven",
  14: "fourteen",
  21: "twenty-one",
  30: "thirty",
  90: "ninety",
};

function days(n: number): string {
  const word = NUMBER_WORDS[n];
  return word ? `${word} (${n})` : `${n}`;
}

export function buildFoundationAgreementContent({
  firmName,
  ownerName,
  effectiveDate,
}: FoundationAgreementInput): string {
  const fee = money(FOUNDATION_MONTHLY_CENTS);
  const effective = effectiveDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const clientLine = ownerName && ownerName !== firmName
    ? `${firmName}, by and through ${ownerName}`
    : firmName;

  return `FIRM FOUNDATION
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of ${effective} (the "Effective Date"), by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: ${clientLine} ("Client")

1. SCOPE OF SERVICES

Provider agrees to deliver the Firm Foundation package, a hosted website and branded client portal for accounting and advisory firms, consisting of the following:

a) Custom Website — A professional website built on Nexli's premium website framework, customized to Client's brand, services, and content, and hosted by Provider on Provider's infrastructure under Client's domain.

b) Branded Client Portal — A dedicated client portal carrying Client's firm name, logo, and brand colors, including client invoicing and payment collection, engagement letters with electronic signature, secure document collection, and secure client messaging.

c) Onboarding & Training — Guided setup of the website and portal, migration of Client's initial content and branding, and training for Client's team on portal operations.

d) Excluded Services — The following are NOT included in the Firm Foundation package: paid advertising and ad management, lead generation, the AI automation layer, the Google review engine, and GoHighLevel or other CRM services. These services are available under the Digital Rainmaker System pursuant to a separate written agreement.

2. FEE STRUCTURE

a) Monthly Subscription: ${fee} USD/month — Recurring charge for the Firm Foundation package, including website hosting, the branded client portal, and technical support. Billed monthly by card via Stripe subscription.

b) First Charge: The first monthly charge is collected at signup. Subsequent charges are collected automatically on the same day of each month thereafter.

c) Statement Descriptor: Charges will appear on Client's card statement as NEXLI FOUNDATION.

d) Client Payment Processing: Payments collected from Client's own customers through the portal are processed through Client's connected Stripe account. All Stripe processing fees on those payments are borne by Client and are separate from and in addition to the Monthly Subscription.

3. PAYMENT TERMS

a) Minimum Term: This Agreement has a minimum term of ${days(FOUNDATION_MIN_TERM_DAYS)} calendar days beginning on the date of the first charge (the "Minimum Term"). Following the Minimum Term, the subscription continues on a month-to-month basis until terminated in accordance with Section 10.

b) All fees are non-refundable. No refunds or pro-rated credits will be issued for any billing period once payment is received.

c) Failed Payments: If a subscription charge fails, Client shall have ${days(7)} calendar days to update its payment method and cure the failed payment. If the payment is not cured within that period, Provider may suspend Client's access to the website and portal until all outstanding amounts are paid.

d) Client acknowledges that it reviewed and accepted these pricing and payment terms at checkout, and that its subscription and the first charge were authorized at that time.

4. TIMELINE & CLIENT COOPERATION

a) Provider shall make Client's website and client portal live within ${days(FOUNDATION_LIVE_IN_DAYS)} calendar days of receiving all required intake assets from Client, including but not limited to: logo files, website content, DNS editor access with Client's domain registrar or hosting provider, and calendar or booking link details.

b) Client agrees to provide timely cooperation, including but not limited to: intake assets, business information, brand assets, content materials, and responsiveness to Provider communications.

c) The ${days(FOUNDATION_LIVE_IN_DAYS)}-day timeline is measured from Provider's receipt of complete intake assets. Provider is not responsible for delays caused by Client's failure to provide required access, materials, or cooperation, and the Monthly Subscription shall continue to be billed as scheduled regardless of such delays.

5. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of its website content, brand assets, domain name, client data, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the client portal software, the website framework and template code, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the website framework and client portal for the duration of the active subscription. Upon termination or non-payment of the Monthly Subscription, Client's access to Provider's proprietary systems shall terminate as described in Section 5(e).

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, templates, or technology.

e) Hosting & License Term: Client's website and client portal are hosted on Provider's infrastructure for the duration of the subscription. Upon termination, Provider will deliver to Client an export of Client's website content and client data within ${days(14)} calendar days of the termination date, and Client may repoint its domain at any time. Provider may take Client's website and portal offline ${days(30)} calendar days after the termination date.

6. UPGRADE CREDIT

If Client upgrades to the Digital Rainmaker System within ${days(FOUNDATION_MIN_TERM_DAYS)} calendar days of the Effective Date, fees paid under this Agreement, up to a maximum of ${fee}, shall be credited toward the initial fees of the Digital Rainmaker System. The credit has no cash value and may not be applied to any other product or service.

7. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, client acquisition volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the website and portal.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, email providers, or hosting infrastructure providers.

8. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the website and client portal; (b) Client's violation of any applicable law or regulation, including laws governing the handling of tax and financial information; (c) any content, data, or materials provided by Client or by Client's customers through the portal.

9. CONFIDENTIALITY

a) Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.

b) Client Data: Client's customer records, documents, and tax information transmitted through the portal ("Client Data") are Confidential Information of Client. Provider will access Client Data only as necessary to provide, support, and secure the services, will not sell or disclose Client Data to third parties except to subprocessors required to deliver the services, and will maintain commercially reasonable administrative, technical, and physical safeguards to protect Client Data.

c) Client is responsible for obtaining any consents from its customers required to collect and store their information through the portal, and for complying with all laws and professional standards applicable to the handling of tax and financial information.

10. TERMINATION

a) Following the Minimum Term, either party may terminate this Agreement with ${days(30)} calendar days' written notice. Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment that remains uncured after the period described in Section 3(c), for breach of this Agreement, or for misuse of the platform.

c) Upon termination, Client retains ownership of its content and client data per Section 5(a), receives an export per Section 5(e), and all access to Provider's proprietary systems ceases per Section 5(c) and 5(e).

11. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

12. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

13. ENTIRE AGREEMENT

This Agreement, together with the pricing and payment terms accepted by Client at checkout, constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

14. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}
