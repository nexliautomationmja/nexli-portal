// Comprehensive Tax Forms Catalog — Federal IRS + All 50 States + DC

export interface TaxForm {
    id: string;
    number: string;
    name: string;
    description: string;
    category: string;
    state?: string; // only for state forms
    pdfUrl?: string; // direct link to official IRS/state PDF
}

// Generate IRS PDF URL from form number
// IRS convention: https://www.irs.gov/pub/irs-pdf/f{number}.pdf
const PDF_OVERRIDES: Record<string, string> = {
    'Schedule 1': 'f1040s1.pdf',
    'Schedule 2': 'f1040s2.pdf',
    'Schedule 3': 'f1040s3.pdf',
    'Schedule A': 'f1040sa.pdf',
    'Schedule B': 'f1040sb.pdf',
    'Schedule C': 'f1040sc.pdf',
    'Schedule D': 'f1040sd.pdf',
    'Schedule E': 'f1040se.pdf',
    'Schedule F': 'f1040sf.pdf',
    'Schedule H': 'f1040sh.pdf',
    'Schedule J': 'f1040sj.pdf',
    'Schedule R': 'f1040sr.pdf', // Note: different from Form 1040-SR
    'Schedule SE': 'f1040sse.pdf',
    'Schedule 8812': 'f1040s8.pdf',
    'Schedule K-1 (1065)': 'f1065sk1.pdf',
    'Schedule K-1 (1120-S)': 'f1120ssk.pdf',
    'Schedule K-1 (1041)': 'f1041sk1.pdf',
    'Form 8995': 'f8995.pdf',
    'I-9': '', // Not an IRS form (DHS/USCIS)
    'FinCEN 114': '', // Filed via BSA E-Filing, not IRS.gov
    '1040-PR': 'f1040pr.pdf',
};

export function getPdfUrl(form: TaxForm): string {
    if (form.state) return ''; // State forms handled separately
    const num = form.number;
    if (PDF_OVERRIDES[num] !== undefined) {
        return PDF_OVERRIDES[num] ? `https://www.irs.gov/pub/irs-pdf/${PDF_OVERRIDES[num]}` : '';
    }
    // Standard: remove hyphens/spaces/parens, lowercase, prefix with f
    const cleaned = num.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `https://www.irs.gov/pub/irs-pdf/f${cleaned}.pdf`;
}

// Generate IRS instructions URL
export function getInstructionsUrl(form: TaxForm): string {
    if (form.state) return '';
    const num = form.number;
    if (num.startsWith('Schedule') || num === 'I-9' || num === 'FinCEN 114') return '';
    const cleaned = num.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `https://www.irs.gov/pub/irs-pdf/i${cleaned}.pdf`;
}

// ── STATE TAX DEPARTMENT URLS ───────────────────────────────────
// Maps state abbreviation to official tax department forms/downloads page
const STATE_TAX_URLS: Record<string, string> = {
    AL: 'https://www.revenue.alabama.gov/individual-corporate/taxes-individual-income-tax-forms/',
    AK: 'https://tax.alaska.gov/programs/whatsnew.aspx',
    AZ: 'https://azdor.gov/forms',
    AR: 'https://www.dfa.arkansas.gov/income-tax/individual-income-tax-forms/',
    CA: 'https://www.ftb.ca.gov/forms/',
    CO: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
    CT: 'https://portal.ct.gov/DRS/DRS-Forms/Current-Year-Forms',
    DE: 'https://revenue.delaware.gov/frequently-used-forms/',
    DC: 'https://otr.cfo.dc.gov/page/individual-income-tax-forms',
    FL: 'https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx',
    GA: 'https://dor.georgia.gov/individual-income-tax-forms',
    HI: 'https://tax.hawaii.gov/forms/',
    ID: 'https://tax.idaho.gov/forms/',
    IL: 'https://tax.illinois.gov/forms.html',
    IN: 'https://www.in.gov/dor/tax-forms/',
    IA: 'https://tax.iowa.gov/forms',
    KS: 'https://www.ksrevenue.gov/forms-indiv.html',
    KY: 'https://revenue.ky.gov/Individual/Pages/Forms.aspx',
    LA: 'https://revenue.louisiana.gov/Forms',
    ME: 'https://www.maine.gov/revenue/tax-return-forms',
    MD: 'https://www.marylandtaxes.gov/individual/income/income-forms-index.php',
    MA: 'https://www.mass.gov/info-details/dor-personal-income-tax-forms',
    MI: 'https://www.michigan.gov/taxes/iit/tax-forms',
    MN: 'https://www.revenue.state.mn.us/individual-income-tax-forms-instructions',
    MS: 'https://www.dor.ms.gov/individual/tax-forms',
    MO: 'https://dor.mo.gov/forms/',
    MT: 'https://mtrevenue.gov/taxes/individual-income-tax/individual-income-tax-forms/',
    NE: 'https://revenue.nebraska.gov/individuals/individual-income-tax-forms',
    NV: 'https://tax.nv.gov/Forms/',
    NH: 'https://www.revenue.nh.gov/forms/',
    NJ: 'https://www.nj.gov/treasury/taxation/prntgit.shtml',
    NM: 'https://www.tax.newmexico.gov/individuals/tax-forms-and-tables/',
    NY: 'https://www.tax.ny.gov/forms/income_cur_forms.htm',
    NC: 'https://www.ncdor.gov/taxes-forms/individual-income-tax/individual-income-tax-forms-instructions',
    ND: 'https://www.tax.nd.gov/forms',
    OH: 'https://tax.ohio.gov/individual/resources/annual-tax-forms',
    OK: 'https://oklahoma.gov/tax/individuals/income-tax/income-tax-filing/forms.html',
    OR: 'https://www.oregon.gov/dor/forms/Pages/default.aspx',
    PA: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Pages/default.aspx',
    RI: 'https://tax.ri.gov/forms',
    SC: 'https://dor.sc.gov/forms-site/Forms/IITFormsList.aspx',
    SD: 'https://dor.sd.gov/businesses/taxes/',
    TN: 'https://www.tn.gov/revenue/tax-resources/forms.html',
    TX: 'https://comptroller.texas.gov/taxes/franchise/forms/',
    UT: 'https://incometax.utah.gov/forms',
    VT: 'https://tax.vermont.gov/individuals/income-tax-returns/forms',
    VA: 'https://www.tax.virginia.gov/forms',
    WA: 'https://dor.wa.gov/forms-publications',
    WV: 'https://tax.wv.gov/Individuals/ElectronicFiling/Pages/IndividualsTaxForms.aspx',
    WI: 'https://www.revenue.wi.gov/Pages/HTML/formpub.aspx',
    WY: 'https://revenue.wyo.gov/tax-types',
};

export function getStateTaxUrl(form: TaxForm): string {
    if (!form.state) return '';
    const entry = Object.entries(stateFormData).find(([state]) => state === form.state);
    if (!entry) return '';
    return STATE_TAX_URLS[entry[1].abbr] || '';
}

export const formCategories = [
    'Individual Tax',
    'Business Tax',
    'Employment & Payroll',
    'Information Returns (1099)',
    'Mortgage & Education (1098)',
    'Health Insurance (1095)',
    'Estimated Tax',
    'Extensions',
    'Amended Returns',
    'Entity Formation',
    'Estate & Gift Tax',
    'Credits & Deductions',
    'Depreciation & Assets',
    'Self-Employment',
    'Retirement & IRA',
    'International',
    'Power of Attorney',
    'E-File Signatures',
    'Excise Tax',
    'Penalty & Refund',
    'Tax Resolution',
    'State Forms',
] as const;

export type FormCategory = (typeof formCategories)[number];

// ── FEDERAL FORMS ──────────────────────────────────────────────

