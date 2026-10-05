/**
 * Default engagement letter for the Nexli Enterprise License.
 *
 * A licensed, done-for-you install of Nexli's internal operating system for
 * CPA firms, implemented over six months inside a twelve-month license. All
 * dollar amounts come from enterprise-pricing.ts so the contract can never
 * drift from what the billing engine charges. Payment is 100% up front by
 * ACH/wire (checks accepted once cleared, no cards); nothing is scheduled
 * until funds clear.
 */

import {
  ENTERPRISE,
  ENTERPRISE_TIERS,
  renewalCents,
  type EnterpriseTier,
} from "./enterprise-pricing";

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function numberWords(n: number): string {
  const words: Record<number, string> = {
    2: "two", 3: "three", 5: "five", 6: "six", 10: "ten", 12: "twelve",
    30: "thirty", 60: "sixty", 90: "ninety",
  };
  return words[n] ?? String(n);
}

function spelled(n: number): string {
  return `${numberWords(n)} (${n})`;
}

const SYSTEM_SECTION_HEADING = "1. THE LICENSED SYSTEM";
const LICENSE_SECTION_HEADING = "5. LICENSE GRANT AND RESTRICTIONS";

// Phrases every currently shipped Enterprise letter contains. ADD ONE whenever
// a clause is rewritten without changing a heading or the fee line, so the
// seeded template (templates/route.ts) is refreshed instead of drifting.
const ENTERPRISE_REVISION_MARKERS = [
  "Payment is accepted by ACH bank transfer or wire transfer only", // Oct 2026: initial revision
];

/** The Section 3(a) fee line for a tier — also the revision anchor used by the template refresh. */
export function enterpriseFeeLine(tier: EnterpriseTier): string {
  return `a) Enterprise License Fee: ${fmt(ENTERPRISE_TIERS[tier].priceCents)} USD`;
}

/**
 * True when a stored Enterprise letter matches the currently shipped revision
 * for its tier: same fee line (price changes), current section headings, and
 * every ENTERPRISE_REVISION_MARKERS phrase (clause rewrites).
 */
export function isCurrentEnterpriseRevision(content: string, tier: EnterpriseTier): boolean {
  return (
    content.includes(enterpriseFeeLine(tier)) &&
    content.includes(SYSTEM_SECTION_HEADING) &&
    content.includes(LICENSE_SECTION_HEADING) &&
    ENTERPRISE_REVISION_MARKERS.every((m) => content.includes(m))
  );
}

