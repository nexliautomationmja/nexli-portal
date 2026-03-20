/* ================================================================== */
/*  Smart Document Generation Rules                                    */
/*  Maps tax organizer answers → required document upload list         */
/* ================================================================== */

import type { ReturnType } from "./tax-organizer-questions";

interface DocRule {
  /** Human-readable document name */
  document: string;
  /** Category for document uploads */
  category: string;
  /** Condition: returns true if this document is needed */
  condition: (allSections: Record<string, Record<string, unknown>>) => boolean;
}

/* ── Helper to safely read nested values ── */
function get(
  sections: Record<string, Record<string, unknown>>,
  sectionKey: string,
  fieldKey: string
): unknown {
  return sections[sectionKey]?.[fieldKey];
}

function isChecked(
  sections: Record<string, Record<string, unknown>>,
  sectionKey: string,
  groupKey: string,
  itemKey: string
): boolean {
  const group = get(sections, sectionKey, groupKey);
  if (typeof group === "object" && group !== null) {
    return (group as Record<string, boolean>)[itemKey] === true;
  }
  return false;
}

function isYes(
  sections: Record<string, Record<string, unknown>>,
  sectionKey: string,
  fieldKey: string
): boolean {
  return get(sections, sectionKey, fieldKey) === "yes";
}

/* ================================================================== */
/*  1040 Rules                                                         */
/* ================================================================== */