export const federalForms: TaxForm[] = [
    // ── Individual Tax ──
    { id: 'f-1040', number: '1040', name: 'U.S. Individual Income Tax Return', description: 'Primary individual tax return for U.S. citizens and residents', category: 'Individual Tax' },
    { id: 'f-1040-sr', number: '1040-SR', name: 'U.S. Tax Return for Seniors', description: 'Simplified return for taxpayers 65+', category: 'Individual Tax' },
    { id: 'f-1040-nr', number: '1040-NR', name: 'U.S. Nonresident Alien Income Tax Return', description: 'Return for nonresident aliens with U.S.-source income', category: 'Individual Tax' },
    { id: 'f-1040-ss', number: '1040-SS', name: 'U.S. Self-Employment Tax Return', description: 'For U.S. Virgin Islands, Guam, American Samoa, CNMI, Puerto Rico residents', category: 'Individual Tax' },
    { id: 'f-1040-pr', number: '1040-PR', name: 'Planilla Para La Declaración de la Contribución Federal Sobre el Trabajo por Cuenta Propia', description: 'Puerto Rico self-employment tax return (Spanish)', category: 'Individual Tax' },
    { id: 'f-sch-1', number: 'Schedule 1', name: 'Additional Income and Adjustments to Income', description: 'Reports additional income (alimony, business, rental) and adjustments (student loan interest, IRA)', category: 'Individual Tax' },
    { id: 'f-sch-2', number: 'Schedule 2', name: 'Additional Taxes', description: 'Reports AMT, excess premium tax credit repayment, self-employment tax, etc.', category: 'Individual Tax' },
    { id: 'f-sch-3', number: 'Schedule 3', name: 'Additional Credits and Payments', description: 'Reports foreign tax credit, education credits, estimated tax payments, etc.', category: 'Individual Tax' },
    { id: 'f-sch-a', number: 'Schedule A', name: 'Itemized Deductions', description: 'Medical expenses, taxes, interest, charitable contributions, casualty losses', category: 'Individual Tax' },
    { id: 'f-sch-b', number: 'Schedule B', name: 'Interest and Ordinary Dividends', description: 'Lists interest income >$1,500 and ordinary dividends >$1,500', category: 'Individual Tax' },
    { id: 'f-sch-c', number: 'Schedule C', name: 'Profit or Loss from Business', description: 'Reports income/expenses of a sole proprietorship', category: 'Individual Tax' },
    { id: 'f-sch-d', number: 'Schedule D', name: 'Capital Gains and Losses', description: 'Reports sales of stocks, bonds, real estate, and other capital assets', category: 'Individual Tax' },
    { id: 'f-sch-e', number: 'Schedule E', name: 'Supplemental Income and Loss', description: 'Rental real estate, royalties, partnerships, S corps, estates, trusts', category: 'Individual Tax' },
    { id: 'f-sch-f', number: 'Schedule F', name: 'Profit or Loss from Farming', description: 'Reports farm income and expenses', category: 'Individual Tax' },
    { id: 'f-sch-h', number: 'Schedule H', name: 'Household Employment Taxes', description: 'Social Security, Medicare, and FUTA taxes for household employees', category: 'Individual Tax' },
    { id: 'f-sch-j', number: 'Schedule J', name: 'Income Averaging for Farmers and Fishermen', description: 'Elects to average farm/fishing income over 3 prior years', category: 'Individual Tax' },
    { id: 'f-sch-r', number: 'Schedule R', name: 'Credit for the Elderly or the Disabled', description: 'Claims credit for taxpayers 65+ or permanently disabled', category: 'Individual Tax' },
    { id: 'f-sch-se', number: 'Schedule SE', name: 'Self-Employment Tax', description: 'Computes Social Security and Medicare tax on self-employment income', category: 'Individual Tax' },
    { id: 'f-sch-8812', number: 'Schedule 8812', name: 'Credits for Qualifying Children and Other Dependents', description: 'Child Tax Credit and Additional Child Tax Credit', category: 'Individual Tax' },
    { id: 'f-sch-8995', number: 'Form 8995', name: 'Qualified Business Income Deduction', description: 'QBI deduction up to 20% of qualified business income', category: 'Individual Tax' },

    // ── Business Tax ──
    { id: 'f-1120', number: '1120', name: 'U.S. Corporation Income Tax Return', description: 'Annual return for C corporations', category: 'Business Tax' },
    { id: 'f-1120-s', number: '1120-S', name: 'U.S. Income Tax Return for an S Corporation', description: 'Annual return for S corporations (pass-through)', category: 'Business Tax' },
    { id: 'f-1120-f', number: '1120-F', name: 'U.S. Income Tax Return of a Foreign Corporation', description: 'For foreign corporations with U.S. income', category: 'Business Tax' },
    { id: 'f-1120-h', number: '1120-H', name: 'U.S. Income Tax Return for Homeowners Associations', description: 'HOA income tax return', category: 'Business Tax' },
    { id: 'f-1120-reit', number: '1120-REIT', name: 'U.S. Income Tax Return for Real Estate Investment Trusts', description: 'REIT annual return', category: 'Business Tax' },
    { id: 'f-1120-ric', number: '1120-RIC', name: 'U.S. Income Tax Return for Regulated Investment Companies', description: 'Mutual fund/RIC annual return', category: 'Business Tax' },
    { id: 'f-1065', number: '1065', name: 'U.S. Return of Partnership Income', description: 'Annual information return for partnerships', category: 'Business Tax' },
    { id: 'f-1041', number: '1041', name: 'U.S. Income Tax Return for Estates and Trusts', description: 'Fiduciary return for estates and trusts', category: 'Business Tax' },
    { id: 'f-990', number: '990', name: 'Return of Organization Exempt from Income Tax', description: 'Annual return for tax-exempt organizations', category: 'Business Tax' },
    { id: 'f-990-ez', number: '990-EZ', name: 'Short Form Return of Organization Exempt from Income Tax', description: 'Simplified return for smaller exempt organizations', category: 'Business Tax' },
    { id: 'f-990-pf', number: '990-PF', name: 'Return of Private Foundation', description: 'Annual return for private foundations', category: 'Business Tax' },
    { id: 'f-990-t', number: '990-T', name: 'Exempt Organization Business Income Tax Return', description: 'Reports unrelated business taxable income (UBTI)', category: 'Business Tax' },
    { id: 'f-990-n', number: '990-N', name: 'Electronic Notice (e-Postcard)', description: 'E-filed annual notice for small exempt organizations (receipts ≤$50K)', category: 'Business Tax' },
    { id: 'f-k1-1065', number: 'Schedule K-1 (1065)', name: "Partner's Share of Income, Deductions, Credits", description: 'Reports each partner\'s share of partnership items', category: 'Business Tax' },
    { id: 'f-k1-1120s', number: 'Schedule K-1 (1120-S)', name: "Shareholder's Share of Income, Deductions, Credits", description: 'Reports each shareholder\'s share of S corp items', category: 'Business Tax' },
    { id: 'f-k1-1041', number: 'Schedule K-1 (1041)', name: "Beneficiary's Share of Income, Deductions, Credits", description: 'Reports each beneficiary\'s share of estate/trust items', category: 'Business Tax' },

    // ── Employment & Payroll ──
    { id: 'f-940', number: '940', name: "Employer's Annual Federal Unemployment (FUTA) Tax Return", description: 'Annual FUTA tax return', category: 'Employment & Payroll' },
    { id: 'f-941', number: '941', name: "Employer's Quarterly Federal Tax Return", description: 'Quarterly employment tax return (Social Security, Medicare, withheld income tax)', category: 'Employment & Payroll' },
    { id: 'f-943', number: '943', name: "Employer's Annual Federal Tax Return for Agricultural Employees", description: 'Annual return for farm employers', category: 'Employment & Payroll' },
    { id: 'f-944', number: '944', name: "Employer's Annual Federal Tax Return", description: 'Annual employment tax return for smallest employers', category: 'Employment & Payroll' },
    { id: 'f-945', number: '945', name: 'Annual Return of Withheld Federal Income Tax', description: 'Reports non-payroll withholding (pensions, annuities, gambling)', category: 'Employment & Payroll' },
    { id: 'f-w2', number: 'W-2', name: 'Wage and Tax Statement', description: 'Reports wages, tips, compensation, and taxes withheld', category: 'Employment & Payroll' },
    { id: 'f-w2c', number: 'W-2C', name: 'Corrected Wage and Tax Statement', description: 'Corrects a previously issued W-2', category: 'Employment & Payroll' },
    { id: 'f-w2g', number: 'W-2G', name: 'Certain Gambling Winnings', description: 'Reports gambling winnings and federal tax withheld', category: 'Employment & Payroll' },
    { id: 'f-w3', number: 'W-3', name: 'Transmittal of Wage and Tax Statements', description: 'Transmittal form accompanying W-2s to SSA', category: 'Employment & Payroll' },
    { id: 'f-w3c', number: 'W-3C', name: 'Transmittal of Corrected Wage and Tax Statements', description: 'Transmittal for corrected W-2C forms', category: 'Employment & Payroll' },
    { id: 'f-w4', number: 'W-4', name: "Employee's Withholding Certificate", description: 'Employee withholding election for federal income tax', category: 'Employment & Payroll' },
    { id: 'f-w4p', number: 'W-4P', name: 'Withholding Certificate for Pension/Annuity Payments', description: 'Withholding elections for periodic pension/annuity payments', category: 'Employment & Payroll' },
    { id: 'f-w4r', number: 'W-4R', name: 'Withholding Certificate for Nonperiodic Payments', description: 'Withholding for nonperiodic payments and rollovers', category: 'Employment & Payroll' },
    { id: 'f-w9', number: 'W-9', name: 'Request for Taxpayer Identification Number and Certification', description: 'Provides TIN, certifies U.S. person status', category: 'Employment & Payroll' },
    { id: 'f-w8ben', number: 'W-8BEN', name: 'Certificate of Foreign Status (Individuals)', description: 'Foreign individuals claim treaty benefits or certify foreign status', category: 'Employment & Payroll' },
    { id: 'f-w8bene', number: 'W-8BEN-E', name: 'Certificate of Foreign Status (Entities)', description: 'Foreign entities certify foreign status and claim treaty benefits', category: 'Employment & Payroll' },
    { id: 'f-w8eci', number: 'W-8ECI', name: 'Certificate — Effectively Connected Income', description: 'Certifies income effectively connected with U.S. trade/business', category: 'Employment & Payroll' },
    { id: 'f-w8exp', number: 'W-8EXP', name: 'Certificate of Foreign Government or Organization', description: 'For foreign governments and exempt organizations', category: 'Employment & Payroll' },
    { id: 'f-w8imy', number: 'W-8IMY', name: 'Certificate of Foreign Intermediary', description: 'For intermediaries and flow-through entities', category: 'Employment & Payroll' },
    { id: 'f-i9', number: 'I-9', name: 'Employment Eligibility Verification', description: 'Verifies identity and employment authorization', category: 'Employment & Payroll' },

    // ── Information Returns (1099) ──
    { id: 'f-1099-a', number: '1099-A', name: 'Acquisition or Abandonment of Secured Property', description: 'Filed by lenders for foreclosure/abandonment', category: 'Information Returns (1099)' },
    { id: 'f-1099-b', number: '1099-B', name: 'Proceeds from Broker and Barter Exchange Transactions', description: 'Proceeds from sales of stocks, bonds, commodities', category: 'Information Returns (1099)' },
    { id: 'f-1099-c', number: '1099-C', name: 'Cancellation of Debt', description: 'Reports canceled debt of $600+', category: 'Information Returns (1099)' },
    { id: 'f-1099-cap', number: '1099-CAP', name: 'Changes in Corporate Control and Capital Structure', description: 'Cash/stock received from corporate acquisitions', category: 'Information Returns (1099)' },
    { id: 'f-1099-da', number: '1099-DA', name: 'Digital Asset Proceeds from Broker Transactions', description: 'NEW 2025 — crypto, NFT sales proceeds from brokers', category: 'Information Returns (1099)' },
    { id: 'f-1099-div', number: '1099-DIV', name: 'Dividends and Distributions', description: 'Dividends, capital gain distributions, investment distributions', category: 'Information Returns (1099)' },
    { id: 'f-1099-g', number: '1099-G', name: 'Certain Government Payments', description: 'Unemployment, state/local tax refunds, agricultural payments', category: 'Information Returns (1099)' },
    { id: 'f-1099-h', number: '1099-H', name: 'Health Coverage Tax Credit Advance Payments', description: 'Reports advance HCTC payments', category: 'Information Returns (1099)' },
    { id: 'f-1099-int', number: '1099-INT', name: 'Interest Income', description: 'Reports interest income of $10+', category: 'Information Returns (1099)' },
    { id: 'f-1099-k', number: '1099-K', name: 'Payment Card and Third-Party Network Transactions', description: 'PayPal, Venmo, credit card processor transactions', category: 'Information Returns (1099)' },
    { id: 'f-1099-ls', number: '1099-LS', name: 'Reportable Life Insurance Sale', description: 'Reports sale of a life insurance policy', category: 'Information Returns (1099)' },
    { id: 'f-1099-ltc', number: '1099-LTC', name: 'Long-Term Care and Accelerated Death Benefits', description: 'Long-term care insurance and accelerated death benefit payments', category: 'Information Returns (1099)' },
    { id: 'f-1099-misc', number: '1099-MISC', name: 'Miscellaneous Information', description: 'Rents, royalties, prizes, medical payments, crop insurance, attorney payments', category: 'Information Returns (1099)' },
    { id: 'f-1099-nec', number: '1099-NEC', name: 'Nonemployee Compensation', description: 'Payments of $600+ to independent contractors', category: 'Information Returns (1099)' },
    { id: 'f-1099-oid', number: '1099-OID', name: 'Original Issue Discount', description: 'Original issue discount on bonds, CDs, debt instruments', category: 'Information Returns (1099)' },
    { id: 'f-1099-patr', number: '1099-PATR', name: 'Taxable Distributions from Cooperatives', description: 'Patronage dividends from cooperatives', category: 'Information Returns (1099)' },
    { id: 'f-1099-q', number: '1099-Q', name: 'Payments from Qualified Education Programs', description: 'Distributions from 529 plans and Coverdell ESAs', category: 'Information Returns (1099)' },
    { id: 'f-1099-qa', number: '1099-QA', name: 'Distributions from ABLE Accounts', description: 'Distributions from ABLE accounts', category: 'Information Returns (1099)' },
    { id: 'f-1099-r', number: '1099-R', name: 'Distributions from Pensions, Annuities, Retirement Plans, IRAs', description: 'Retirement plan, IRA, annuity, insurance contract distributions', category: 'Information Returns (1099)' },
    { id: 'f-1099-s', number: '1099-S', name: 'Proceeds from Real Estate Transactions', description: 'Gross proceeds from sale/exchange of real estate', category: 'Information Returns (1099)' },
    { id: 'f-1099-sa', number: '1099-SA', name: 'Distributions from HSA, Archer MSA, or Medicare MSA', description: 'Health savings account and medical savings account distributions', category: 'Information Returns (1099)' },
    { id: 'f-1099-sb', number: '1099-SB', name: "Seller's Investment in Life Insurance Contract", description: 'Cost basis in a sold life insurance contract', category: 'Information Returns (1099)' },
    { id: 'f-1096', number: '1096', name: 'Annual Summary and Transmittal of U.S. Information Returns', description: 'Transmittal form filed with paper 1099s/1098s', category: 'Information Returns (1099)' },

    // ── Mortgage & Education (1098) ──
    { id: 'f-1098', number: '1098', name: 'Mortgage Interest Statement', description: 'Reports mortgage interest of $600+ received', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-c', number: '1098-C', name: 'Contributions of Motor Vehicles, Boats, and Airplanes', description: 'Charitable donations of vehicles worth >$500', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-e', number: '1098-E', name: 'Student Loan Interest Statement', description: 'Student loan interest of $600+ paid', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-f', number: '1098-F', name: 'Fines, Penalties, and Other Amounts', description: 'Fines/penalties paid in certain suits and agreements', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-ma', number: '1098-MA', name: 'Mortgage Assistance Payments', description: 'Mortgage assistance payments on behalf of homeowners', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-q', number: '1098-Q', name: 'Qualifying Longevity Annuity Contract Information', description: 'QLAC information reporting', category: 'Mortgage & Education (1098)' },
    { id: 'f-1098-t', number: '1098-T', name: 'Tuition Statement', description: 'Qualified tuition and related expenses paid to educational institutions', category: 'Mortgage & Education (1098)' },

    // ── Health Insurance (1095) ──
    { id: 'f-1095-a', number: '1095-A', name: 'Health Insurance Marketplace Statement', description: 'Marketplace enrollment statement for reconciling premium tax credits', category: 'Health Insurance (1095)' },
    { id: 'f-1095-b', number: '1095-B', name: 'Health Coverage', description: 'Reports minimum essential coverage from insurance providers', category: 'Health Insurance (1095)' },
    { id: 'f-1095-c', number: '1095-C', name: 'Employer-Provided Health Insurance Offer and Coverage', description: 'ALE (50+ FTEs) insurance offer and coverage reporting', category: 'Health Insurance (1095)' },
    { id: 'f-1094-b', number: '1094-B', name: 'Transmittal of Health Coverage Information Returns', description: 'Transmittal for Forms 1095-B', category: 'Health Insurance (1095)' },
    { id: 'f-1094-c', number: '1094-C', name: 'Transmittal of Employer-Provided Health Insurance Returns', description: 'Transmittal for Forms 1095-C', category: 'Health Insurance (1095)' },

    // ── Estimated Tax ──
    { id: 'f-1040-es', number: '1040-ES', name: 'Estimated Tax for Individuals', description: 'Quarterly estimated tax payment vouchers', category: 'Estimated Tax' },
    { id: 'f-1041-es', number: '1041-ES', name: 'Estimated Income Tax for Estates and Trusts', description: 'Quarterly estimated tax for estates/trusts', category: 'Estimated Tax' },
    { id: 'f-1120-w', number: '1120-W', name: 'Estimated Tax for Corporations', description: 'Corporate estimated tax worksheet', category: 'Estimated Tax' },
    { id: 'f-2210', number: '2210', name: 'Underpayment of Estimated Tax by Individuals', description: 'Determines underpayment penalty; requests waiver', category: 'Estimated Tax' },
    { id: 'f-2220', number: '2220', name: 'Underpayment of Estimated Tax by Corporations', description: 'Corporate underpayment penalty computation', category: 'Estimated Tax' },

    // ── Extensions ──
    { id: 'f-4868', number: '4868', name: 'Application for Extension — Individual', description: 'Automatic 6-month extension for Form 1040 (to Oct 15)', category: 'Extensions' },
    { id: 'f-7004', number: '7004', name: 'Application for Extension — Business', description: 'Automatic 6-month extension for 1120, 1120-S, 1065, 1041', category: 'Extensions' },
    { id: 'f-8868', number: '8868', name: 'Application for Extension — Exempt Organizations', description: 'Automatic 6-month extension for Forms 990 series', category: 'Extensions' },
    { id: 'f-8809', number: '8809', name: 'Application for Extension — Information Returns', description: '30-day extension for 1099s, W-2s, 1098s', category: 'Extensions' },

    // ── Amended Returns ──
    { id: 'f-1040-x', number: '1040-X', name: 'Amended U.S. Individual Income Tax Return', description: 'Amends Form 1040, 1040-SR, or 1040-NR', category: 'Amended Returns' },
    { id: 'f-1120-x', number: '1120-X', name: 'Amended U.S. Corporation Income Tax Return', description: 'Amends Form 1120', category: 'Amended Returns' },
    { id: 'f-1065-x', number: '1065-X', name: 'Amended Return or Administrative Adjustment Request', description: 'Amends partnership returns', category: 'Amended Returns' },
    { id: 'f-941-x', number: '941-X', name: "Adjusted Employer's Quarterly Federal Tax Return", description: 'Amends Form 941', category: 'Amended Returns' },
    { id: 'f-943-x', number: '943-X', name: "Adjusted Employer's Annual Federal Tax Return — Agricultural", description: 'Amends Form 943', category: 'Amended Returns' },
    { id: 'f-945-x', number: '945-X', name: 'Adjusted Annual Return of Withheld Federal Income Tax', description: 'Amends Form 945', category: 'Amended Returns' },

    // ── Entity Formation ──
    { id: 'f-ss4', number: 'SS-4', name: 'Application for Employer Identification Number', description: 'Apply for a federal EIN', category: 'Entity Formation' },
    { id: 'f-2553', number: '2553', name: 'Election by a Small Business Corporation', description: 'S corporation election under IRC 1362(a)', category: 'Entity Formation' },
    { id: 'f-8832', number: '8832', name: 'Entity Classification Election', description: 'Check-the-box election (corp, partnership, or disregarded entity)', category: 'Entity Formation' },
    { id: 'f-966', number: '966', name: 'Corporate Dissolution or Liquidation', description: 'Filed when a corporation adopts a dissolution/liquidation plan', category: 'Entity Formation' },
    { id: 'f-8308', number: '8308', name: 'Report of Sale/Exchange of Partnership Interests', description: 'Section 751(a) exchanges involving unrealized receivables/inventory', category: 'Entity Formation' },

    // ── Estate & Gift Tax ──
    { id: 'f-706', number: '706', name: 'United States Estate Tax Return', description: 'Filed for estates exceeding the estate tax exemption', category: 'Estate & Gift Tax' },
    { id: 'f-706-na', number: '706-NA', name: 'Estate Tax Return — Nonresident Non-Citizens', description: 'Estate tax for nonresident non-citizen decedents', category: 'Estate & Gift Tax' },
    { id: 'f-709', number: '709', name: 'United States Gift Tax Return', description: 'Reports taxable gifts and generation-skipping transfers', category: 'Estate & Gift Tax' },
    { id: 'f-712', number: '712', name: 'Life Insurance Statement', description: 'Used with Form 706 for life insurance policy details', category: 'Estate & Gift Tax' },
    { id: 'f-8971', number: '8971', name: 'Information Regarding Beneficiaries Acquiring Property', description: 'Reports basis information to beneficiaries for inherited property', category: 'Estate & Gift Tax' },

    // ── Credits & Deductions ──
    { id: 'f-8863', number: '8863', name: 'Education Credits', description: 'American Opportunity Credit (up to $2,500) and Lifetime Learning Credit (up to $2,000)', category: 'Credits & Deductions' },
    { id: 'f-2441', number: '2441', name: 'Child and Dependent Care Expenses', description: 'Credit for care of qualifying children/dependents while you work', category: 'Credits & Deductions' },
    { id: 'f-8862', number: '8862', name: 'Information to Claim Credits After Disallowance', description: 'Required to reclaim EIC, CTC, AOTC after prior disallowance', category: 'Credits & Deductions' },
    { id: 'f-8880', number: '8880', name: "Credit for Qualified Retirement Savings (Saver's Credit)", description: 'Credit for IRA and employer-sponsored retirement contributions', category: 'Credits & Deductions' },
    { id: 'f-8962', number: '8962', name: 'Premium Tax Credit', description: 'Reconciles advance PTC payments or claims the PTC for Marketplace insurance', category: 'Credits & Deductions' },
    { id: 'f-8889', number: '8889', name: 'Health Savings Accounts (HSAs)', description: 'Reports HSA contributions, deductions, and distributions', category: 'Credits & Deductions' },
    { id: 'f-5695', number: '5695', name: 'Residential Energy Credits', description: 'Credits for energy-efficient home improvements and clean energy', category: 'Credits & Deductions' },
    { id: 'f-8936', number: '8936', name: 'Clean Vehicle Credits', description: 'Credits for plug-in electric and clean vehicles', category: 'Credits & Deductions' },
    { id: 'f-1116', number: '1116', name: 'Foreign Tax Credit', description: 'Dollar-for-dollar credit for income taxes paid to foreign countries', category: 'Credits & Deductions' },
    { id: 'f-8396', number: '8396', name: 'Mortgage Interest Credit', description: 'Credit from state/local Mortgage Credit Certificate program', category: 'Credits & Deductions' },
    { id: 'f-8839', number: '8839', name: 'Qualified Adoption Expenses', description: 'Adoption credit and employer-provided adoption benefit exclusion', category: 'Credits & Deductions' },
    { id: 'f-3800', number: '3800', name: 'General Business Credit', description: 'Summarizes all general business credits', category: 'Credits & Deductions' },
    { id: 'f-5884', number: '5884', name: 'Work Opportunity Credit', description: 'Credit for hiring individuals from targeted groups', category: 'Credits & Deductions' },
    { id: 'f-8283', number: '8283', name: 'Noncash Charitable Contributions', description: 'Required when noncash contributions exceed $500', category: 'Credits & Deductions' },

    // ── Depreciation & Assets ──
    { id: 'f-4562', number: '4562', name: 'Depreciation and Amortization', description: 'Section 179 expensing, depreciation, amortization, listed property', category: 'Depreciation & Assets' },
    { id: 'f-4797', number: '4797', name: 'Sales of Business Property', description: 'Gains/losses from business property sales, depreciation recapture', category: 'Depreciation & Assets' },
    { id: 'f-8824', number: '8824', name: 'Like-Kind Exchanges', description: 'Section 1031 exchanges of business/investment property', category: 'Depreciation & Assets' },
    { id: 'f-8949', number: '8949', name: 'Sales and Other Dispositions of Capital Assets', description: 'Individual sales of stocks, bonds, capital assets → Schedule D', category: 'Depreciation & Assets' },
    { id: 'f-4684', number: '4684', name: 'Casualties and Thefts', description: 'Gains/losses from casualties and thefts', category: 'Depreciation & Assets' },

    // ── Self-Employment ──
    { id: 'f-sch-c-se', number: 'Schedule C', name: 'Profit or Loss from Business (Sole Proprietorship)', description: 'Reports sole proprietorship income and expenses', category: 'Self-Employment' },
    { id: 'f-sch-se-se', number: 'Schedule SE', name: 'Self-Employment Tax', description: 'Social Security and Medicare tax on SE income', category: 'Self-Employment' },
    { id: 'f-8829', number: '8829', name: 'Expenses for Business Use of Your Home', description: 'Home office deduction for Schedule C filers', category: 'Self-Employment' },

    // ── Retirement & IRA ──
    { id: 'f-8606', number: '8606', name: 'Nondeductible IRAs', description: 'Nondeductible IRA contributions, Roth conversions, Roth distributions', category: 'Retirement & IRA' },
    { id: 'f-5329', number: '5329', name: 'Additional Taxes on Qualified Plans', description: 'Penalties for early distributions, excess contributions', category: 'Retirement & IRA' },
    { id: 'f-5500', number: '5500', name: 'Annual Return of Employee Benefit Plan', description: 'Annual return for pension, 401(k), benefit plans', category: 'Retirement & IRA' },
    { id: 'f-5500-sf', number: '5500-SF', name: 'Short Form — Small Employee Benefit Plan', description: 'Simplified version for smaller plans', category: 'Retirement & IRA' },
    { id: 'f-5500-ez', number: '5500-EZ', name: 'Annual Return — One-Participant Retirement Plan', description: 'For solo 401(k) and one-participant plans', category: 'Retirement & IRA' },
    { id: 'f-5498', number: '5498', name: 'IRA Contribution Information', description: 'IRA contributions, rollovers, conversions, FMV', category: 'Retirement & IRA' },
    { id: 'f-5498-sa', number: '5498-SA', name: 'HSA, Archer MSA, or Medicare MSA Information', description: 'Reports health savings account contributions', category: 'Retirement & IRA' },
    { id: 'f-7203', number: '7203', name: 'S Corporation Shareholder Stock and Debt Basis', description: 'Tracks S corp shareholder basis to determine deductible losses', category: 'Retirement & IRA' },

    // ── International ──
    { id: 'f-5471', number: '5471', name: 'Information Return — U.S. Persons With Foreign Corporations', description: 'For U.S. shareholders in certain foreign corporations', category: 'International' },
    { id: 'f-5472', number: '5472', name: 'Information Return — 25% Foreign-Owned U.S. Corporation', description: 'Related-party transactions of 25% foreign-owned U.S. corps', category: 'International' },
    { id: 'f-8938', number: '8938', name: 'Statement of Specified Foreign Financial Assets (FATCA)', description: 'Reports foreign financial assets exceeding IRS thresholds', category: 'International' },
    { id: 'f-fbar', number: 'FinCEN 114', name: 'Report of Foreign Bank and Financial Accounts (FBAR)', description: 'Foreign accounts when aggregate value exceeds $10,000', category: 'International' },
    { id: 'f-3520', number: '3520', name: 'Annual Return — Foreign Trusts and Foreign Gifts', description: 'Transactions with foreign trusts, receipt of large foreign gifts', category: 'International' },
    { id: 'f-3520-a', number: '3520-A', name: 'Annual Information Return of Foreign Trust with U.S. Owner', description: 'Filed by foreign trusts with at least one U.S. owner', category: 'International' },
    { id: 'f-8865', number: '8865', name: 'Return — U.S. Persons With Foreign Partnerships', description: 'For U.S. persons with interests in foreign partnerships', category: 'International' },
    { id: 'f-926', number: '926', name: 'Return by U.S. Transferor of Property to Foreign Corporation', description: 'Reports property transfers to foreign corporations', category: 'International' },
    { id: 'f-2555', number: '2555', name: 'Foreign Earned Income', description: 'Foreign Earned Income Exclusion and Housing Exclusion/Deduction', category: 'International' },
    { id: 'f-8833', number: '8833', name: 'Treaty-Based Return Position Disclosure', description: 'Discloses treaty-based positions on a tax return', category: 'International' },

    // ── Power of Attorney ──
    { id: 'f-2848', number: '2848', name: 'Power of Attorney and Declaration of Representative', description: 'Authorizes CPA to act on behalf of taxpayer before IRS', category: 'Power of Attorney' },
    { id: 'f-8821', number: '8821', name: 'Tax Information Authorization', description: 'Authorizes designee to inspect/receive confidential tax info', category: 'Power of Attorney' },
    { id: 'f-8821-a', number: '8821-A', name: 'Taxpayer Information Authorization — Designated Party', description: 'Disclosure to specific designated parties', category: 'Power of Attorney' },
    { id: 'f-56', number: '56', name: 'Notice Concerning Fiduciary Relationship', description: 'Notifies IRS of fiduciary relationship (executor, trustee, guardian)', category: 'Power of Attorney' },

    // ── E-File Signatures ──
    { id: 'f-8879', number: '8879', name: 'IRS e-file Signature Authorization', description: 'Authorizes ERO to e-file individual return with self-selected PIN', category: 'E-File Signatures' },
    { id: 'f-8879-s', number: '8879-S', name: 'e-file Signature Authorization — Form 1120-S', description: 'S corporation e-file signature', category: 'E-File Signatures' },
    { id: 'f-8879-c', number: '8879-C', name: 'e-file Signature Authorization — Form 1120', description: 'C corporation e-file signature', category: 'E-File Signatures' },
    { id: 'f-8879-pe', number: '8879-PE', name: 'e-file Signature Authorization — Form 1065', description: 'Partnership e-file signature', category: 'E-File Signatures' },
    { id: 'f-8879-f', number: '8879-F', name: 'e-file Signature Authorization — Form 1041', description: 'Estate/trust e-file signature', category: 'E-File Signatures' },
    { id: 'f-8879-eo', number: '8879-EO', name: 'e-file Signature Authorization — Exempt Organization', description: 'Form 990 series e-file signature', category: 'E-File Signatures' },
    { id: 'f-8453', number: '8453', name: 'U.S. Individual Income Tax Transmittal for e-file', description: 'Paper transmittal for certain e-filed individual returns', category: 'E-File Signatures' },

    // ── Excise Tax ──
    { id: 'f-720', number: '720', name: 'Quarterly Federal Excise Tax Return', description: 'Reports and pays various federal excise taxes', category: 'Excise Tax' },
    { id: 'f-2290', number: '2290', name: 'Heavy Highway Vehicle Use Tax Return', description: 'Federal use tax on heavy highway vehicles (55,000+ lbs)', category: 'Excise Tax' },
    { id: 'f-8849', number: '8849', name: 'Claim for Refund of Excise Taxes', description: 'Claims refund of excise taxes', category: 'Excise Tax' },

    // ── Penalty & Refund ──
    { id: 'f-843', number: '843', name: 'Claim for Refund and Request for Abatement', description: 'Claims refund or requests abatement of overpaid taxes/penalties', category: 'Penalty & Refund' },
    { id: 'f-8379', number: '8379', name: 'Injured Spouse Allocation', description: 'When joint refund offset against other spouse\'s past-due obligation', category: 'Penalty & Refund' },
    { id: 'f-8857', number: '8857', name: 'Request for Innocent Spouse Relief', description: 'Relief from tax liability attributable to spouse/former spouse', category: 'Penalty & Refund' },
    { id: 'f-8888', number: '8888', name: 'Allocation of Refund', description: 'Splits refund into multiple accounts or purchases savings bonds', category: 'Penalty & Refund' },
    { id: 'f-4506', number: '4506', name: 'Request for Copy of Tax Return', description: 'Requests a full copy of previously filed return', category: 'Penalty & Refund' },
    { id: 'f-4506-t', number: '4506-T', name: 'Request for Transcript of Tax Return', description: 'Requests tax return transcript, account transcript, wage transcript', category: 'Penalty & Refund' },

    // ── Tax Resolution ──
    { id: 'f-656', number: '656', name: 'Offer in Compromise', description: 'Proposes to settle tax debt for less than full amount owed', category: 'Tax Resolution' },
    { id: 'f-433-a', number: '433-A', name: 'Collection Information Statement — Wage Earners & Self-Employed', description: 'Financial statement for individuals (installment agreements)', category: 'Tax Resolution' },
    { id: 'f-433-a-oic', number: '433-A (OIC)', name: 'Collection Information Statement — OIC Version', description: 'Financial statement for Offer in Compromise applications', category: 'Tax Resolution' },
    { id: 'f-433-b', number: '433-B', name: 'Collection Information Statement — Businesses', description: 'Financial statement for businesses (installment agreements)', category: 'Tax Resolution' },
    { id: 'f-433-b-oic', number: '433-B (OIC)', name: 'Collection Information Statement — Business OIC', description: 'Business financial statement for Offer in Compromise', category: 'Tax Resolution' },
    { id: 'f-433-f', number: '433-F', name: 'Collection Information Statement (Streamlined)', description: 'Simplified financial statement for routine installment agreements', category: 'Tax Resolution' },
    { id: 'f-9465', number: '9465', name: 'Installment Agreement Request', description: 'Requests monthly payment plan for tax debt', category: 'Tax Resolution' },
    { id: 'f-12153', number: '12153', name: 'Request for Collection Due Process Hearing', description: 'CDP hearing request for liens/levies', category: 'Tax Resolution' },
    { id: 'f-9423', number: '9423', name: 'Collection Appeal Request', description: 'Appeals IRS collection actions', category: 'Tax Resolution' },
    { id: 'f-843-res', number: '843', name: 'Claim for Refund / Penalty Abatement', description: 'Request abatement of penalties (first-time or reasonable cause)', category: 'Tax Resolution' },
    { id: 'f-8857-res', number: '8857', name: 'Request for Innocent Spouse Relief', description: 'Relief from tax liability attributable to spouse', category: 'Tax Resolution' },
];

// ── STATE FORMS ────────────────────────────────────────────────
// Organized by state, covering all 50 states + DC

const stateFormData: Record<string, { abbr: string; forms: Omit<TaxForm, 'id' | 'category' | 'state'>[] }> = {
    'Alabama': { abbr: 'AL', forms: [
        { number: '40', name: 'Individual Income Tax Return', description: 'Alabama resident individual income tax return' },
        { number: '40NR', name: 'Nonresident Individual Income Tax Return', description: 'For nonresidents with Alabama income' },
        { number: '40A', name: 'Short Form Individual Income Tax Return', description: 'Simplified Alabama return' },
        { number: '40-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '40V', name: 'Payment Voucher', description: 'Payment voucher for balance due' },
        { number: '4868A', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '20C', name: 'Corporation Income Tax Return', description: 'Alabama corporate income tax' },
        { number: '65', name: 'Partnership/S Corporation Return', description: 'Alabama pass-through entity return' },
        { number: 'A-1', name: "Employer's Quarterly Return", description: 'Quarterly withholding return' },
        { number: 'A-6', name: 'Employer Annual Reconciliation', description: 'Annual withholding reconciliation' },
    ]},
    'Alaska': { abbr: 'AK', forms: [
        { number: '6000', name: 'Alaska Corporation Net Income Tax Return', description: 'Corporate income tax (no individual income tax)' },
        { number: '6020', name: 'Corporation Estimated Tax', description: 'Corporate estimated tax payments' },
        { number: '6150', name: 'Extension of Time', description: 'Corporate extension request' },
        { number: '6210', name: 'Amended Corporation Net Income Tax Return', description: 'Amend corporate return' },
    ]},
    'Arizona': { abbr: 'AZ', forms: [
        { number: '140', name: 'Resident Personal Income Tax Return', description: 'Arizona resident return' },
        { number: '140NR', name: 'Nonresident Personal Income Tax Return', description: 'Nonresident Arizona return' },
        { number: '140PY', name: 'Part-Year Resident Personal Income Tax Return', description: 'Part-year resident return' },
        { number: '140-ES', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: '204', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '140X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '120', name: 'Arizona Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '120S', name: 'Arizona S Corporation Income Tax Return', description: 'S corporation return' },
        { number: '165', name: 'Arizona Partnership Income Tax Return', description: 'Partnership return' },
        { number: 'A1-QRT', name: 'Quarterly Withholding Return', description: 'Quarterly employer withholding' },
    ]},
    'Arkansas': { abbr: 'AR', forms: [
        { number: 'AR1000F', name: 'Full Year Resident Individual Income Tax Return', description: 'Arkansas resident return' },
        { number: 'AR1000NR', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident Arkansas return' },
        { number: 'AR1000-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'AR1055', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'AR1000X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'AR1100CT', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'AR1050', name: 'Partnership Return', description: 'Partnership/S Corp return' },
        { number: 'AR941', name: 'Employer Quarterly Withholding Report', description: 'Quarterly withholding' },
    ]},
    'California': { abbr: 'CA', forms: [
        { number: '540', name: 'California Resident Income Tax Return', description: 'California resident return' },
        { number: '540NR', name: 'Nonresident/Part-Year Resident Income Tax Return', description: 'Nonresident California return' },
        { number: '540-ES', name: 'Estimated Tax for Individuals', description: 'Quarterly estimated payments' },
        { number: 'FTB 3519', name: 'Payment for Automatic Extension', description: 'Extension payment voucher' },
        { number: '540X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '100', name: 'California Corporation Franchise or Income Tax Return', description: 'Corporate tax return' },
        { number: '100S', name: 'California S Corporation Franchise or Income Tax Return', description: 'S corporation return' },
        { number: '565', name: 'Partnership Return of Income', description: 'Partnership return' },
        { number: '568', name: 'Limited Liability Company Return of Income', description: 'LLC return' },
        { number: 'DE 9', name: 'Quarterly Contribution Return', description: 'Employer quarterly return' },
        { number: 'DE 9C', name: 'Quarterly Contribution Return Continuation', description: 'Employee detail report' },
    ]},
    'Colorado': { abbr: 'CO', forms: [
        { number: '104', name: 'Colorado Individual Income Tax Return', description: 'Colorado resident return' },
        { number: '104PN', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '104-EP', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '158-I', name: 'Extension Payment Voucher', description: 'Extension of time to file' },
        { number: '104X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '112', name: 'Colorado C Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '106', name: 'Partnership/S Corporation/Fiduciary Return', description: 'Pass-through entity return' },
    ]},
    'Connecticut': { abbr: 'CT', forms: [
        { number: 'CT-1040', name: 'Connecticut Resident Income Tax Return', description: 'Connecticut resident return' },
        { number: 'CT-1040NR/PY', name: 'Nonresident/Part-Year Resident Income Tax Return', description: 'Nonresident return' },
        { number: 'CT-1040-ES', name: 'Estimated Income Tax Payment Coupon', description: 'Quarterly estimated payments' },
        { number: 'CT-1040-EXT', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'CT-1040X', name: 'Amended Connecticut Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CT-1120', name: 'Corporation Business Tax Return', description: 'Corporate tax return' },
        { number: 'CT-1065/CT-1120SI', name: 'Partnership/S Corporation Return', description: 'Pass-through entity return' },
    ]},
    'Delaware': { abbr: 'DE', forms: [
        { number: '200-01', name: 'Delaware Resident Individual Income Tax Return', description: 'Delaware resident return' },
        { number: '200-02', name: 'Nonresident Individual Income Tax Return', description: 'Nonresident return' },
        { number: '200-ESA', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: '1027', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '200-X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '1100', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '300', name: 'Partnership Return', description: 'Partnership return' },
        { number: '1100-S', name: 'S Corporation Return', description: 'S Corporation return' },
    ]},
    'District of Columbia': { abbr: 'DC', forms: [
        { number: 'D-40', name: 'Individual Income Tax Return', description: 'DC resident individual return' },
        { number: 'D-40B', name: 'Nonresident Request for Refund', description: 'Nonresident refund request' },
        { number: 'D-40ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'FR-127', name: 'Extension of Time to File', description: 'Extension request' },
        { number: 'D-40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'D-20', name: 'Corporation Franchise Tax Return', description: 'Corporate franchise tax' },
        { number: 'D-65', name: 'Partnership Return of Income', description: 'Partnership return' },
    ]},
    'Florida': { abbr: 'FL', forms: [
        { number: 'F-1120', name: 'Florida Corporate Income/Franchise Tax Return', description: 'Corporate income tax (no individual income tax)' },
        { number: 'F-1120-ES', name: 'Corporation Estimated Income Tax', description: 'Corporate estimated payments' },
        { number: 'F-7004', name: 'Extension of Time', description: 'Corporate extension request' },
        { number: 'F-1120X', name: 'Amended Corporation Income Tax Return', description: 'Amend corporate return' },
        { number: 'DR-15', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax' },
        { number: 'RT-6', name: 'Employer Quarterly Report', description: 'Quarterly employer report' },
    ]},
    'Georgia': { abbr: 'GA', forms: [
        { number: '500', name: 'Georgia Individual Income Tax Return', description: 'Georgia resident return' },
        { number: '500-EZ', name: 'Short Form Individual Income Tax Return', description: 'Simplified return' },
        { number: '500-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'IT-303', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '500X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '600', name: 'Corporation Tax Return', description: 'Corporate income tax' },
        { number: '600-S', name: 'S Corporation Tax Return', description: 'S corporation return' },
        { number: '700', name: 'Partnership Tax Return', description: 'Partnership return' },
        { number: 'G-7', name: "Employer's Quarterly Return", description: 'Quarterly withholding return' },
    ]},
    'Hawaii': { abbr: 'HI', forms: [
        { number: 'N-11', name: 'Hawaii Resident Income Tax Return', description: 'Resident individual return' },
        { number: 'N-15', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: 'N-1', name: 'Estimated Tax Declaration', description: 'Quarterly estimated payments' },
        { number: 'N-101A', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'N-11/N-15 (Amended)', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'N-20', name: 'Partnership Return of Income', description: 'Partnership return' },
        { number: 'N-30', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'N-35', name: 'S Corporation Income Tax Return', description: 'S corporation return' },
    ]},
    'Idaho': { abbr: 'ID', forms: [
        { number: '40', name: 'Idaho Individual Income Tax Return', description: 'Resident individual return' },
        { number: '43', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '51', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: '51-EXT', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '41', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '41S', name: 'S Corporation Income Tax Return', description: 'S corporation return' },
        { number: '65', name: 'Partnership Return of Income', description: 'Partnership return' },
    ]},
    'Illinois': { abbr: 'IL', forms: [
        { number: 'IL-1040', name: 'Individual Income Tax Return', description: 'Illinois resident return' },
        { number: 'IL-1040-ES', name: 'Estimated Income Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'IL-505-I', name: 'Automatic Extension Payment', description: 'Extension payment' },
        { number: 'IL-1040-X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'IL-1120', name: 'Corporation Income and Replacement Tax Return', description: 'Corporate income/replacement tax' },
        { number: 'IL-1120-ST', name: 'Small Business Corporation Replacement Tax Return', description: 'S corporation return' },
        { number: 'IL-1065', name: 'Partnership Replacement Tax Return', description: 'Partnership return' },
        { number: 'IL-941', name: "Employer's Quarterly Withholding Return", description: 'Quarterly withholding' },
    ]},
    'Indiana': { abbr: 'IN', forms: [
        { number: 'IT-40', name: 'Indiana Full-Year Resident Individual Income Tax Return', description: 'Resident individual return' },
        { number: 'IT-40PNR', name: 'Part-Year/Nonresident Individual Income Tax Return', description: 'Nonresident return' },
        { number: 'IT-40-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'IT-9', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IT-40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'IT-20', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'IT-20S', name: 'S Corporation Income Tax Return', description: 'S corporation return' },
        { number: 'IT-65', name: 'Partnership Return', description: 'Partnership return' },
    ]},
    'Iowa': { abbr: 'IA', forms: [
        { number: 'IA 1040', name: 'Individual Income Tax Return', description: 'Iowa resident return' },
        { number: 'IA 1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'IA 1040V', name: 'Payment Voucher', description: 'Payment voucher for balance due' },
        { number: 'IA 1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'IA 1120', name: 'Iowa Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'IA 1065', name: 'Iowa Partnership Return of Income', description: 'Partnership return' },
        { number: 'IA 1120S', name: 'Iowa S Corporation Return', description: 'S corporation return' },
    ]},
    'Kansas': { abbr: 'KS', forms: [
        { number: 'K-40', name: 'Kansas Individual Income Tax Return', description: 'Kansas resident return' },
        { number: 'K-40-ES', name: 'Estimated Tax Voucher', description: 'Quarterly estimated payments' },
        { number: 'K-40V', name: 'Payment Voucher', description: 'Payment voucher' },
        { number: 'K-40X', name: 'Amended Kansas Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'K-120', name: 'Kansas Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'K-120S', name: 'Kansas S Corporation Return', description: 'S corporation return' },
        { number: 'K-65', name: 'Kansas Partnership Return', description: 'Partnership return' },
    ]},
    'Kentucky': { abbr: 'KY', forms: [
        { number: '740', name: 'Kentucky Individual Income Tax Return', description: 'Kentucky resident return' },
        { number: '740-NP', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '740-ES', name: 'Estimated Tax Voucher', description: 'Quarterly estimated payments' },
        { number: '40A102', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '740-X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '720', name: 'Kentucky Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '720S', name: 'Kentucky S Corporation Income Tax Return', description: 'S corporation return' },
        { number: '765', name: 'Kentucky Partnership Return', description: 'Partnership return' },
    ]},
    'Louisiana': { abbr: 'LA', forms: [
        { number: 'IT-540', name: 'Louisiana Resident Income Tax Return', description: 'Louisiana resident return' },
        { number: 'IT-540B', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: 'IT-540-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'R-2868', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IT-540X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CIFT-620', name: 'Corporation Income/Franchise Tax Return', description: 'Corporate income/franchise tax' },
        { number: 'IT-565', name: 'Partnership Return of Income', description: 'Partnership return' },
    ]},
    'Maine': { abbr: 'ME', forms: [
        { number: '1040ME', name: 'Maine Individual Income Tax Return', description: 'Maine resident return' },
        { number: '1040ME-PV', name: 'Payment Voucher', description: 'Payment voucher' },
        { number: '1040-ES-ME', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '1040ME-EXT', name: 'Extension Payment Voucher', description: 'Extension of time to file' },
        { number: '1040X-ME', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '1120ME', name: 'Maine Corporate Income Tax Return', description: 'Corporate income tax' },
        { number: '1065ME', name: 'Maine Partnership Return', description: 'Partnership return' },
    ]},
    'Maryland': { abbr: 'MD', forms: [
        { number: '502', name: 'Maryland Resident Income Tax Return', description: 'Resident individual return' },
        { number: '505', name: 'Nonresident Income Tax Return', description: 'Nonresident return' },
        { number: '502D', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: '502E', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '502X', name: 'Amended Tax Return', description: 'Amend previously filed return' },
        { number: '500', name: 'Maryland Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '510', name: 'Maryland Pass-Through Entity Tax Return', description: 'Partnership/S Corp return' },
    ]},
    'Massachusetts': { abbr: 'MA', forms: [
        { number: '1', name: 'Massachusetts Resident Income Tax Return', description: 'Resident individual return' },
        { number: '1-NR/PY', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '1-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'M-4868', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '1X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '355', name: 'Massachusetts Corporate Excise Return', description: 'Corporate excise tax' },
        { number: '3', name: 'Partnership Return of Income', description: 'Partnership return' },
    ]},
    'Michigan': { abbr: 'MI', forms: [
        { number: 'MI-1040', name: 'Michigan Individual Income Tax Return', description: 'Michigan resident return' },
        { number: 'MI-1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'MI-4868', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'MI-1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'MI-1120', name: 'Michigan Corporate Income Tax Return', description: 'Corporate income tax' },
        { number: 'MI-1065', name: 'Michigan Partnership Return', description: 'Partnership return' },
    ]},
    'Minnesota': { abbr: 'MN', forms: [
        { number: 'M1', name: 'Minnesota Individual Income Tax Return', description: 'Minnesota resident return' },
        { number: 'M1NR', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: 'M14', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'M13', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'M1X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'M4', name: 'Minnesota Corporation Franchise Tax Return', description: 'Corporate franchise tax' },
        { number: 'M3', name: 'Minnesota Partnership Return', description: 'Partnership return' },
    ]},
    'Mississippi': { abbr: 'MS', forms: [
        { number: '80-105', name: 'Mississippi Resident Individual Income Tax Return', description: 'Resident individual return' },
        { number: '80-205', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '80-106', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '80-180', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '80-115', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '83-105', name: 'Mississippi Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '84-105', name: 'Mississippi Partnership Return', description: 'Partnership return' },
    ]},
    'Missouri': { abbr: 'MO', forms: [
        { number: 'MO-1040', name: 'Missouri Individual Income Tax Return', description: 'Missouri resident return' },
        { number: 'MO-1040P', name: 'Part-Year/Nonresident Individual Income Tax Return', description: 'Nonresident return' },
        { number: 'MO-1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'MO-60', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'MO-1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'MO-1120', name: 'Missouri Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'MO-1065', name: 'Missouri Partnership Return', description: 'Partnership return' },
    ]},
    'Montana': { abbr: 'MT', forms: [
        { number: '2', name: 'Montana Individual Income Tax Return', description: 'Montana resident return' },
        { number: '2-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'SB', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '2X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CIT', name: 'Montana Corporate Income Tax Return', description: 'Corporate income tax' },
        { number: 'PR-1', name: 'Montana Partnership Return', description: 'Partnership return' },
    ]},
    'Nebraska': { abbr: 'NE', forms: [
        { number: '1040N', name: 'Nebraska Individual Income Tax Return', description: 'Resident individual return' },
        { number: '1040N-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '4868N', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '1040XN', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '1120N', name: 'Nebraska Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '1065N', name: 'Nebraska Partnership Return', description: 'Partnership return' },
    ]},
    'Nevada': { abbr: 'NV', forms: [
        { number: 'Commerce Tax', name: 'Nevada Commerce Tax Return', description: 'Annual gross revenue tax for businesses (no income tax)' },
        { number: 'MBT', name: 'Modified Business Tax Return', description: 'Quarterly payroll tax' },
        { number: 'Sales Tax', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax' },
    ]},
    'New Hampshire': { abbr: 'NH', forms: [
        { number: 'BET', name: 'Business Enterprise Tax Return', description: 'Business enterprise tax (no wage/salary income tax)' },
        { number: 'BPT', name: 'Business Profits Tax Return', description: 'Business profits tax' },
        { number: 'DP-10', name: 'Interest and Dividends Tax Return', description: 'Tax on interest/dividends (being phased out)' },
    ]},
    'New Jersey': { abbr: 'NJ', forms: [
        { number: 'NJ-1040', name: 'New Jersey Resident Income Tax Return', description: 'New Jersey resident return' },
        { number: 'NJ-1040NR', name: 'Nonresident Income Tax Return', description: 'Nonresident return' },
        { number: 'NJ-1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'NJ-630', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'NJ-1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CBT-100', name: 'Corporation Business Tax Return', description: 'Corporate business tax' },
        { number: 'CBT-100S', name: 'S Corporation Business Tax Return', description: 'S corporation return' },
        { number: 'NJ-1065', name: 'Partnership Return', description: 'Partnership return' },
    ]},
    'New Mexico': { abbr: 'NM', forms: [
        { number: 'PIT-1', name: 'New Mexico Personal Income Tax Return', description: 'New Mexico resident return' },
        { number: 'PIT-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'RPD-41096', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'PIT-X', name: 'Amended Personal Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CIT-1', name: 'Corporate Income and Franchise Tax Return', description: 'Corporate income/franchise tax' },
        { number: 'PTE', name: 'Pass-Through Entity Return', description: 'Partnership/S Corp return' },
    ]},
    'New York': { abbr: 'NY', forms: [
        { number: 'IT-201', name: 'Resident Income Tax Return', description: 'New York State resident return' },
        { number: 'IT-203', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: 'IT-2105', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'IT-370', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IT-201-X', name: 'Amended Resident Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CT-3', name: 'General Business Corporation Franchise Tax Return', description: 'Corporate franchise tax' },
        { number: 'CT-3-S', name: 'S Corporation Franchise Tax Return', description: 'S corporation return' },
        { number: 'IT-204', name: 'Partnership Return', description: 'Partnership return' },
        { number: 'IT-2104', name: "Employee's Withholding Allowance Certificate", description: 'State W-4 equivalent' },
        { number: 'NYC-210', name: 'NYC Individual Income Tax Return (for NYC residents)', description: 'NYC resident tax claim' },
    ]},
    'North Carolina': { abbr: 'NC', forms: [
        { number: 'D-400', name: 'North Carolina Individual Income Tax Return', description: 'NC resident return' },
        { number: 'D-400-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'D-410', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'D-400X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CD-405', name: 'North Carolina Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'CD-401S', name: 'S Corporation Income Tax Return', description: 'S corporation return' },
        { number: 'D-403', name: 'Partnership Income Tax Return', description: 'Partnership return' },
        { number: 'NC-5', name: "Employer's Quarterly Withholding Return", description: 'Quarterly withholding' },
    ]},
    'North Dakota': { abbr: 'ND', forms: [
        { number: 'ND-1', name: 'North Dakota Individual Income Tax Return', description: 'ND resident return' },
        { number: 'ND-1-ES', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'ND-1-EXT', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'ND-1X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '40', name: 'Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '58', name: 'Partnership Return', description: 'Partnership return' },
    ]},
    'Ohio': { abbr: 'OH', forms: [
        { number: 'IT 1040', name: 'Ohio Individual Income Tax Return', description: 'Ohio resident return' },
        { number: 'IT 1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'IT 40P', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IT 1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CAT', name: 'Commercial Activity Tax Return', description: 'Gross receipts tax (replaces corporate income tax)' },
        { number: 'IT 4708', name: 'Pass-Through Entity Return', description: 'Partnership/S Corp return' },
        { number: 'IT 1140', name: 'Financial Institution Tax Return', description: 'Financial institution tax' },
    ]},
    'Oklahoma': { abbr: 'OK', forms: [
        { number: '511', name: 'Oklahoma Individual Income Tax Return', description: 'Oklahoma resident return' },
        { number: '511-NR', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: 'OW-8-ES', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: '504', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '511X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '512', name: 'Oklahoma Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '514', name: 'Oklahoma Partnership Return', description: 'Partnership return' },
    ]},
    'Oregon': { abbr: 'OR', forms: [
        { number: '40', name: 'Oregon Individual Income Tax Return', description: 'Oregon resident return' },
        { number: '40N', name: 'Nonresident Individual Income Tax Return', description: 'Nonresident return' },
        { number: '40P', name: 'Part-Year Resident Individual Income Tax Return', description: 'Part-year resident return' },
        { number: '40-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '40-EXT', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '20', name: 'Oregon Corporation Excise Tax Return', description: 'Corporate excise tax' },
        { number: '20-S', name: 'Oregon S Corporation Tax Return', description: 'S corporation return' },
        { number: '65', name: 'Oregon Partnership Return', description: 'Partnership return' },
    ]},
    'Pennsylvania': { abbr: 'PA', forms: [
        { number: 'PA-40', name: 'Pennsylvania Individual Income Tax Return', description: 'PA resident return' },
        { number: 'PA-40-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'REV-276', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'PA-40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'RCT-101', name: 'PA Corporate Net Income Tax Return', description: 'Corporate income tax' },
        { number: 'PA-20S/PA-65', name: 'S Corporation/Partnership Return', description: 'Pass-through entity return' },
    ]},
    'Rhode Island': { abbr: 'RI', forms: [
        { number: 'RI-1040', name: 'Rhode Island Resident Income Tax Return', description: 'RI resident return' },
        { number: 'RI-1040NR', name: 'Nonresident Income Tax Return', description: 'Nonresident return' },
        { number: 'RI-1040-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'RI-4868', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'RI-1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'RI-1120C', name: 'Rhode Island Corporation Tax Return', description: 'Corporate income tax' },
        { number: 'RI-1065', name: 'Rhode Island Partnership Return', description: 'Partnership return' },
    ]},
    'South Carolina': { abbr: 'SC', forms: [
        { number: 'SC1040', name: 'South Carolina Individual Income Tax Return', description: 'SC resident return' },
        { number: 'SC1040-ES', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'SC4868', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'SC1040X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'SC1120', name: 'South Carolina Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: 'SC1120S', name: 'South Carolina S Corporation Return', description: 'S corporation return' },
        { number: 'SC1065', name: 'South Carolina Partnership Return', description: 'Partnership return' },
    ]},
    'South Dakota': { abbr: 'SD', forms: [
        { number: 'Sales Tax', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax (no income tax)' },
        { number: 'Bank Franchise Tax', name: 'Bank Franchise Tax Return', description: 'Tax on banks and financial institutions' },
    ]},
    'Tennessee': { abbr: 'TN', forms: [
        { number: 'FAE 170', name: 'Franchise and Excise Tax Return', description: 'Business franchise and excise tax (no individual income tax)' },
        { number: 'FAE 174', name: 'Franchise and Excise Tax Annual Return', description: 'Annual business tax return' },
        { number: 'Sales Tax', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax' },
    ]},
    'Texas': { abbr: 'TX', forms: [
        { number: '05-158-A', name: 'Texas Franchise Tax Report', description: 'Annual franchise tax (no income tax)' },
        { number: '05-163', name: 'Texas Franchise Tax No Tax Due Report', description: 'No tax due report for small businesses' },
        { number: '05-164', name: 'Texas Franchise Tax EZ Computation Report', description: 'Simplified franchise tax computation' },
        { number: '01-114', name: 'Texas Sales and Use Tax Return', description: 'Monthly/quarterly sales tax' },
    ]},
    'Utah': { abbr: 'UT', forms: [
        { number: 'TC-40', name: 'Utah Individual Income Tax Return', description: 'Utah resident return' },
        { number: 'TC-40-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: 'TC-546', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'TC-40X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'TC-20', name: 'Utah Corporation Franchise or Income Tax Return', description: 'Corporate income/franchise tax' },
        { number: 'TC-20S', name: 'Utah S Corporation Return', description: 'S corporation return' },
        { number: 'TC-65', name: 'Utah Partnership Return', description: 'Partnership return' },
    ]},
    'Vermont': { abbr: 'VT', forms: [
        { number: 'IN-111', name: 'Vermont Individual Income Tax Return', description: 'Vermont resident return' },
        { number: 'IN-114', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'IN-151', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IN-111X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CO-411', name: 'Vermont Corporate Income Tax Return', description: 'Corporate income tax' },
        { number: 'BI-471', name: 'Vermont Business Income Tax Return', description: 'Business income tax' },
    ]},
    'Virginia': { abbr: 'VA', forms: [
        { number: '760', name: 'Virginia Resident Individual Income Tax Return', description: 'Virginia resident return' },
        { number: '763', name: 'Nonresident Individual Income Tax Return', description: 'Nonresident return' },
        { number: '760-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '760IP', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '760-X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '500', name: 'Virginia Corporation Income Tax Return', description: 'Corporate income tax' },
        { number: '502', name: 'Virginia Pass-Through Entity Return', description: 'Partnership/S Corp return' },
        { number: 'VA-5', name: "Employer's Quarterly Withholding Return", description: 'Quarterly withholding' },
    ]},
    'Washington': { abbr: 'WA', forms: [
        { number: 'B&O Tax', name: 'Business and Occupation Tax Return', description: 'Gross receipts tax (no income tax)' },
        { number: 'Sales Tax', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax' },
        { number: 'Capital Gains', name: 'Washington Capital Gains Tax Return', description: 'New 7% tax on long-term capital gains >$250K' },
    ]},
    'West Virginia': { abbr: 'WV', forms: [
        { number: 'IT-140', name: 'West Virginia Individual Income Tax Return', description: 'WV resident return' },
        { number: 'IT-140-NRC', name: 'Nonresident Composite Return', description: 'Nonresident composite return' },
        { number: 'IT-140-ES', name: 'Estimated Tax Payment', description: 'Quarterly estimated payments' },
        { number: 'IT-140-EXT', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: 'IT-140X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: 'CNF-120', name: 'West Virginia Corporation Net Income Tax Return', description: 'Corporate income tax' },
        { number: 'SPF-100', name: 'West Virginia S Corporation/Partnership Return', description: 'Pass-through entity return' },
    ]},
    'Wisconsin': { abbr: 'WI', forms: [
        { number: '1', name: 'Wisconsin Individual Income Tax Return', description: 'Wisconsin resident return' },
        { number: '1NPR', name: 'Nonresident/Part-Year Resident Return', description: 'Nonresident return' },
        { number: '1-ES', name: 'Estimated Tax Payment Voucher', description: 'Quarterly estimated payments' },
        { number: '8868-W', name: 'Application for Extension', description: 'Extension of time to file' },
        { number: '1X', name: 'Amended Individual Income Tax Return', description: 'Amend previously filed return' },
        { number: '4', name: 'Wisconsin Corporation Franchise or Income Tax Return', description: 'Corporate income/franchise tax' },
        { number: '3', name: 'Wisconsin Partnership Return', description: 'Partnership return' },
        { number: '5S', name: 'Wisconsin S Corporation Tax Return', description: 'S corporation return' },
    ]},
    'Wyoming': { abbr: 'WY', forms: [
        { number: 'Sales Tax', name: 'Sales and Use Tax Return', description: 'Monthly/quarterly sales tax (no income tax)' },
        { number: 'Mineral Tax', name: 'Mineral Tax Return', description: 'Mineral severance/production tax' },
    ]},
};

// Generate state forms array from the data
export const stateForms: TaxForm[] = Object.entries(stateFormData).flatMap(([state, data]) =>
    data.forms.map((form, i) => ({
        id: `s-${data.abbr.toLowerCase()}-${i}`,
        number: `${data.abbr} ${form.number}`,
        name: form.name,
        description: form.description,
        category: 'State Forms',
        state,
    }))
);

// All states list for the dropdown
export const allStates = Object.keys(stateFormData).sort();

// Combined forms array
export const allForms: TaxForm[] = [...federalForms, ...stateForms];

// ══════════════════════════════════════════════════════════════
//  DOCUMENT REQUEST SCENARIOS
//  Maps tax situations → required supporting documents for collection
// ══════════════════════════════════════════════════════════════

export interface DocumentRequirement {
    id: string;
    label: string;
    description: string;
    category: string;
    required: boolean;
}

export interface DocumentRequestScenario {
    id: string;
    name: string;
    description: string;
    formNumbers: string[];
    requirements: DocumentRequirement[];
}

export const documentRequestScenarios: DocumentRequestScenario[] = [
    {
        id: 'individual-1040',
        name: 'Individual Tax Return (1040)',
        description: 'Documents needed for individual income tax preparation',
        formNumbers: ['1040', '1040-SR', '1040-NR'],
        requirements: [
            // Income — Required
            { id: 'w2', label: 'W-2 (all employers)', description: 'Wage and Tax Statement from each employer', category: 'Income', required: true },
            // Income — Common
            { id: '1099-int', label: '1099-INT', description: 'Interest income from banks/investments', category: 'Income', required: false },
            { id: '1099-div', label: '1099-DIV', description: 'Dividend income statements', category: 'Income', required: false },
            { id: '1099-b', label: '1099-B / Brokerage Statement', description: 'Investment sale proceeds and cost basis', category: 'Income', required: false },
            { id: '1099-nec', label: '1099-NEC', description: 'Freelance / independent contractor income', category: 'Income', required: false },
            { id: '1099-misc', label: '1099-MISC', description: 'Rents, royalties, prizes, other income', category: 'Income', required: false },
            { id: '1099-r', label: '1099-R', description: 'Retirement plan / IRA distributions', category: 'Income', required: false },
            { id: 'ssa-1099', label: 'SSA-1099', description: 'Social Security benefits statement', category: 'Income', required: false },
            { id: '1099-g', label: '1099-G', description: 'Unemployment compensation / state tax refunds', category: 'Income', required: false },
            { id: '1099-k', label: '1099-K', description: 'Payment card / third-party network transactions', category: 'Income', required: false },
            { id: '1099-s', label: '1099-S', description: 'Real estate sale proceeds', category: 'Income', required: false },
            { id: 'schedule-k1', label: 'Schedule K-1', description: 'Partnership, S-Corp, or trust income', category: 'Income', required: false },
            { id: 'rental-income', label: 'Rental Income & Expenses', description: 'Rental property income, expenses, and depreciation records', category: 'Income', required: false },
            // Deductions
            { id: '1098', label: '1098 — Mortgage Interest', description: 'Mortgage interest statement from lender', category: 'Deductions', required: false },
            { id: '1098-e', label: '1098-E — Student Loan Interest', description: 'Student loan interest paid', category: 'Deductions', required: false },
            { id: '1098-t', label: '1098-T — Tuition Statement', description: 'Tuition paid to educational institution', category: 'Deductions', required: false },
            { id: 'charitable', label: 'Charitable Donation Receipts', description: 'Receipts for cash and non-cash donations (required for $250+)', category: 'Deductions', required: false },
            { id: 'property-tax', label: 'Property Tax Statement', description: 'Annual real estate tax bill', category: 'Deductions', required: false },
            { id: 'medical', label: 'Medical Expense Summary', description: 'Unreimbursed medical and dental expenses', category: 'Deductions', required: false },
            { id: 'childcare', label: 'Childcare / Dependent Care Receipts', description: 'Daycare provider name, address, TIN, and amounts paid', category: 'Deductions', required: false },
            { id: 'educator-expenses', label: 'Educator Expenses', description: 'Classroom supplies receipts (K-12 teachers)', category: 'Deductions', required: false },
            // Health Insurance
            { id: '1095-a', label: '1095-A — Marketplace Statement', description: 'Health Insurance Marketplace coverage and premium tax credits', category: 'Health Insurance', required: false },
            // Self-Employment
            { id: 'business-income-expenses', label: 'Business Income & Expense Records', description: 'Revenue, expenses, receipts for Schedule C', category: 'Self-Employment', required: false },
            { id: 'home-office', label: 'Home Office Measurements', description: 'Square footage of office and total home for Form 8829', category: 'Self-Employment', required: false },
            { id: 'vehicle-mileage', label: 'Vehicle Mileage Log', description: 'Business miles driven during the year', category: 'Self-Employment', required: false },
            // Identity & Reference
            { id: 'prior-return', label: 'Prior Year Tax Return', description: 'Previous year Form 1040 (all pages including W-2s)', category: 'Reference', required: true },
            { id: 'id-front', label: 'Photo ID (front)', description: 'Driver license, state ID, or passport', category: 'Identity', required: true },
            { id: 'id-back', label: 'Photo ID (back)', description: 'Back of driver license or state ID', category: 'Identity', required: true },
            { id: 'bank-info', label: 'Bank Account Info (for direct deposit)', description: 'Voided check or bank statement showing routing and account number', category: 'Reference', required: false },
            { id: 'ip-pin', label: 'IRS Identity Protection PIN', description: 'IP PIN letter from IRS (if received)', category: 'Reference', required: false },
        ],
    },
    {
        id: 'scorp-1120s',
        name: 'S Corporation Return (1120-S)',
        description: 'Documents needed for S corporation tax preparation',
        formNumbers: ['1120-S'],
        requirements: [
            { id: 'financial-statements', label: 'Financial Statements', description: 'Balance sheet, income statement, and cash flow statement', category: 'Financial', required: true },
            { id: 'trial-balance', label: 'Year-End Trial Balance', description: 'General ledger trial balance as of 12/31', category: 'Financial', required: true },
            { id: 'bank-statements', label: 'Bank Statements (all accounts)', description: 'December bank statements for all business accounts', category: 'Financial', required: true },
            { id: 'officer-comp', label: 'Officer Compensation Details', description: 'W-2s and compensation breakdown for all officers', category: 'Payroll', required: true },
            { id: 'payroll-reports', label: 'Annual Payroll Reports', description: 'Annual 941 summary, W-3, and state unemployment reports', category: 'Payroll', required: true },
            { id: '1099-issued', label: '1099s Issued to Contractors', description: 'Copies of all 1099-NEC/MISC forms issued', category: 'Payroll', required: false },
            { id: 'depreciation-schedule', label: 'Depreciation Schedule', description: 'Fixed asset list with dates, costs, and depreciation', category: 'Assets', required: true },
            { id: 'asset-purchases', label: 'Asset Purchase Invoices', description: 'Invoices for equipment, vehicles, or property purchased', category: 'Assets', required: false },
            { id: 'asset-dispositions', label: 'Asset Sale/Disposal Records', description: 'Records of assets sold, traded, or disposed', category: 'Assets', required: false },
            { id: 'loan-statements', label: 'Loan Statements', description: 'Year-end statements for all business loans', category: 'Financial', required: false },
            { id: 'lease-agreements', label: 'Lease Agreements', description: 'Commercial rent and equipment lease agreements', category: 'Financial', required: false },
            { id: 'shareholder-basis', label: 'Shareholder Basis Schedules', description: 'Stock and debt basis tracking for each shareholder', category: 'Ownership', required: true },
            { id: 'distributions', label: 'Shareholder Distribution Records', description: 'All distributions paid to shareholders during the year', category: 'Ownership', required: true },
            { id: 'prior-return-1120s', label: 'Prior Year Form 1120-S', description: 'Previous year return with all schedules and K-1s', category: 'Reference', required: true },
            { id: 'state-returns', label: 'Prior Year State Returns', description: 'All state returns from prior year', category: 'Reference', required: false },
        ],
    },
    {
        id: 'ccorp-1120',
        name: 'C Corporation Return (1120)',
        description: 'Documents needed for C corporation tax preparation',
        formNumbers: ['1120'],
        requirements: [
            { id: 'financial-statements', label: 'Financial Statements', description: 'Audited or compiled balance sheet, P&L, cash flow', category: 'Financial', required: true },
            { id: 'trial-balance', label: 'Year-End Trial Balance', description: 'General ledger trial balance', category: 'Financial', required: true },
            { id: 'bank-statements', label: 'Bank Statements (December)', description: 'All business bank account statements', category: 'Financial', required: true },
            { id: 'officer-comp', label: 'Officer Compensation', description: 'W-2s and compensation details for all officers/directors', category: 'Payroll', required: true },
            { id: 'payroll-reports', label: 'Payroll Tax Reports', description: 'Quarterly 941s, annual W-3, state reports', category: 'Payroll', required: true },
            { id: 'depreciation-schedule', label: 'Depreciation Schedule', description: 'Fixed assets with acquisition dates, costs, depreciation', category: 'Assets', required: true },
            { id: 'stock-records', label: 'Stock Ownership Records', description: 'Shareholder list, shares issued, and ownership changes', category: 'Ownership', required: true },
            { id: 'dividend-records', label: 'Dividend Payment Records', description: 'All dividends declared and paid during the year', category: 'Ownership', required: false },
            { id: 'estimated-payments', label: 'Estimated Tax Payment Records', description: 'Federal and state estimated tax payments made', category: 'Tax Payments', required: true },
            { id: 'loan-documents', label: 'Loan Agreements & Statements', description: 'All business loan year-end statements', category: 'Financial', required: false },
            { id: 'insurance-premiums', label: 'Insurance Premium Statements', description: 'Business insurance policies and premiums paid', category: 'Expenses', required: false },
            { id: 'prior-return-1120', label: 'Prior Year Form 1120', description: 'Previous year corporate return with all schedules', category: 'Reference', required: true },
        ],
    },
    {
        id: 'partnership-1065',
        name: 'Partnership Return (1065)',
        description: 'Documents needed for partnership tax preparation',
        formNumbers: ['1065'],
        requirements: [
            { id: 'partnership-agreement', label: 'Partnership / Operating Agreement', description: 'Current agreement showing profit/loss allocation percentages', category: 'Legal', required: true },
            { id: 'financial-statements', label: 'Financial Statements', description: 'Balance sheet and income statement', category: 'Financial', required: true },
            { id: 'trial-balance', label: 'Year-End Trial Balance', description: 'General ledger trial balance', category: 'Financial', required: true },
            { id: 'bank-statements', label: 'Bank Statements (December)', description: 'All partnership bank account statements', category: 'Financial', required: true },
            { id: 'guaranteed-payments', label: 'Guaranteed Payment Records', description: 'All guaranteed payments made to partners', category: 'Partners', required: true },
            { id: 'partner-contributions', label: 'Partner Contribution Records', description: 'Cash and property contributions during the year', category: 'Partners', required: true },
            { id: 'partner-distributions', label: 'Partner Distribution Records', description: 'All distributions made to partners', category: 'Partners', required: true },
            { id: 'partner-capital', label: 'Partner Capital Account Schedules', description: 'Beginning and ending capital account for each partner', category: 'Partners', required: true },
            { id: 'depreciation-schedule', label: 'Depreciation Schedule', description: 'Fixed asset list with depreciation', category: 'Assets', required: true },
            { id: 'payroll-reports', label: 'Payroll Reports (if applicable)', description: 'Quarterly 941s if partnership has employees', category: 'Payroll', required: false },
            { id: '1099-issued', label: '1099s Issued', description: 'Copies of 1099s issued to contractors', category: 'Payroll', required: false },
            { id: 'rental-properties', label: 'Rental Property Records', description: 'Income, expenses, and depreciation for rental properties', category: 'Income', required: false },
            { id: 'prior-return-1065', label: 'Prior Year Form 1065', description: 'Previous year return with all K-1s', category: 'Reference', required: true },
        ],
    },
    {
        id: 'estate-trust-1041',
        name: 'Estate / Trust Return (1041)',
        description: 'Documents needed for estate or trust tax preparation',
        formNumbers: ['1041'],
        requirements: [
            { id: 'trust-document', label: 'Trust Document / Will', description: 'Trust agreement or last will and testament', category: 'Legal', required: true },
            { id: 'death-certificate', label: 'Death Certificate (if estate)', description: 'Certified copy of death certificate', category: 'Legal', required: true },
            { id: 'ein-letter', label: 'EIN Assignment Letter', description: 'IRS letter assigning the estate/trust EIN', category: 'Legal', required: true },
            { id: 'asset-inventory', label: 'Asset Inventory', description: 'Complete list of assets with date-of-death values', category: 'Assets', required: true },
            { id: 'income-records', label: 'Income Records (1099s, K-1s)', description: 'All income received by the estate/trust', category: 'Income', required: true },
            { id: 'bank-statements', label: 'Bank Statements', description: 'All estate/trust bank account statements', category: 'Financial', required: true },
            { id: 'distribution-records', label: 'Distribution Records', description: 'Amounts distributed to beneficiaries', category: 'Beneficiaries', required: true },
            { id: 'beneficiary-info', label: 'Beneficiary Information', description: 'Names, SSNs, addresses of all beneficiaries', category: 'Beneficiaries', required: true },
            { id: 'expense-records', label: 'Estate/Trust Expenses', description: 'Legal fees, accounting fees, trustee fees, property expenses', category: 'Expenses', required: true },
            { id: 'real-estate-records', label: 'Real Estate Records', description: 'Property valuations, rental income, sale proceeds', category: 'Assets', required: false },
            { id: 'prior-return-1041', label: 'Prior Year Form 1041', description: 'Previous year fiduciary return', category: 'Reference', required: false },
        ],
    },
    {
        id: 'new-client',
        name: 'New Client Onboarding',
        description: 'Standard documents for onboarding a new tax client',
        formNumbers: [],
        requirements: [
            { id: 'id-front', label: 'Photo ID — Front', description: 'Driver license, state ID, or passport', category: 'Identity', required: true },
            { id: 'id-back', label: 'Photo ID — Back', description: 'Back of driver license or state ID', category: 'Identity', required: true },
            { id: 'ssn-card', label: 'Social Security Card', description: 'SSN card for taxpayer (and spouse if MFJ)', category: 'Identity', required: true },
            { id: 'dep-ssn', label: 'Dependent SSN Cards / Birth Certificates', description: 'SSN cards or birth certificates for all dependents', category: 'Identity', required: false },
            { id: 'prior-2-returns', label: 'Prior 2 Years Tax Returns', description: 'Most recent 2 years of federal and state returns (all pages)', category: 'Reference', required: true },
            { id: 'engagement-letter', label: 'Signed Engagement Letter', description: 'Your firm engagement letter / service agreement', category: 'Legal', required: true },
            { id: 'w9-signed', label: 'Completed W-9', description: 'W-9 for firm records (TIN verification)', category: 'Legal', required: false },
            { id: 'bank-info', label: 'Bank Account Information', description: 'Voided check or bank statement for direct deposit setup', category: 'Reference', required: false },
            { id: 'ip-pin', label: 'IRS Identity Protection PIN', description: 'IP PIN letter from IRS (if received)', category: 'Reference', required: false },
            { id: 'poa-8821', label: 'Signed Form 8821 or 2848', description: 'Tax information authorization or power of attorney', category: 'Legal', required: false },
        ],
    },
    {
        id: 'tax-resolution',
        name: 'Tax Resolution / IRS Issue',
        description: 'Documents needed for tax resolution, installment agreements, or offers in compromise',
        formNumbers: ['9465', '656', '433-A', '433-A (OIC)', '433-B', '433-F', '2848'],
        requirements: [
            { id: 'cp-notices', label: 'IRS Notices / CP Letters', description: 'All IRS letters and notices received (CP14, CP504, etc.)', category: 'IRS Correspondence', required: true },
            { id: 'tax-transcripts', label: 'Tax Transcripts', description: 'Account transcripts and return transcripts for all years at issue', category: 'IRS Records', required: true },
            { id: 'unfiled-returns', label: 'Unfiled Tax Returns', description: 'Any returns that still need to be filed', category: 'Tax Returns', required: true },
            { id: 'prior-returns', label: 'Prior 3 Years Tax Returns', description: 'Filed returns for the 3 most recent tax years', category: 'Tax Returns', required: true },
            { id: 'pay-stubs', label: 'Recent Pay Stubs', description: 'Last 3 months of pay stubs (all jobs)', category: 'Income Verification', required: true },
            { id: 'bank-statements-3mo', label: 'Bank Statements (last 3 months)', description: 'All bank account statements for the past 3 months', category: 'Financial', required: true },
            { id: 'investment-statements', label: 'Investment / Retirement Statements', description: 'Current balances of 401k, IRA, brokerage accounts', category: 'Assets', required: true },
            { id: 'mortgage-statement', label: 'Mortgage Statement', description: 'Current mortgage balance and monthly payment', category: 'Expenses', required: false },
            { id: 'vehicle-values', label: 'Vehicle Information', description: 'Year, make, model, mileage, and loan balance for each vehicle', category: 'Assets', required: true },
            { id: 'real-estate-values', label: 'Real Estate Values', description: 'Property tax assessments or recent appraisals', category: 'Assets', required: false },
            { id: 'monthly-expenses', label: 'Monthly Living Expense Breakdown', description: 'Housing, food, transportation, healthcare, insurance, etc.', category: 'Expenses', required: true },
            { id: 'poa-2848', label: 'Signed Form 2848 (Power of Attorney)', description: 'Authorizes representative to act before IRS', category: 'Legal', required: true },
            { id: 'id-front', label: 'Photo ID', description: 'Driver license or state-issued ID', category: 'Identity', required: true },
        ],
    },
    {
        id: 'payroll-setup',
        name: 'Payroll / Employment Tax Setup',
        description: 'Documents needed for payroll setup and quarterly 941 filings',
        formNumbers: ['941', '940', 'W-4', 'I-9'],
        requirements: [
            { id: 'ein-letter', label: 'EIN Assignment Letter (CP 575)', description: 'IRS letter confirming Employer Identification Number', category: 'Business', required: true },
            { id: 'state-withholding-id', label: 'State Withholding ID', description: 'State tax withholding registration number', category: 'Business', required: true },
            { id: 'state-unemployment-id', label: 'State Unemployment ID & Rate', description: 'SUTA registration number and assigned tax rate', category: 'Business', required: true },
            { id: 'employee-w4s', label: 'W-4 Forms (all employees)', description: 'Completed W-4 withholding certificates', category: 'Employees', required: true },
            { id: 'employee-i9s', label: 'I-9 Forms (all employees)', description: 'Employment eligibility verification with supporting documents', category: 'Employees', required: true },
            { id: 'direct-deposit', label: 'Direct Deposit Authorization Forms', description: 'Employee bank routing and account numbers', category: 'Employees', required: false },
            { id: 'pay-schedule', label: 'Pay Schedule & Rate Information', description: 'Pay frequency, hourly rates or salary amounts, overtime rules', category: 'Compensation', required: true },
            { id: 'benefits-info', label: 'Employee Benefits Information', description: 'Health insurance, 401k, and other benefit details', category: 'Compensation', required: false },
            { id: 'prior-941s', label: 'Prior Year 941s', description: 'Quarterly 941 returns from prior year', category: 'Reference', required: false },
            { id: 'workers-comp', label: "Workers' Compensation Policy", description: 'Current workers comp certificate and policy details', category: 'Insurance', required: false },
        ],
    },
];

// Helper: find scenario by form number
export function getScenarioForForm(formNumber: string): DocumentRequestScenario | undefined {
    return documentRequestScenarios.find(s => s.formNumbers.includes(formNumber));
}