export function buildEnterpriseTemplate(tier: EnterpriseTier = "core"): string {
  const t = ENTERPRISE_TIERS[tier];
  const fee = fmt(t.priceCents);
  const renewal = fmt(renewalCents(tier));
  const e = ENTERPRISE;

  const scaleAdsClause = t.includesAds
    ? `

d) Advertising Operation: As part of the ${t.label} tier, Provider operates Client's advertising campaigns for the initial License Term. Advertising spend is paid by Client directly to the advertising platforms and is not part of the Enterprise License Fee.`
    : "";

  return `NEXLI ENTERPRISE LICENSE
LICENSE AND IMPLEMENTATION AGREEMENT

This License and Implementation Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")

${SYSTEM_SECTION_HEADING}

Provider licenses to Client, and installs in Client's firm, the Nexli Enterprise Operating System (the "Licensed System"): Provider's own internal, done-for-you procedures for growing and running a tax advisory firm, consisting of the following components:

a) Talent Acquisition — Provider's system for attracting, screening, hiring, and onboarding A-player talent, including how to hire efficiently in the age of artificial intelligence without over-hiring, so payroll stays lean, cash flow stays free, and profitability improves.

b) Facebook Ad Acquisition Model — Provider's paid-advertising model for bringing six- to eight-figure business owners and taxpayers into the firm as advisory clients.

c) AI Creative Generation — Provider's process for producing a continuous influx of advertising creative using artificial intelligence, including image generation with ChatGPT.

d) AI Creative Editing — Provider's process for editing and producing ad photo and video creative using Kling AI.

e) AI for Profitability — Provider's playbook for applying artificial intelligence inside the business to remove manual work and improve margins.

f) Scaling SOPs — Provider's internal standard operating procedures for efficiently scaling a CPA firm.

Not every internal procedure Provider uses is included in this Agreement. The specific documents, templates, recordings, and tools licensed hereunder (the "Licensed Materials") are those listed in Schedule A, delivered to Client at kickoff and updated by Provider during the License Term.

2. IMPLEMENTATION PROGRAM

Provider will implement the Licensed System in Client's firm and train Client's team to run it over a ${spelled(e.IMPLEMENTATION_MONTHS)} month Implementation Program:

a) Phase 1 — Intensive (days 1–${e.INTENSIVE_DAYS}): a ${spelled(e.KICKOFF_ONSITE_DAYS)} business-day kickoff week delivered on site at Client's primary office, followed by one on-site visit of ${spelled(e.MONTHLY_VISIT_DAYS)} business days in each of the following two months; installation of the advertising, creative, and talent systems; launch of Client's first campaigns; and the first hires made through the Talent Acquisition system.

b) Phase 2 — Handoff (months 4–${e.IMPLEMENTATION_MONTHS}): weekly remote implementation sessions with Client's team, during which Client's team takes operational ownership of each system with Provider coaching and correcting.

c) Phase 3 — License Support (months ${e.IMPLEMENTATION_MONTHS + 1}–${e.LICENSE_MONTHS}): Provider keeps the Licensed Materials and their updates available, holds scheduled office hours, and answers implementation questions for the remainder of the License Term.

d) Scheduling: the Implementation Program begins on the Kickoff Date, which Provider schedules with Client within ${spelled(e.KICKOFF_SCHEDULING_BUSINESS_DAYS)} business days after the Enterprise License Fee has cleared (Section 4). Reasonable travel and lodging for the on-site visits scheduled in Phase 1 are included in the Enterprise License Fee; additional on-site visits requested by Client are billed at cost with Client's prior written approval.

3. FEES

${enterpriseFeeLine(tier)} — covering the Implementation Program and the first ${spelled(e.LICENSE_MONTHS)} month License Term. The ${t.label} tier is intended for ${t.firmSize}.

b) Annual Renewal: after the initial License Term, Client may renew the license for successive ${spelled(e.LICENSE_MONTHS)} month terms at ${renewal} USD per year (${e.RENEWAL_PERCENT}% of the Enterprise License Fee), covering continued access to the Licensed Materials, updates to the Licensed System, and license support. Renewal is invoiced ${spelled(30)} days before each anniversary of the Kickoff Date and is payable on the terms in Section 4.

c) There are no setup fees. Advertising spend, payroll for hires, software subscriptions used inside Client's firm, and any additional on-site visits are Client's own costs and are not included in the Enterprise License Fee.${scaleAdsClause}

4. PAYMENT

a) The Enterprise License Fee is due in full upon execution of this Agreement.

b) Payment is accepted by ACH bank transfer or wire transfer only. A business check is accepted and is deemed paid when the funds have cleared into Provider's account (typically ${spelled(e.CHECK_CLEARING_BUSINESS_DAYS)} business days). Credit and debit card payments are not accepted for this Agreement.

c) This Agreement does not become effective, and Provider has no obligation to schedule the Kickoff Date or to begin any work, until the Enterprise License Fee has cleared into Provider's account.

d) Once cleared, the Enterprise License Fee is non-refundable. No refunds or pro-rated credits will be issued for any reason, including early termination by Client.

${LICENSE_SECTION_HEADING}

a) Grant: Subject to payment and Client's compliance with this Agreement, Provider grants Client a non-exclusive, non-transferable, non-sublicensable license to use the Licensed Materials internally, within the firm named above and its offices, for a License Term of ${spelled(e.LICENSE_MONTHS)} months beginning on the Kickoff Date, and for any renewal term paid for under Section 3(b).

b) Restrictions: Client shall not sell, resell, license, sublicense, rent, lend, publish, or otherwise distribute the Licensed Materials; shall not teach, coach, consult on, or deliver the Licensed System to any third party; shall not use the Licensed Materials to build a competing training, licensing, or consulting product; and shall not remove Provider's ownership notices. These restrictions survive termination or expiration of this Agreement.

c) Ownership: The Licensed System and the Licensed Materials, including all updates and any procedures Provider creates or adapts during the engagement, are and remain the intellectual property of Nexli Automation LLC. Client's own client data, hires, advertising accounts, and the campaigns and creative produced for Client's firm belong to Client.

d) After the License Term: if Client does not renew, Client may continue to use, for internal purposes only, the Licensed Materials delivered during a paid term, but is no longer entitled to updates, new materials, or support, and the restrictions in Section 5(b) continue to apply.

6. CLIENT OBLIGATIONS

a) Client shall designate an executive sponsor with authority to make hiring, advertising, and operational decisions, and shall make its leadership and team available for the kickoff week, the on-site visits, and the weekly implementation sessions.

b) Client is responsible for funding the hires, advertising spend, and software the Licensed System calls for, and for providing Provider with the systems access, business information, and brand assets needed to implement it.

c) Client shall provide suitable on-site working space for Provider's team during on-site visits.

d) Provider is not responsible for delays caused by Client's unavailability or non-cooperation, and the Implementation Program schedule extends day-for-day for any such delay.

7. CONFIDENTIALITY AND NON-SOLICITATION

a) Both parties agree to maintain the confidentiality of proprietary information disclosed during this engagement. The Licensed Materials are Provider's confidential information. This obligation survives termination of this Agreement.

b) During the License Term and for ${spelled(e.NON_SOLICIT_MONTHS)} months after it ends, Client shall not directly or indirectly solicit for employment or engagement any employee or contractor of Provider whom Client met through this engagement.

8. NO GUARANTEE OF RESULTS

Provider will implement the Licensed System with professional care and will train Client's team to operate it. Provider does not guarantee specific business results, revenue, hiring outcomes, advertising performance, or return on investment. Results depend on Client's market, Client's team, and Client's execution of the Licensed System.

9. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the fees actually paid by Client to Provider in the ${spelled(12)} months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider is not liable for any third-party platform or service, including but not limited to Meta, Google, OpenAI, Kling AI, Stripe, DNS providers, or telecommunications carriers.

10. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Licensed System; (b) Client's hiring, advertising, and business decisions; (c) Client's violation of any applicable law or regulation; or (d) any content, data, or materials provided by Client.

11. TERMINATION

a) Provider may terminate this Agreement and the license immediately upon Client's breach of Section 5 or Section 7, or upon non-payment.

b) Client may terminate this Agreement for Provider's material breach that remains uncured ${spelled(30)} days after Client's written notice describing the breach.

c) Upon termination for Client's breach, Client's license ends and Client shall cease all use of the Licensed Materials. Sections 4(d), 5(b), 5(c), 7, 9, and 10 survive any termination or expiration of this Agreement.

12. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.

13. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.

14. ENTIRE AGREEMENT

This Agreement, together with Schedule A, constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.

15. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;
}

/** Seeded default (Core tier); the compose UI regenerates per tier. */
export const ENTERPRISE_TEMPLATE_CONTENT = buildEnterpriseTemplate("core");

export function generateEnterpriseContent(tier: EnterpriseTier = "core"): string {
  return buildEnterpriseTemplate(tier);
}