const individual1040Rules: DocRule[] = [
  // Always required for 1040
  { document: "Photo ID (front and back)", category: "ID/License", condition: () => true },
  { document: "Social Security card(s)", category: "SSN Card", condition: () => true },
  { document: "Prior year tax return", category: "Prior Return", condition: (s) => !isYes(s, "life_events", "prior_firm_prep") },
  { document: "Bank account information (voided check or statement)", category: "Bank Info", condition: (s) => {
    const method = get(s, "refund_payment", "refund_method");
    return method === "direct_deposit";
  }},

  // Income documents
  { document: "W-2 (Wage & Tax Statement) — all employers", category: "W-2", condition: (s) => isChecked(s, "income", "income_types", "w2") },
  { document: "1099-INT (Interest Income)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_int") },
  { document: "1099-DIV (Dividends)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_div") },
  { document: "1099-B (Investment Sales)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_b") },
  { document: "1099-NEC / 1099-K (Self-Employment Income)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_nec_k") },
  { document: "1099-MISC (Rents)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_misc_rents") },
  { document: "1099-MISC (Royalties)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_misc_royalties") },
  { document: "1099-R (Retirement Distributions)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_r") },
  { document: "1099-G (State Refund / Unemployment)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_g_refund") || isChecked(s, "income", "income_types", "1099_g_unemployment") },
  { document: "1099-C (Canceled Debt)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_c") },
  { document: "1099-SA (HSA/MSA Distribution)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_sa") },
  { document: "1099-Q (ESA/529 Distribution)", category: "1099", condition: (s) => isChecked(s, "income", "income_types", "1099_q") },
  { document: "SSA-1099 (Social Security Benefits)", category: "SSA-1099", condition: (s) => isChecked(s, "income", "income_types", "ssa_1099") },
  { document: "Schedule K-1 (Partnership)", category: "K-1", condition: (s) => isChecked(s, "income", "income_types", "k1_partnership") },
  { document: "Schedule K-1 (S Corporation)", category: "K-1", condition: (s) => isChecked(s, "income", "income_types", "k1_scorp") },
  { document: "Schedule K-1 (Estate/Trust)", category: "K-1", condition: (s) => isChecked(s, "income", "income_types", "k1_estate_trust") },
  { document: "W-2G (Gambling Winnings)", category: "W-2G", condition: (s) => isChecked(s, "income", "income_types", "w2g") },
  { document: "Farm income records", category: "Farm", condition: (s) => isChecked(s, "income", "income_types", "farming") },

  // Self-employment additional docs
  { document: "Business income & expense records (Schedule C)", category: "Schedule C", condition: (s) => isChecked(s, "income", "income_types", "1099_nec_k") },
  { document: "Vehicle/mileage log (if business use)", category: "Mileage", condition: (s) => isChecked(s, "income", "income_types", "1099_nec_k") },
  { document: "Home office measurements/expenses", category: "Home Office", condition: (s) => isChecked(s, "income", "income_types", "1099_nec_k") },

  // Rental income
  { document: "Rental income & expense records", category: "Rental", condition: (s) => isChecked(s, "income", "income_types", "1099_misc_rents") },

  // Deduction documents
  { document: "1098 (Mortgage Interest Statement)", category: "1098", condition: (s) => {
    const amt = get(s, "deductions", "mortgage_interest");
    return typeof amt === "string" ? parseFloat(amt) > 0 : !!amt;
  }},
  { document: "Property tax statements", category: "Property Tax", condition: (s) => {
    const amt = get(s, "deductions", "real_estate_taxes");
    return typeof amt === "string" ? parseFloat(amt) > 0 : !!amt;
  }},
  { document: "Charitable donation receipts (cash)", category: "Charitable", condition: (s) => {
    const amt = get(s, "deductions", "charitable_cash");
    return typeof amt === "string" ? parseFloat(amt) > 0 : !!amt;
  }},
  { document: "Charitable donation receipts (non-cash)", category: "Charitable", condition: (s) => {
    const amt = get(s, "deductions", "charitable_noncash");
    return typeof amt === "string" ? parseFloat(amt) > 0 : !!amt;
  }},
  { document: "Medical/dental expense records", category: "Medical", condition: (s) => {
    const amt = get(s, "deductions", "medical_dental");
    return typeof amt === "string" ? parseFloat(amt) > 0 : !!amt;
  }},

  // Expense documents
  { document: "Childcare provider details (name, address, EIN, amount paid)", category: "Childcare", condition: (s) => isChecked(s, "expenses", "expense_types", "childcare") },
  { document: "1098-T (Tuition Statement)", category: "1098-T", condition: (s) => isChecked(s, "expenses", "expense_types", "higher_education") },
  { document: "1098-E (Student Loan Interest)", category: "1098-E", condition: (s) => isChecked(s, "expenses", "expense_types", "student_loan") },
  { document: "HSA contribution records (Form 5498-SA)", category: "HSA", condition: (s) => isChecked(s, "expenses", "expense_types", "hsa") },
  { document: "IRA contribution records (Form 5498)", category: "IRA", condition: (s) => isChecked(s, "expenses", "expense_types", "ira") },
  { document: "Adoption expense documentation", category: "Adoption", condition: (s) => isChecked(s, "expenses", "expense_types", "adoption") },
  { document: "Educator expense receipts", category: "Educator", condition: (s) => isChecked(s, "expenses", "expense_types", "educator") },
  { document: "Energy-efficient home improvement receipts", category: "Energy", condition: (s) => isChecked(s, "expenses", "expense_types", "energy_improvements") },
  { document: "Electric vehicle purchase documentation", category: "EV", condition: (s) => isChecked(s, "expenses", "expense_types", "ev_purchase") },

  // Financial events
  { document: "HUD-1 / Closing Statement (home buy/sell/refinance)", category: "Real Estate", condition: (s) => isYes(s, "financial_events", "home_transaction") },
  { document: "Retirement account rollover/conversion documentation", category: "Retirement", condition: (s) => isYes(s, "financial_events", "retirement_rollover") },
  { document: "Digital asset transaction records", category: "Crypto", condition: (s) => isYes(s, "financial_events", "digital_assets") },
  { document: "Foreign account information (FBAR / FinCEN 114)", category: "Foreign", condition: (s) => isYes(s, "financial_events", "foreign_accounts") },
  { document: "Gift tax documentation (Form 709)", category: "Gift Tax", condition: (s) => isYes(s, "financial_events", "large_gifts") },
  { document: "1095-A (Health Insurance Marketplace Statement)", category: "1095-A", condition: (s) => isYes(s, "financial_events", "marketplace_insurance") },

  // Life events
  { document: "IRS/State notices or letters received", category: "IRS Notice", condition: (s) => isYes(s, "life_events", "irs_notice") },
  { document: "Identity Protection PIN (IP PIN)", category: "IP PIN", condition: (s) => isYes(s, "life_events", "ip_pin") },
  { document: "Dependent birth certificates / adoption papers", category: "Dependent Docs", condition: (s) => isYes(s, "life_events", "children_born_adopted") },
  { document: "Death certificate", category: "Death Certificate", condition: (s) => isYes(s, "life_events", "death_in_family") },

  // Estimated payments
  { document: "Estimated tax payment records (federal & state)", category: "Estimated Tax", condition: (s) => isYes(s, "estimated_taxes", "made_estimated") },

  // Dependents
  { document: "Dependent SSN cards / birth certificates", category: "Dependent Docs", condition: (s) => isYes(s, "dependents", "has_dependents") },
];

/* ================================================================== */
/*  Business (1120, 1120-S) Rules                                      */
/* ================================================================== */

