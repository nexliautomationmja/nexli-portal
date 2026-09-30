/**
 * Starter engagement letter templates seeded into every Firm Foundation
 * account so the firm can send its own engagement letters on day one.
 *
 * Bodies use `{{firmName}}` placeholders and are rendered per firm at seed
 * time. Names must NOT contain "digital rainmaker" (see ./digital-rainmaker.ts).
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";

export interface CpaTemplate {
  name: string;
  content: string;
}

const INDIVIDUAL_TAX = `INDIVIDUAL TAX PREPARATION
ENGAGEMENT LETTER

Dear Client,

Thank you for choosing {{firmName}} ("the Firm," "we," or "us") to assist you with your tax needs. This letter confirms the terms of our engagement and the nature and limitations of the services we will provide. Please review it carefully and sign below to confirm your acceptance.

1. SCOPE OF SERVICES

a) We will prepare your federal individual income tax return (Form 1040) and the state and local income tax returns you identify to us for the tax year indicated on your organizer.

b) We will prepare the returns from information you provide. We will not audit, review, or otherwise verify the information you furnish, although we may ask you to clarify certain items.

c) Our engagement does not include responding to inquiries or examinations by taxing authorities, tax planning, bookkeeping, or the preparation of any return not listed above. Those services are available under a separate engagement.

2. CLIENT RESPONSIBILITIES

a) You are responsible for providing complete and accurate information, including all Forms W-2, 1099, 1098, K-1, brokerage statements, and records of income, deductions, and credits, on a timely basis.

b) You are responsible for maintaining adequate records to substantiate the items reported on your returns. Deductions for travel, meals, vehicle use, and charitable contributions require documentation that meets IRS requirements.

c) You must disclose to us any interest in or signature authority over foreign financial accounts, foreign assets, digital assets, or foreign trusts, as these carry separate reporting obligations and substantial penalties for non-compliance.

d) You are responsible for reviewing the completed returns before they are filed. By signing the e-file authorization form, you confirm that you have reviewed the returns and that they are true, correct, and complete to the best of your knowledge.

3. FEES

Our fees for this engagement are based on the forms and schedules required and the complexity of your return. Our estimated fee will be quoted before work begins. Fees are due upon completion of the returns and prior to filing. Additional charges may apply for amended returns, responses to tax notices, or work resulting from incomplete or late information.

4. LIMITATIONS AND TAX POSITIONS

a) Tax law is subject to interpretation. Where a position is uncertain, we will advise you of the options and the risks involved. We will not take a position on a return that lacks substantial authority or a reasonable basis with adequate disclosure.

b) Penalties may be imposed by taxing authorities for late filing, late payment, understatement of tax, or negligence. You are responsible for any tax, penalties, and interest assessed on your returns.

c) Our engagement is limited to the tax year identified above and ends upon delivery of the completed returns. We are not obligated to inform you of subsequent changes in tax law that may affect you.

5. RECORDS RETENTION

We will return your original records to you upon completion of the engagement. We will retain copies of your returns and our workpapers for a period of seven (7) years, after which they may be destroyed. It is your responsibility to retain your original documents and copies of your filed returns.

6. CONFIDENTIALITY

We will treat all information you provide as confidential and will not disclose it to third parties without your written consent, except as required by law or professional standards, or as necessary to complete the services (for example, to secure electronic filing and document storage providers).

7. TERMINATION

Either party may terminate this engagement at any time by written notice. If the engagement is terminated before the returns are completed, you agree to pay for services rendered through the termination date. We reserve the right to withdraw from the engagement if you fail to provide requested information or if we determine that continuing would conflict with professional standards.

8. ELECTRONIC SIGNATURES AND ACCEPTANCE

The parties agree that electronic signatures are legally binding under the ESIGN Act and the Uniform Electronic Transactions Act. Your electronic signature below confirms that you have read, understand, and agree to the terms of this engagement letter.

We appreciate the opportunity to serve you and look forward to working with you.

Sincerely,

{{firmName}}`;

const BUSINESS_TAX = `BUSINESS TAX PREPARATION
ENGAGEMENT LETTER

Dear Client,

Thank you for engaging {{firmName}} ("the Firm," "we," or "us") to prepare the income tax returns for your business. This letter confirms the terms of our engagement and the nature and limitations of the services we will provide.

1. SCOPE OF SERVICES

a) We will prepare the federal income tax return for your business entity (Form 1120, 1120-S, 1065, or Schedule C, as applicable) and the state and local income and franchise tax returns you identify to us for the tax year indicated.

b) Where applicable, we will prepare Schedules K-1 for the owners, partners, or shareholders of the entity.

c) We will prepare the returns from the trial balance, financial statements, and supporting information you provide. We will not audit, review, or compile your financial statements, and we will not verify the accuracy or completeness of the information you furnish.

d) Our engagement does not include bookkeeping, payroll tax filings, sales tax filings, responses to tax notices or examinations, or tax planning, unless separately agreed in writing.

2. CLIENT RESPONSIBILITIES

a) You are responsible for maintaining the books and records of the business, including a year-end trial balance, general ledger, bank and credit card statements, fixed asset additions and disposals, loan statements, and payroll reports, and for providing them to us on a timely basis.

b) You are responsible for the design and operation of internal controls, for the proper classification of workers as employees or independent contractors, and for the issuance of required information returns (Forms W-2 and 1099).

c) You must disclose any ownership of or transactions with foreign entities, foreign bank accounts, or digital assets, and any related-party transactions, as these carry separate reporting obligations.

d) You are responsible for reviewing the completed returns before they are filed. By signing the e-file authorization form, an authorized officer, partner, or member confirms that the returns are true, correct, and complete to the best of their knowledge.

3. FEES

Our fees are based on the forms required, the condition of the books and records, and the time required to complete the engagement. An estimate will be provided before work begins. Substantial additional time to reconcile or correct the books before the return can be prepared will be billed at our standard hourly rates. Fees are due upon completion and prior to filing.

4. LIMITATIONS AND TAX POSITIONS

a) Tax law is subject to interpretation. We will advise you of alternative positions and the associated risks, and will not take a position that lacks substantial authority or a reasonable basis with adequate disclosure.

b) Penalties may be assessed for late filing, late payment, understatement of tax, failure to file information returns, or negligence. The business and its owners are responsible for any tax, penalties, and interest assessed.

c) Our engagement is limited to the tax year identified above and ends upon delivery of the completed returns. We are not obligated to inform you of subsequent changes in tax law.

5. RECORDS RETENTION

We will return your original records upon completion of the engagement and will retain copies of the returns and our workpapers for seven (7) years, after which they may be destroyed. The business is responsible for retaining its books, records, and copies of filed returns for the periods required by law.

6. CONFIDENTIALITY

We will treat all information you provide as confidential and will not disclose it to third parties without written consent, except as required by law or professional standards, or as necessary to complete the services.

7. TERMINATION

Either party may terminate this engagement by written notice. If the engagement is terminated before completion, you agree to pay for services rendered through the termination date. We reserve the right to withdraw if requested information is not provided or if continuing would conflict with professional standards.

8. ELECTRONIC SIGNATURES AND ACCEPTANCE

The parties agree that electronic signatures are legally binding under the ESIGN Act and the Uniform Electronic Transactions Act. The electronic signature below of an authorized representative of the business confirms acceptance of the terms of this engagement letter.

We appreciate the opportunity to serve your business.

Sincerely,

{{firmName}}`;

const BOOKKEEPING = `MONTHLY BOOKKEEPING & ADVISORY
ENGAGEMENT LETTER

Dear Client,

Thank you for engaging {{firmName}} ("the Firm," "we," or "us") to provide ongoing bookkeeping and advisory services for your business. This letter confirms the terms of our engagement and the nature and limitations of the services we will provide.

1. SCOPE OF SERVICES

a) Monthly Bookkeeping — We will record transactions from the bank, credit card, and payment processor feeds you connect or provide; reconcile each account monthly; categorize income and expenses to your chart of accounts; and maintain the general ledger in your accounting software.

b) Monthly Financial Reports — We will deliver a balance sheet, profit and loss statement, and cash flow summary each month, generally within fifteen (15) business days after we receive all required information for the prior month.

c) Advisory — We will meet with you on a recurring basis, as agreed, to review the financial reports, discuss trends, and answer questions about the financial position of the business. Advisory services are general in nature and do not include investment, legal, or valuation advice.

d) The following services are not included unless separately agreed in writing: payroll processing, sales tax filings, accounts payable or receivable management, invoicing on your behalf, tax return preparation, audits, reviews, compilations, or forensic accounting.

2. CLIENT RESPONSIBILITIES

a) You are responsible for providing read access to your bank, credit card, loan, and payment processor accounts, or for delivering monthly statements, and for answering our questions about uncategorized or unusual transactions within a reasonable time.

b) You are responsible for the accuracy of the source documents and information you provide, for approving all disbursements, and for the design and operation of internal controls over cash and assets.

c) You remain responsible for management decisions and for the results of operations. Our services do not constitute an audit or review, and we will not express an opinion or assurance on the financial statements.

3. FEES

Services are billed as a fixed monthly fee, quoted in advance and invoiced at the beginning of each month. Cleanup or catch-up work for prior periods, extensive re-categorization caused by missing information, and services outside the scope above will be quoted separately or billed at our standard hourly rates. Fees are due upon receipt of the invoice. We may suspend services if an invoice remains unpaid for more than thirty (30) days.

4. LIMITATIONS

a) Our work is based on the information you provide. We are not responsible for detecting errors, fraud, or illegal acts, although we will inform you of any such matters that come to our attention.

b) Financial reports are prepared for management's internal use and are not intended for third parties such as lenders or investors unless a separate engagement is agreed.

c) We are not responsible for penalties or interest arising from late or inaccurate information provided to us, or from filings that are outside the scope of this engagement.

5. RECORDS RETENTION

The accounting file and its data belong to you. We will retain our workpapers for seven (7) years, after which they may be destroyed. Upon termination, we will provide you with access to your accounting data and a copy of the general ledger through the last completed month.

6. CONFIDENTIALITY

We will treat all information you provide as confidential and will not disclose it to third parties without written consent, except as required by law or professional standards, or as necessary to perform the services through our software and hosting providers.

7. TERM AND TERMINATION

This engagement begins on the date of signature and continues month to month. Either party may terminate by giving thirty (30) days' written notice. Fees are payable through the end of the notice period. We reserve the right to terminate immediately for non-payment or if continuing would conflict with professional standards.

8. ELECTRONIC SIGNATURES AND ACCEPTANCE

The parties agree that electronic signatures are legally binding under the ESIGN Act and the Uniform Electronic Transactions Act. Your electronic signature below confirms that you have read, understand, and agree to the terms of this engagement letter.

We look forward to supporting your business.

Sincerely,

{{firmName}}`;

export const CPA_TEMPLATES: CpaTemplate[] = [
  { name: "Individual Tax Preparation Engagement", content: INDIVIDUAL_TAX },
  { name: "Business Tax Preparation Engagement", content: BUSINESS_TAX },
  { name: "Monthly Bookkeeping & Advisory Engagement", content: BOOKKEEPING },
];

export function renderTemplate(
  content: string,
  vars: { firmName: string }
): string {
  return content.replace(/\{\{\s*firmName\s*\}\}/g, vars.firmName);
}

/**
 * Insert any CPA starter templates the owner does not already have (matched
 * by name). Returns 'exists' when nothing needed inserting.
 */
export async function seedCpaTemplates(
  ownerId: string,
  firmName: string
): Promise<"seeded" | "exists"> {
  const existing = await db
    .select({ name: engagementTemplates.name })
    .from(engagementTemplates)
    .where(eq(engagementTemplates.ownerId, ownerId));
  const have = new Set(existing.map((t) => t.name));

  const missing = CPA_TEMPLATES.filter((t) => !have.has(t.name));
  if (missing.length === 0) return "exists";

  for (const t of missing) {
    // Re-check per row so concurrent provisions don't double-insert.
    const [dupe] = await db
      .select({ id: engagementTemplates.id })
      .from(engagementTemplates)
      .where(
        and(
          eq(engagementTemplates.ownerId, ownerId),
          eq(engagementTemplates.name, t.name)
        )
      )
      .limit(1);
    if (dupe) continue;
    await db.insert(engagementTemplates).values({
      ownerId,
      name: t.name,
      content: renderTemplate(t.content, { firmName }),
    });
  }
  return "seeded";
}