const businessRules: DocRule[] = [
  { document: "Prior year tax return", category: "Prior Return", condition: () => true },
  { document: "Financial statements (P&L, Balance Sheet)", category: "Financial Statements", condition: () => true },
  { document: "Trial balance", category: "Trial Balance", condition: () => true },
  { document: "Bank statements (all accounts, full year)", category: "Bank Statement", condition: () => true },
  { document: "Officer/shareholder W-2s", category: "W-2", condition: () => true },
  { document: "Quarterly 941 filings", category: "941", condition: () => true },
  { document: "W-3 (Transmittal of Wage Statements)", category: "W-3", condition: () => true },
  { document: "1099s issued to contractors", category: "1099", condition: () => true },
  { document: "Depreciation schedule", category: "Depreciation", condition: () => true },
  { document: "Asset purchase invoices", category: "Assets", condition: (s) => isYes(s, "financial_summary", "asset_purchases") },
  { document: "Asset sale/disposition records", category: "Assets", condition: (s) => isYes(s, "financial_summary", "asset_dispositions") },
  { document: "Loan agreements and amortization schedules", category: "Loans", condition: (s) => isYes(s, "financial_summary", "new_loans") },
  { document: "Shareholder/partner distribution records", category: "Distributions", condition: (s) => isYes(s, "financial_summary", "distributions") },
  { document: "State tax returns (all applicable states)", category: "State Returns", condition: () => true },
];

/* ================================================================== */
/*  Partnership (1065) Rules                                           */
/* ================================================================== */

const partnershipRules: DocRule[] = [
  ...businessRules,
  { document: "Partnership agreement", category: "Legal", condition: () => true },
  { document: "Partner capital account records", category: "Capital Accounts", condition: () => true },
  { document: "Guaranteed payment records", category: "Guaranteed Payments", condition: () => true },
];

/* ================================================================== */
/*  Estate/Trust (1041) Rules                                          */
/* ================================================================== */

const estateTrustRules: DocRule[] = [
  { document: "Trust document / Will", category: "Legal", condition: () => true },
  { document: "Prior year Form 1041", category: "Prior Return", condition: () => true },
  { document: "EIN assignment letter", category: "EIN", condition: () => true },
  { document: "Death certificate (if estate)", category: "Death Certificate", condition: (s) => {
    const type = get(s, "trust_info", "entity_type");
    return type === "estate";
  }},
  { document: "1099-INT / 1099-DIV (trust/estate income)", category: "1099", condition: (s) => {
    const types = get(s, "assets_income", "income_types") as Record<string, boolean> | undefined;
    return !!(types?.interest || types?.dividends);
  }},
  { document: "1099-B (investment sales)", category: "1099", condition: (s) => {
    const types = get(s, "assets_income", "income_types") as Record<string, boolean> | undefined;
    return !!types?.capital_gains;
  }},
  { document: "Rental income & expense records", category: "Rental", condition: (s) => {
    const types = get(s, "assets_income", "income_types") as Record<string, boolean> | undefined;
    return !!types?.rental;
  }},
  { document: "Asset inventory with valuations", category: "Assets", condition: () => true },
  { document: "Distribution records to beneficiaries", category: "Distributions", condition: (s) => isYes(s, "distributions", "made_distributions") },
  { document: "Trustee/executor fee records", category: "Fees", condition: () => true },
  { document: "Legal fee invoices", category: "Legal Fees", condition: () => true },
  { document: "Bank statements (all trust/estate accounts)", category: "Bank Statement", condition: () => true },
  { document: "Beneficiary SSN information", category: "Beneficiary Info", condition: () => true },
];

/* ================================================================== */
/*  Main export                                                        */
/* ================================================================== */

export interface GeneratedDocument {
  document: string;
  category: string;
}

/**
 * Given all completed section data, generate the list of required documents.
 */
export function generateDocumentList(
  returnType: ReturnType,
  allSections: Record<string, Record<string, unknown>>
): GeneratedDocument[] {
  let rules: DocRule[];

  switch (returnType) {
    case "1040":
      rules = individual1040Rules;
      break;
    case "1120":
    case "1120S":
      rules = businessRules;
      break;
    case "1065":
      rules = partnershipRules;
      break;
    case "1041":
      rules = estateTrustRules;
      break;
    default:
      rules = individual1040Rules;
  }

  return rules
    .filter((rule) => {
      try {
        return rule.condition(allSections);
      } catch {
        return false;
      }
    })
    .map(({ document, category }) => ({ document, category }));
}
