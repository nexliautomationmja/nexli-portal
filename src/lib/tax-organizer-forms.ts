// ── Tax Organizer Form Definitions ──────────────────────────────
// Each return type has its own set of sections and questions.
// The client component uses these definitions to render the appropriate form.

export type QuestionType =
  | "text"
  | "email"
  | "phone"
  | "currency"
  | "date"
  | "number"
  | "yesNo"
  | "select"
  | "radio"
  | "textarea"
  | "checkboxGroup"
  | "repeater";

export interface BaseQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  halfWidth?: boolean;
}

export interface SelectQuestion extends BaseQuestion {
  type: "select" | "radio";
  options: { value: string; label: string }[];
}

export interface RepeaterQuestion extends BaseQuestion {
  type: "repeater";
  addLabel: string;
  fields: {
    id: string;
    label: string;
    type: "text" | "currency" | "date" | "number" | "yesNo" | "select";
    placeholder?: string;
    width?: string;
    options?: { value: string; label: string }[];
  }[];
}

export interface CheckboxGroupQuestion extends BaseQuestion {
  type: "checkboxGroup";
  options: { id: string; label: string }[];
}

export type Question =
  | BaseQuestion
  | SelectQuestion
  | RepeaterQuestion
  | CheckboxGroupQuestion;

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface ConditionalDoc {
  category: string;
  reason: string;
}

// ── 1040 Individual ────────────────────────────────────────────

const FORM_1040: FormSection[] = [
  {
    id: "personalInfo",
    title: "Personal Information",
    questions: [
      { id: "fullName", label: "Full Name", type: "text", required: true, placeholder: "Your full legal name", halfWidth: true },
      { id: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com", halfWidth: true },
      { id: "phone", label: "Phone", type: "phone", placeholder: "(555) 123-4567", halfWidth: true },
      {
        id: "filingStatus",
        label: "Filing Status",
        type: "select",
        required: true,
        options: [
          { value: "Single", label: "Single" },
          { value: "Married Filing Jointly", label: "Married Filing Jointly" },
          { value: "Married Filing Separately", label: "Married Filing Separately" },
          { value: "Head of Household", label: "Head of Household" },
          { value: "Qualifying Surviving Spouse", label: "Qualifying Surviving Spouse" },
        ],
        halfWidth: true,
      } as SelectQuestion,
      {
        id: "dependents",
        label: "Dependents",
        type: "repeater",
        addLabel: "+ Add Dependent",
        fields: [
          { id: "name", label: "Name", type: "text", placeholder: "Name" },
          { id: "relationship", label: "Relationship", type: "text", placeholder: "Relationship", width: "w-32" },
          { id: "dob", label: "Date of Birth", type: "date", width: "w-36" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "incomeSources",
    title: "Income Sources",
    description: "Select all that apply.",
    questions: [
      {
        id: "incomeSources",
        label: "Income Sources",
        type: "checkboxGroup",
        options: [
          { id: "w2", label: "W-2 Employment" },
          { id: "selfEmployment", label: "Self-Employment / 1099-NEC" },
          { id: "interest", label: "Interest Income (1099-INT)" },
          { id: "dividends", label: "Dividends (1099-DIV)" },
          { id: "rental", label: "Rental Income" },
          { id: "socialSecurity", label: "Social Security Benefits" },
          { id: "retirement", label: "Retirement Distributions" },
          { id: "capitalGains", label: "Capital Gains / Losses" },
          { id: "unemployment", label: "Unemployment Compensation" },
          { id: "crypto", label: "Cryptocurrency Transactions" },
        ],
      } as CheckboxGroupQuestion,
      { id: "incomeOther", label: "Other Income (describe)", type: "text", placeholder: "Any other income sources..." },
    ],
  },
  {
    id: "deductions",
    title: "Deductions & Credits",
    description: "Select all that may apply.",
    questions: [
      {
        id: "deductions",
        label: "Deductions",
        type: "checkboxGroup",
        options: [
          { id: "mortgage", label: "Mortgage Interest (1098)" },
          { id: "propertyTax", label: "Property Taxes" },
          { id: "charitable", label: "Charitable Donations" },
          { id: "medical", label: "Medical Expenses" },
          { id: "studentLoan", label: "Student Loan Interest" },
          { id: "education", label: "Education Credits / Tuition" },
          { id: "childcare", label: "Child / Dependent Care" },
          { id: "estimatedTax", label: "Estimated Tax Payments Made" },
          { id: "hsa", label: "HSA Contributions" },
          { id: "ira", label: "IRA Contributions" },
          { id: "homeOffice", label: "Home Office Expenses" },
          { id: "stateLocalTax", label: "State & Local Taxes (SALT)" },
        ],
      } as CheckboxGroupQuestion,
      { id: "deductionOther", label: "Other Deductions (describe)", type: "text", placeholder: "Any other deductions or credits..." },
    ],
  },
  {
    id: "notes",
    title: "Additional Notes",
    questions: [
      {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Anything else your tax professional should know? (life changes, new business, questions, etc.)",
      },
    ],
  },
];

// ── 1120S S-Corporation ────────────────────────────────────────

const FORM_1120S: FormSection[] = [
  {
    id: "generalInfo",
    title: "S Corporation General Information",
    questions: [
      { id: "legalName", label: "Legal Name of S Corporation", type: "text", required: true, placeholder: "Corporation legal name", halfWidth: true },
      { id: "ein", label: "EIN", type: "text", required: true, placeholder: "XX-XXXXXXX", halfWidth: true },
      { id: "address", label: "S Corporation Address", type: "text", placeholder: "Full mailing address (check if new address)" },
      { id: "representativeName", label: "S Corporation Representative", type: "text", placeholder: "Representative name", halfWidth: true },
      { id: "representativeTitle", label: "Title", type: "text", placeholder: "Title", halfWidth: true },
      { id: "representativeEmail", label: "Email", type: "email", placeholder: "representative@email.com", halfWidth: true },
      { id: "representativePhone", label: "Phone", type: "phone", placeholder: "(555) 123-4567", halfWidth: true },
      { id: "nameChange", label: "Did the corporation have a change of business name during the year?", type: "yesNo" },
      { id: "principalActivity", label: "Principal Business Activity", type: "text", placeholder: "e.g., Consulting, Manufacturing", halfWidth: true },
      { id: "principalProduct", label: "Principal Product or Service", type: "text", placeholder: "e.g., Software, Tax Preparation", halfWidth: true },
      { id: "dateBusinessStarted", label: "Date Business Started", type: "date", halfWidth: true },
      { id: "dateBusinessClosed", label: "Date Business Closed", type: "date", halfWidth: true },
      { id: "primaryPurposeProfit", label: "Was the primary purpose of the S corporation's activity to realize a profit?", type: "yesNo" },
      {
        id: "accountingMethod",
        label: "Accounting Method",
        type: "radio",
        options: [
          { value: "cash", label: "Cash" },
          { value: "accrual", label: "Accrual" },
          { value: "other", label: "Other" },
        ],
      } as SelectQuestion,
      { id: "accountingMethodOther", label: "If Other, specify", type: "text", placeholder: "Specify accounting method" },
      { id: "calendarYear", label: "Does the corporation file under a calendar year?", type: "yesNo" },
      { id: "fiscalYearEnd", label: "If no, what is the fiscal year end?", type: "text", placeholder: "e.g., June 30" },
    ],
  },
  {
    id: "specificQuestions",
    title: "S Corporation Specific Questions",
    questions: [
      { id: "annualMeeting", label: "Did the corporation hold an annual meeting with shareholders with a record of minutes maintained?", type: "yesNo" },
      { id: "wasCCorp", label: "Was the corporation a C corporation before it elected to be an S corporation?", type: "yesNo" },
      { id: "shareholderDisregarded", label: "Is any shareholder in the corporation a disregarded entity, a partnership, a trust, an S corporation, or an estate?", type: "yesNo" },
      { id: "owns20PctForeignDomestic", label: "Did the corporation own directly 20% or more, or own, directly or indirectly, 50% or more of the total stock issued and outstanding of any foreign or domestic corporation?", type: "yesNo" },
      { id: "owns20PctPartnershipTrust", label: "Did the corporation own directly an interest of 20% or more, or own, directly or indirectly, an interest of 50% or more in the profit, loss, or capital in any foreign or domestic partnership or in the beneficial interest of a trust?", type: "yesNo" },
      { id: "restrictedStock", label: "Did the corporation have any outstanding shares of restricted stock at the end of the tax year?", type: "yesNo" },
      { id: "stockOptions", label: "Did the corporation have any outstanding stock options, warrants, or similar instruments at the end of the tax year?", type: "yesNo" },
      { id: "nonShareholderDebt", label: "Did the corporation have any non-shareholder debt that was cancelled, forgiven, or had terms modified to reduce amount of principal?", type: "yesNo" },
      { id: "sElectionTerminated", label: "Was the corporation's S election terminated or revoked during the year?", type: "yesNo" },
      { id: "foreignAccount", label: "At any time during the year, did the corporation have an interest in, or signature authority over a financial account in a foreign country?", type: "yesNo" },
      { id: "shareholderTransfer", label: "Was there a distribution of property or a transfer (by sale or death) of a shareholder interest during the tax year?", type: "yesNo" },
      { id: "under250k", label: "Does the corporation satisfy the following conditions: total receipts less than $250,000 AND total assets less than $250,000?", type: "yesNo" },
      { id: "paid600Nonemployee", label: "Did the corporation pay $600 or more of nonemployee compensation to any individual? (If yes, include a copy of Form 1099-NEC for each)", type: "yesNo" },
      { id: "pppLoan", label: "Did the corporation have a Paycheck Protection Program (PPP) loan that was forgiven?", type: "yesNo" },
      { id: "digitalAssets", label: "At any time during this tax year, did the corporation (a) receive a digital asset (as a reward, award, or payment for property or services); or (b) sell, exchange, or otherwise dispose of a digital asset (or a financial interest in a digital asset)?", type: "yesNo" },
    ],
  },
  {
    id: "shareholders",
    title: "Principal Shareholders Ownership Information",
    questions: [
      {
        id: "shareholders",
        label: "Shareholders",
        type: "repeater",
        addLabel: "+ Add Shareholder",
        fields: [
          { id: "name", label: "Name/Title", type: "text", placeholder: "Name/Title" },
          { id: "taxId", label: "Tax ID (SSN or EIN)", type: "text", placeholder: "XXX-XX-XXXX" },
          { id: "address", label: "Address", type: "text", placeholder: "Address" },
          { id: "ownershipPct", label: "Ownership %", type: "number", placeholder: "0" },
          { id: "stockBasis", label: "Shareholder Stock Basis", type: "currency", placeholder: "0.00" },
          { id: "usCitizen", label: "U.S. Citizen?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
      { id: "totalShareholdersLastDay", label: "How many shareholders were there on the last day of the year?", type: "number", placeholder: "0" },
    ],
  },
  {
    id: "shareholderOfficers",
    title: "Shareholders — Officers or 2%+ Owners",
    description: "Provide the following information for any shareholder who was an officer or 2% or more owner of the corporation during the year.",
    questions: [
      {
        id: "shareholderOfficers",
        label: "Shareholder/Officer Details",
        type: "repeater",
        addLabel: "+ Add Shareholder/Officer",
        fields: [
          { id: "name", label: "Name", type: "text", placeholder: "Shareholder/Officer name" },
          { id: "wagesPaid", label: "Wages Paid", type: "currency", placeholder: "0.00" },
          { id: "healthInsurance", label: "Health Insurance Premiums Paid", type: "currency", placeholder: "0.00" },
          { id: "capitalContributions", label: "Capital Contributions from Shareholder", type: "currency", placeholder: "0.00" },
          { id: "distributions", label: "Distributions to Shareholder", type: "currency", placeholder: "0.00" },
          { id: "loansToCorpn", label: "Shareholder Loans to Corporation", type: "currency", placeholder: "0.00" },
          { id: "loansRepaid", label: "Loans Repaid by Corporation to Shareholder", type: "currency", placeholder: "0.00" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "balanceSheet",
    title: "S Corporation Balance Sheet",
    description: "Enter year-end balances for the corporation's assets, debts, and equity.",
    questions: [
      // Assets
      { id: "bankAccountBalance", label: "Bank Account End of Year Balance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "accountsReceivable", label: "Accounts Receivable at End of Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventories", label: "Inventories", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansToShareholders", label: "Loans to Shareholders", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "mortgagesLoansHeld", label: "Mortgages and Loans Held by Corporation", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "stocksBondsSecurities", label: "Stocks, Bonds, and Securities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherCurrentAssets", label: "Other Current Assets", type: "currency", placeholder: "0.00", halfWidth: true },
      // Debts & Equity
      { id: "accountsPayable", label: "Accounts Payable at Year End", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesLessThanOneYear", label: "Payables Less Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesMoreThanOneYear", label: "Payables More Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "mortgagesNotesPayable", label: "Mortgages, Notes Payable", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansFromShareholders", label: "Loans from Shareholders", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalStock", label: "Capital Stock (Common)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "retainedEarnings", label: "Retained Earnings", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "income",
    title: "S Corporation Income",
    description: "Include all Forms 1099-K received.",
    questions: [
      { id: "grossReceipts", label: "Gross Receipts or Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "returnsAllowances", label: "Returns and Allowances", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "interestIncome", label: "Interest Income (include all 1099-INT Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "dividendIncome", label: "Dividend Income (include all 1099-DIV Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalGainLoss", label: "Capital Gain/Loss (include all 1099-B Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherIncome", label: "Other Income (include a statement)", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "cogs",
    title: "S Corporation Cost of Goods Sold",
    description: "For manufacturers, wholesalers, and businesses that make, buy, or sell goods.",
    questions: [
      { id: "inventoryBeginning", label: "Inventory at Beginning of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "purchases", label: "Purchases", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "costOfLabor", label: "Cost of Labor", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "materialsSupplies", label: "Materials and Supplies", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventoryEnd", label: "Inventory at the End of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "expenses",
    title: "S Corporation Expenses",
    questions: [
      { id: "expAdvertising", label: "Advertising", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expAnnualCorpFees", label: "Annual Corporation Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBadDebts", label: "Bad Debts", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBankCharges", label: "Bank Charges", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBusinessLicenses", label: "Business Licenses", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCleaning", label: "Cleaning/Janitorial", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCommissions", label: "Commissions and Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOfficerCompensation", label: "Compensation of Officers", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expContractLabor", label: "Contract Labor (include Forms 1099-NEC)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEmployeeBenefits", label: "Employee Benefit Programs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEntertainment", label: "Entertainment (not deductible)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expHealthCareEmployee", label: "Health Care Plans — Employee", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expHealthCareShareholder", label: "Health Care Plans — Shareholder", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInsurance", label: "Insurance (other than health insurance)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestCreditCards", label: "Interest — Business Credit Cards", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestLoans", label: "Interest — Business Loans/Credit Lines", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestMortgage", label: "Interest — Mortgage", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInternet", label: "Internet Service", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expLegalProfessional", label: "Legal and Professional Services", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expMealsBusiness", label: "Meals — Business", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOfficeSupplies", label: "Office Supplies", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOrganizationCosts", label: "Organization Costs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expPensionEmployee", label: "Pension and Profit Sharing Plans — Employee", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expPensionShareholder", label: "Pension and Profit Sharing Plans — Shareholder", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEducation", label: "Professional Education and Training", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentEquipment", label: "Rent or Lease — Car, Machinery, Equipment", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentProperty", label: "Rent or Lease — Other Business Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentPaid", label: "Rent Paid", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRepairs", label: "Repairs and Maintenance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expSalariesWages", label: "Salaries and Wages (include Forms W-2)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesPayroll", label: "Taxes — Payroll", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesProperty", label: "Taxes — Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesSales", label: "Taxes — Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTelephone", label: "Telephone", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expUtilities", label: "Utilities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther2", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther2Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther3", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther3Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
    ],
  },
  {
    id: "carExpenses",
    title: "Car Expenses",
    description: "Use a separate form for each vehicle. You can use either the standard mileage rate or actual expenses.",
    questions: [
      { id: "carMakeModel", label: "Make/Model", type: "text", placeholder: "e.g., 2022 Toyota Camry", halfWidth: true },
      { id: "carDateInService", label: "Date Car Placed in Service", type: "date", halfWidth: true },
      { id: "carPersonalUse", label: "Car available for personal use during off-duty hours?", type: "yesNo" },
      { id: "carOtherPersonalCars", label: "Do you (or your spouse) have any other cars for personal use?", type: "yesNo" },
      { id: "carHaveEvidence", label: "Do you have evidence?", type: "yesNo" },
      { id: "carEvidenceWritten", label: "Is your evidence written?", type: "yesNo" },
      { id: "carTradedIn", label: "Did you trade in your car this year?", type: "yesNo" },
      { id: "carTradeInCost", label: "Cost of Trade-in", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carTradeInValue", label: "Trade-in Value", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carOdometerBegin", label: "Beginning of Year Odometer", type: "number", placeholder: "0", halfWidth: true },
      { id: "carOdometerEnd", label: "End of Year Odometer", type: "number", placeholder: "0", halfWidth: true },
      { id: "carBusinessMileage", label: "Business Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carCommutingMileage", label: "Commuting Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carOtherMileage", label: "Other Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carGasOil", label: "Gas/Oil", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carInsurance", label: "Insurance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carParkingTolls", label: "Parking Fees/Tolls", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carRegistration", label: "Registration/Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carRepairs", label: "Repairs", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "equipmentPurchases",
    title: "Equipment Purchases",
    description: "Enter depreciable assets purchased that have a useful life greater than one year.",
    questions: [
      {
        id: "equipmentPurchases",
        label: "Equipment Purchased",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "datePurchased", label: "Date Purchased", type: "date" },
          { id: "cost", label: "Cost", type: "currency", placeholder: "0.00" },
          { id: "dateInService", label: "Date Placed in Service", type: "date" },
          { id: "newOrUsed", label: "New or Used?", type: "select", options: [{ value: "new", label: "New" }, { value: "used", label: "Used" }] },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "equipmentDisposed",
    title: "Equipment Sold or Disposed of During Year",
    questions: [
      {
        id: "equipmentDisposed",
        label: "Equipment Disposed",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "dateOutOfService", label: "Date Out of Service", type: "date" },
          { id: "dateSold", label: "Date Sold", type: "date" },
          { id: "sellingPrice", label: "Selling Price/FMV", type: "currency", placeholder: "0.00" },
          { id: "tradeIn", label: "Trade-in?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "businessCredits",
    title: "S Corporation Business Credits",
    description: "If answered Yes for any of the below, please provide a statement with details.",
    questions: [
      { id: "creditDisability", label: "Did the corporation pay expenses to make it accessible by individuals with disabilities?", type: "yesNo" },
      { id: "creditFicaTips", label: "Did the corporation pay any FICA on employee wages for tips above minimum wage?", type: "yesNo" },
      { id: "creditLowIncomeHousing", label: "Did the corporation own any residential rental buildings providing qualified low-income housing?", type: "yesNo" },
      { id: "creditResearch", label: "Did the corporation incur any research and experimental expenditures during the tax year?", type: "yesNo" },
      { id: "creditPensionStartup", label: "Did the corporation have employer pension plan start-up costs?", type: "yesNo" },
      { id: "creditPensionEmployees", label: "Total Number of Employees (for pension)", type: "number", placeholder: "0" },
      { id: "creditHealthInsurance", label: "Did the corporation pay health insurance premiums for employees?", type: "yesNo" },
      { id: "creditHealthEmployees", label: "Total Number of Employees (for health insurance)", type: "number", placeholder: "0" },
      { id: "creditElectricVehicles", label: "Did the corporation purchase and place in service any electric vehicles or energy efficient commercial building property?", type: "yesNo" },
    ],
  },
  {
    id: "stateTaxPayments",
    title: "State Estimated or Pass-Through Entity (PTE) Tax Payments",
    questions: [
      {
        id: "stateTaxPayments",
        label: "State Tax Payments",
        type: "repeater",
        addLabel: "+ Add Payment",
        fields: [
          { id: "state", label: "State", type: "text", placeholder: "State" },
          { id: "amount", label: "Amount", type: "currency", placeholder: "0.00" },
          { id: "datePaid", label: "Date Paid", type: "date" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "notes",
    title: "Additional Notes",
    questions: [
      {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Any additional information, documents needed, or questions for your tax professional...",
      },
    ],
  },
];

// ── 1120 C-Corporation ─────────────────────────────────────────

const FORM_1120: FormSection[] = [
  {
    id: "generalInfo",
    title: "C Corporation General Information",
    questions: [
      { id: "legalName", label: "Legal Name of C Corporation", type: "text", required: true, placeholder: "Corporation legal name", halfWidth: true },
      { id: "ein", label: "EIN", type: "text", required: true, placeholder: "XX-XXXXXXX", halfWidth: true },
      { id: "address", label: "C Corporation Address", type: "text", placeholder: "Full mailing address (check if new address)" },
      { id: "dateIncorporated", label: "Date Incorporated", type: "date", halfWidth: true },
      { id: "stateOfIncorporation", label: "State of Incorporation", type: "text", placeholder: "e.g., Delaware", halfWidth: true },
      { id: "stateDomicile", label: "Corporation State Domicile", type: "text", placeholder: "e.g., California", halfWidth: true },
      { id: "representativeName", label: "Corporation Representative", type: "text", placeholder: "Representative name", halfWidth: true },
      { id: "representativeTitle", label: "Title", type: "text", placeholder: "Title", halfWidth: true },
      { id: "representativeEmail", label: "Email", type: "email", placeholder: "representative@email.com", halfWidth: true },
      { id: "representativePhone", label: "Phone", type: "phone", placeholder: "(555) 123-4567", halfWidth: true },
      { id: "nameChange", label: "Did the corporation have a change of business name during the year?", type: "yesNo" },
      { id: "principalActivity", label: "Principal Business Activity", type: "text", placeholder: "e.g., Consulting, Manufacturing", halfWidth: true },
      { id: "principalProduct", label: "Principal Product or Service", type: "text", placeholder: "e.g., Software, Tax Preparation", halfWidth: true },
      { id: "primaryPurposeProfit", label: "Was the primary purpose of the corporation's activity to realize a profit?", type: "yesNo" },
      { id: "isPSC", label: "Is the corporation a Personal Service Corporation (PSC)?", type: "yesNo" },
      {
        id: "accountingMethod",
        label: "Accounting Method",
        type: "radio",
        options: [
          { value: "cash", label: "Cash" },
          { value: "accrual", label: "Accrual" },
          { value: "other", label: "Other" },
        ],
      } as SelectQuestion,
      { id: "accountingMethodOther", label: "If Other, specify", type: "text", placeholder: "Specify accounting method" },
      { id: "calendarYear", label: "Does the corporation file under a calendar year?", type: "yesNo" },
      { id: "fiscalYearEnd", label: "If no, what is the fiscal year end?", type: "text", placeholder: "e.g., June 30" },
      { id: "totalAssets", label: "Total assets of the corporation at the end of the tax year (enter 0 if none)", type: "currency", placeholder: "0.00" },
    ],
  },
  {
    id: "specificQuestions",
    title: "C Corporation Specific Questions",
    questions: [
      { id: "priorReturnChanges", label: "Has the corporation been notified of any changes to previous returns by any taxing authority? If yes, provide copies of all correspondence.", type: "yesNo" },
      { id: "ownershipChanges", label: "Provide a schedule of ownership changes during the year, including dates and number of shares or percentage of ownership.", type: "yesNo" },
      { id: "buySellChanges", label: "Have there been any changes to the shareholder's buy-sell agreements? If yes, provide a copy.", type: "yesNo" },
      { id: "annualMeeting", label: "Did the corporation hold an annual meeting with shareholders with a record of minutes maintained?", type: "yesNo" },
      { id: "minuteBook", label: "Has the corporation updated its minute book for the year? If yes, provide a copy.", type: "yesNo" },
      { id: "purchaseSellBusiness", label: "Did the corporation purchase or sell a business or business segment during the year? If yes, provide a copy of the contract or agreement.", type: "yesNo" },
      { id: "newActivities", label: "Did the corporation engage in any new activities during the year? If yes, describe the new business on an attached sheet.", type: "yesNo" },
      { id: "discontinueOperations", label: "Did the corporation discontinue operations this year? If yes, provide details.", type: "yesNo" },
      { id: "qualified401k", label: "Does the corporation have a Qualified retirement plan (e.g., 401k)?", type: "yesNo" },
      { id: "sepSimple", label: "Does the corporation have a SEP (simplified employee pension) or SIMPLE (savings incentive match plan for employees) plan?", type: "yesNo" },
      { id: "sepContributionsCalculated", label: "If yes, do contributions need to be calculated?", type: "yesNo" },
      { id: "cafeteriaPlan", label: "Does the corporation have a Cafeteria plan?", type: "yesNo" },
      { id: "nonqualifiedDeferred", label: "Does the corporation have a Nonqualified deferred compensation plan or agreement?", type: "yesNo" },
      { id: "otherBenefitPlan", label: "Does the corporation have any Other benefit plan not described above?", type: "yesNo" },
      { id: "taxableFringe", label: "Did the corporation include taxable fringe or welfare benefits such as health insurance, group-term life insurance, educational assistance, nonaccountable expense allowances, and personal use of corporate vehicles in compensation on employees' Forms W-2 and, if applicable, subject such amounts to payroll taxes?", type: "yesNo" },
      { id: "subsidiaryAffiliated", label: "Is the corporation a subsidiary in an affiliated group or a parent-subsidiary controlled group?", type: "yesNo" },
      { id: "shareholderDisregarded", label: "Is any shareholder in the corporation a disregarded entity, a partnership, a trust, an S corporation, or an estate?", type: "yesNo" },
      { id: "foreignOwns20Pct", label: "Did any foreign or domestic corporation, partnership, trust, or tax-exempt organization own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power of all classes of the corporation's stock entitled to vote?", type: "yesNo" },
      { id: "individualOwns20Pct", label: "Did any individual or estate own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power of all classes of the corporation's stock entitled to vote?", type: "yesNo" },
      { id: "corpOwns20PctOther", label: "Did the corporation own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power of all classes of stock entitled to vote of any foreign or domestic corporation not already included in a listing of affiliated groups?", type: "yesNo" },
      { id: "corpOwns20PctPartnership", label: "Did the corporation own directly an interest of 20% or more, or own, directly or indirectly, an interest of 50% or more in any foreign or domestic partnership or in the beneficial interest of a trust?", type: "yesNo" },
      { id: "foreignPerson25Pct", label: "At any time during the tax year, did one foreign person own, directly or indirectly, at least 25% of the total voting power of all classes of the corporation's stock entitled to vote or the total value of all classes of the corporation's stock?", type: "yesNo" },
      { id: "ownership80PctChange", label: "Did the corporation have an 80% or more change in ownership, including a change due to redemption of its own stock?", type: "yesNo" },
      { id: "disposed65PctAssets", label: "Did the corporation dispose of more than 65% of its assets in a taxable, nontaxable, or tax deferred transaction?", type: "yesNo" },
      { id: "propertyForStock", label: "Did the corporation receive assets in a property-for-stock nontaxable exchange in which any of the transferred assets had a fair market basis or fair market value of more than $1 million?", type: "yesNo" },
      { id: "foreignAccount", label: "At any time during the year, did the corporation have an interest in, or signature authority over a financial account in a foreign country?", type: "yesNo" },
      { id: "shareholderTransfer", label: "Was there a distribution of property or a transfer (by sale or death) of a shareholder interest during the tax year?", type: "yesNo" },
      { id: "under250k", label: "Does the corporation satisfy the following conditions: total receipts less than $250,000 AND total assets less than $250,000?", type: "yesNo" },
      { id: "paid600Nonemployee", label: "Did the corporation pay $600 or more of nonemployee compensation to any individual? If yes, include a copy of Form 1099-NEC for each.", type: "yesNo" },
      { id: "businessVehicles", label: "Did the corporation use any vehicles for business? If yes, include total business miles for each vehicle.", type: "yesNo" },
      { id: "pppLoan", label: "Did the corporation have a Paycheck Protection Program (PPP) loan that was forgiven?", type: "yesNo" },
      { id: "digitalAssets", label: "At any time during this tax year, did the corporation (a) receive a digital asset (as a reward, award, or payment for property or services); or (b) sell, exchange, or otherwise dispose of a digital asset (or a financial interest in a digital asset)?", type: "yesNo" },
    ],
  },
  {
    id: "businessVehicleDetails",
    title: "Business Vehicles",
    description: "If the corporation uses vehicles for business, list each vehicle and total business miles.",
    questions: [
      {
        id: "businessVehiclesList",
        label: "Business Vehicles",
        type: "repeater",
        addLabel: "+ Add Vehicle",
        fields: [
          { id: "vehicle", label: "Vehicle", type: "text", placeholder: "e.g., 2022 Ford F-150" },
          { id: "totalMiles", label: "Total Business Miles", type: "number", placeholder: "0" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "shareholders",
    title: "Principal Shareholders Ownership Information",
    description: "Include additional sheets as necessary.",
    questions: [
      {
        id: "shareholders",
        label: "Shareholders",
        type: "repeater",
        addLabel: "+ Add Shareholder",
        fields: [
          { id: "name", label: "Name/Title", type: "text", placeholder: "Name/Title" },
          { id: "taxId", label: "Tax ID (SSN or EIN)", type: "text", placeholder: "XXX-XX-XXXX" },
          { id: "address", label: "Address", type: "text", placeholder: "Address" },
          { id: "sharesStartOfYear", label: "# Shares Owned at Start of Year", type: "number", placeholder: "0" },
          { id: "sharesEndOfYear", label: "# Shares Owned at End of Year", type: "number", placeholder: "0" },
          { id: "dividendsIssued", label: "Dividends Issued to Shareholder During Year", type: "currency", placeholder: "0.00" },
          { id: "usCitizen", label: "U.S. Citizen?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
      { id: "totalShareholdersLastDay", label: "How many shareholders were there on the last day of the year?", type: "number", placeholder: "0" },
    ],
  },
  {
    id: "shareholderDetails",
    title: "Shareholders — Detailed Information",
    description: "Provide the following information for any shareholder of the corporation during the year.",
    questions: [
      {
        id: "shareholderDetails",
        label: "Shareholder Details",
        type: "repeater",
        addLabel: "+ Add Shareholder",
        fields: [
          { id: "name", label: "Shareholder Name", type: "text", placeholder: "Name" },
          { id: "wagesPaid", label: "Wages Paid", type: "currency", placeholder: "0.00" },
          { id: "capitalContributions", label: "Capital Contributions from Shareholder", type: "currency", placeholder: "0.00" },
          { id: "distributions", label: "Distributions to Shareholder", type: "currency", placeholder: "0.00" },
          { id: "loansToCorpn", label: "Shareholder Loans to Corporation", type: "currency", placeholder: "0.00" },
          { id: "loansRepaid", label: "Loans Repaid by Corporation to Shareholder", type: "currency", placeholder: "0.00" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "balanceSheet",
    title: "C Corporation Balance Sheet",
    description: "Enter year-end balances for the corporation's assets, debts, and equity.",
    questions: [
      // Assets
      { id: "bankAccountBalance", label: "Bank Account End of Year Balance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "accountsReceivable", label: "Accounts Receivable at End of Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventories", label: "Inventories", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansToShareholders", label: "Loans to Shareholders", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "mortgagesLoansHeld", label: "Mortgages and Loans Held by Corporation", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "stocksBondsSecurities", label: "Stocks, Bonds, and Securities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherCurrentAssets", label: "Other Current Assets", type: "currency", placeholder: "0.00", halfWidth: true },
      // Debts & Equity
      { id: "accountsPayable", label: "Accounts Payable at Year End", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesLessThanOneYear", label: "Payables Less Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesMoreThanOneYear", label: "Payables More Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansFromShareholders", label: "Loans from Shareholders", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalStockPreferred", label: "Capital Stock (Preferred)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalStockCommon", label: "Capital Stock (Common)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "retainedEarnings", label: "Retained Earnings", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "income",
    title: "C Corporation Income",
    description: "Include all Forms 1099-K received.",
    questions: [
      { id: "grossReceipts", label: "Gross Receipts or Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "returnsAllowances", label: "Returns and Allowances", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "rentalPropertyIncome", label: "Gross Income from Rental Property Owned by Corporation", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "interestIncome", label: "Interest Income (include all 1099-INT Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "dividendIncome", label: "Dividend Income (include all 1099-DIV Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalGainLoss", label: "Capital Gain/Loss (include all 1099-B Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherIncome", label: "Other Income (include a statement)", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "cogs",
    title: "C Corporation Cost of Goods Sold",
    description: "Only for manufacturers, wholesalers, and businesses that make, buy, or sell goods.",
    questions: [
      { id: "inventoryBeginning", label: "Inventory at Beginning of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "purchases", label: "Purchases", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "costOfLabor", label: "Cost of Labor Related to Sale or Production of Goods Held for Sale", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "materialsSupplies", label: "Materials and Supplies Used in Manufacture or Sales Production", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventoryEnd", label: "Inventory at the End of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "expenses",
    title: "C Corporation Expenses",
    questions: [
      { id: "expAdvertising", label: "Advertising", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expAnnualCorpFees", label: "Annual Corporation Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBankFeesCharges", label: "Bank Fees and Charges", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCharitable", label: "Charitable Contributions", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCleaning", label: "Cleaning/Janitorial", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCommissions", label: "Commissions and Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expContractLabor", label: "Contract Labor (include Forms 1099-NEC)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEmployeeBenefits", label: "Employee Benefit Programs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEntertainment", label: "Entertainment (not deductible)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expHealthCareEmployee", label: "Health Care Plans — Employee", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expHealthCareShareholder", label: "Health Care Plans — Shareholder", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInsurance", label: "Insurance (other than health)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestCreditCards", label: "Interest — Business Credit Cards", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestLoans", label: "Interest — Business Loans/Credit Lines", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestMortgage", label: "Interest — Mortgage", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInternet", label: "Internet Service", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expLegalProfessional", label: "Legal and Professional Services", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expMealsBusiness", label: "Meals — Business", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOfficeSupplies", label: "Office Supplies", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOrganizationCosts", label: "Organization Costs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expPensionEmployee", label: "Pension & Profit Sharing Plans — Employee", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expPensionShareholder", label: "Pension & Profit Sharing Plans — Shareholder", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEducation", label: "Professional Education and Training", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentEquipment", label: "Rent or Lease — Car, Machinery, Equipment", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentProperty", label: "Rent or Lease — Other Business Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRepairs", label: "Repairs and Maintenance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expSalariesWages", label: "Salaries and Wages (include Forms W-2)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesPayroll", label: "Taxes — Payroll", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesProperty", label: "Taxes — Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesSales", label: "Taxes — Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTelephone", label: "Telephone", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expUtilities", label: "Utilities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther2", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther2Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther3", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther3Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther4", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther4Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
    ],
  },
  {
    id: "equipmentPurchases",
    title: "Equipment Purchases",
    description: "Enter depreciable assets purchased that have a useful life greater than one year.",
    questions: [
      {
        id: "equipmentPurchases",
        label: "Equipment Purchased",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "datePurchased", label: "Date Purchased", type: "date" },
          { id: "cost", label: "Cost", type: "currency", placeholder: "0.00" },
          { id: "dateInService", label: "Date Placed in Service", type: "date" },
          { id: "newOrUsed", label: "New or Used?", type: "select", options: [{ value: "new", label: "New" }, { value: "used", label: "Used" }] },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "equipmentDisposed",
    title: "Equipment Sold or Disposed of During Year",
    questions: [
      {
        id: "equipmentDisposed",
        label: "Equipment Disposed",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "dateOutOfService", label: "Date Out of Service", type: "date" },
          { id: "dateSold", label: "Date Sold", type: "date" },
          { id: "sellingPrice", label: "Selling Price/FMV", type: "currency", placeholder: "0.00" },
          { id: "tradeIn", label: "Trade-in?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "businessCredits",
    title: "C Corporation Business Credits",
    description: "If answered Yes for any of the below, please provide a statement with details.",
    questions: [
      { id: "creditDisability", label: "Did the corporation pay expenses to make it accessible by individuals with disabilities?", type: "yesNo" },
      { id: "creditFicaTips", label: "Did the corporation pay any FICA on employee wages for tips above minimum wage?", type: "yesNo" },
      { id: "creditLowIncomeHousing", label: "Did the corporation own any residential rental buildings providing qualified low-income housing?", type: "yesNo" },
      { id: "creditResearch", label: "Did the corporation incur any research and experimental expenditures during the tax year?", type: "yesNo" },
      { id: "creditPensionStartup", label: "Did the corporation have employer pension plan start-up costs?", type: "yesNo" },
      { id: "creditPensionEmployees", label: "Total Number of Employees (for pension)", type: "number", placeholder: "0" },
      { id: "creditHealthInsurance", label: "Did the corporation pay health insurance premiums for employees?", type: "yesNo" },
      { id: "creditHealthEmployees", label: "Total Number of Employees (for health insurance)", type: "number", placeholder: "0" },
      { id: "creditElectricVehicles", label: "Did the corporation purchase and place in service any electric vehicles or energy efficient commercial building property?", type: "yesNo" },
    ],
  },
  {
    id: "estimatedTaxPayments",
    title: "Estimated Tax Payments",
    description: "Enter estimated tax payments made during the tax year.",
    questions: [
      { id: "estTax1stFederal", label: "First Installment — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax1stState", label: "First Installment — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax1stDateFederal", label: "First Installment Date Paid (Federal)", type: "date", halfWidth: true },
      { id: "estTax1stDateState", label: "First Installment Date Paid (State)", type: "date", halfWidth: true },
      { id: "estTax2ndFederal", label: "Second Installment — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax2ndState", label: "Second Installment — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax2ndDateFederal", label: "Second Installment Date Paid (Federal)", type: "date", halfWidth: true },
      { id: "estTax2ndDateState", label: "Second Installment Date Paid (State)", type: "date", halfWidth: true },
      { id: "estTax3rdFederal", label: "Third Installment — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax3rdState", label: "Third Installment — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax3rdDateFederal", label: "Third Installment Date Paid (Federal)", type: "date", halfWidth: true },
      { id: "estTax3rdDateState", label: "Third Installment Date Paid (State)", type: "date", halfWidth: true },
      { id: "estTax4thFederal", label: "Fourth Installment — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax4thState", label: "Fourth Installment — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTax4thDateFederal", label: "Fourth Installment Date Paid (Federal)", type: "date", halfWidth: true },
      { id: "estTax4thDateState", label: "Fourth Installment Date Paid (State)", type: "date", halfWidth: true },
      { id: "estTaxPriorYearFederal", label: "Amount Applied from Prior Year — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTaxPriorYearState", label: "Amount Applied from Prior Year — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTaxTotalFederal", label: "Total — Federal", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "estTaxTotalState", label: "Total — State", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "notes",
    title: "Additional Notes",
    questions: [
      {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Any additional information, documents needed, or questions for your tax professional...",
      },
    ],
  },
];

// ── 1065 Partnership ─────────────────────────────────────────

const FORM_1065: FormSection[] = [
  {
    id: "generalInfo",
    title: "Partnership General Information",
    description: "Use a separate organizer for each partnership.",
    questions: [
      { id: "legalName", label: "Legal Name of Partnership", type: "text", required: true, placeholder: "Partnership legal name", halfWidth: true },
      { id: "ein", label: "EIN", type: "text", required: true, placeholder: "XX-XXXXXXX", halfWidth: true },
      { id: "address", label: "Partnership Address", type: "text", placeholder: "Full mailing address" },
      { id: "representativeName", label: "Partnership Representative", type: "text", placeholder: "Representative name", halfWidth: true },
      { id: "representativeTitle", label: "Title", type: "text", placeholder: "Title", halfWidth: true },
      { id: "representativeEmail", label: "Email", type: "email", placeholder: "representative@email.com", halfWidth: true },
      { id: "representativePhone", label: "Phone", type: "phone", placeholder: "(555) 123-4567", halfWidth: true },
      {
        id: "partnershipType",
        label: "Type of Partnership",
        type: "select",
        required: true,
        options: [
          { value: "general", label: "General Partnership" },
          { value: "limited", label: "Limited Partnership" },
          { value: "llp", label: "Limited Liability Partnership (LLP)" },
        ],
        halfWidth: true,
      } as SelectQuestion,
      { id: "principalActivity", label: "Principal Business Activity", type: "text", placeholder: "e.g., Consulting, Real Estate", halfWidth: true },
      { id: "principalProduct", label: "Principal Product or Service", type: "text", placeholder: "e.g., Tax Preparation, Property Management", halfWidth: true },
      { id: "dateBusinessStarted", label: "Date Business Started", type: "date", halfWidth: true },
      { id: "dateBusinessClosed", label: "Date Business Closed", type: "date", halfWidth: true },
      { id: "primaryPurposeProfit", label: "Was the primary purpose of the partnership activity to realize a profit?", type: "yesNo" },
      { id: "priorYearLosses", label: "Has the partnership reported any losses in prior years?", type: "yesNo" },
      {
        id: "accountingMethod",
        label: "Accounting Method",
        type: "radio",
        options: [
          { value: "cash", label: "Cash" },
          { value: "accrual", label: "Accrual" },
          { value: "other", label: "Other" },
        ],
      } as SelectQuestion,
      { id: "accountingMethodOther", label: "If Other, specify", type: "text", placeholder: "Specify accounting method" },
      { id: "calendarYear", label: "Does the partnership file under a calendar year?", type: "yesNo" },
      { id: "fiscalYearEnd", label: "If no, what is the fiscal year end?", type: "text", placeholder: "e.g., June 30" },
    ],
  },
  {
    id: "specificQuestions",
    title: "Partnership Specific Questions",
    questions: [
      { id: "writtenAgreement", label: "Is there a written partnership agreement? (If this is the first year of the partnership's existence, please provide a copy of the written partnership agreement.)", type: "yesNo" },
      { id: "allPartnersActive", label: "Are all partners actively participating in the business?", type: "yesNo" },
      { id: "partnerDisregarded", label: "Is any partner in the partnership a disregarded entity, a partnership, a trust, an S corporation, or an estate?", type: "yesNo" },
      { id: "partnerInAnother", label: "Is the partnership a partner in another partnership?", type: "yesNo" },
      { id: "entityOwns50Pct", label: "Did any foreign or domestic corporation, partnership, trust, tax-exempt organization, individual, or estate own directly or indirectly 50% or more of the profit, loss, or capital of the partnership?", type: "yesNo" },
      { id: "owns20PctStock", label: "Did the partnership own directly 20% or more, or own directly or indirectly, 50% or more of the total voting power of all classes of stock entitled to vote of any foreign or domestic corporation?", type: "yesNo" },
      { id: "debtCancelledForgiven", label: "Did the partnership have any debt that was cancelled, was forgiven, or had the terms modified so as to reduce principal amount of debt?", type: "yesNo" },
      { id: "foreignAccount", label: "At any time during the year, did the partnership have an interest in, or signature authority over a financial account in a foreign country?", type: "yesNo" },
      { id: "partnershipTransfer", label: "Was there a distribution of property or a transfer (by sale or death) of a partnership interest during the tax year?", type: "yesNo" },
      { id: "under250kReceipts1mAssets", label: "Does the partnership satisfy the following conditions: total receipts less than $250,000 AND total assets less than $1 million?", type: "yesNo" },
      { id: "paid600Nonemployee", label: "Did the partnership pay $600 or more of nonemployee compensation to any individual? (If yes, include a copy of Form 1099-NEC for each.)", type: "yesNo" },
      { id: "pppLoan", label: "Did the partnership have a Paycheck Protection Program (PPP) loan that was forgiven?", type: "yesNo" },
      { id: "digitalAssets", label: "At any time during this tax year, did the partnership (a) receive a digital asset (as a reward, award, or payment for property or services); or (b) sell, exchange, or otherwise dispose of a digital asset (or a financial interest in a digital asset)?", type: "yesNo" },
    ],
  },
  {
    id: "partners",
    title: "Principal Partners Ownership Information",
    description: "A general partner is personally liable for partnership debts. A limited partner's liability is limited to the amount of money or other property contributed or required to contribute to the partnership.",
    questions: [
      {
        id: "partners",
        label: "Partners",
        type: "repeater",
        addLabel: "+ Add Partner",
        fields: [
          { id: "name", label: "Name", type: "text", placeholder: "Partner name" },
          { id: "taxId", label: "Tax ID (SSN or EIN)", type: "text", placeholder: "XXX-XX-XXXX" },
          { id: "address", label: "Address", type: "text", placeholder: "Address" },
          { id: "ownershipPct", label: "Ownership %", type: "number", placeholder: "0" },
          { id: "partnerType", label: "General or Limited?", type: "select", options: [{ value: "general", label: "General Partner" }, { value: "limited", label: "Limited Partner" }] },
          { id: "usCitizen", label: "U.S. Citizen?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "partnerTransactions",
    title: "Partners Other Transactions",
    questions: [
      {
        id: "partnerTransactions",
        label: "Partner Transactions",
        type: "repeater",
        addLabel: "+ Add Partner",
        fields: [
          { id: "partnerName", label: "Partner Name", type: "text", placeholder: "Partner name" },
          { id: "guaranteedPayments", label: "Guaranteed Payments", type: "currency", placeholder: "0.00" },
          { id: "healthInsurance", label: "Health Insurance Premiums Paid", type: "currency", placeholder: "0.00" },
          { id: "capitalContributions", label: "Capital Contributions from Partner", type: "currency", placeholder: "0.00" },
          { id: "distributions", label: "Distributions to Partner", type: "currency", placeholder: "0.00" },
          { id: "loansToPartnership", label: "Partner Loans to the Partnership", type: "currency", placeholder: "0.00" },
          { id: "loansRepaid", label: "Loans Repaid by Partnership to Partner", type: "currency", placeholder: "0.00" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "balanceSheet",
    title: "Partnership Balance Sheet",
    description: "Enter year-end balances for the partnership's assets, debts, and equity.",
    questions: [
      // Assets
      { id: "bankAccountBalance", label: "Bank Account End of Year Balance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "accountsReceivable", label: "Accounts Receivable at End of Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventories", label: "Inventories", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansToPartners", label: "Loans to Partners", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "mortgagesLoansHeld", label: "Mortgages and Loans Held by Partnership", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "stocksBondsSecurities", label: "Stocks, Bonds, and Securities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherCurrentAssets", label: "Other Current Assets (include list)", type: "currency", placeholder: "0.00", halfWidth: true },
      // Debts & Equity
      { id: "accountsPayable", label: "Accounts Payable at Year End", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesLessThanOneYear", label: "Payables Less Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "payablesMoreThanOneYear", label: "Payables More Than One Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "nonrecourseLoans", label: "Nonrecourse Loans", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "loansFromPartners", label: "Loans from Partners", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "partnersCapitalAccounts", label: "Partners' Capital Accounts", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "income",
    title: "Partnership Income",
    description: "Include all Forms 1099-K, Forms 1099-MISC, and Forms 1099-NEC received.",
    questions: [
      { id: "grossReceipts", label: "Gross Receipts or Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "returnsAllowances", label: "Returns and Allowances", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "interestIncome", label: "Interest Income (include all 1099-INT Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "dividendIncome", label: "Dividend Income (include all 1099-DIV Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "capitalGainLoss", label: "Capital Gain/Loss (include all 1099-B Forms)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "otherIncome", label: "Other Income (Loss) (include a statement)", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "cogs",
    title: "Partnership Cost of Goods Sold",
    description: "For manufacturers, wholesalers, and businesses that make, buy, or sell goods.",
    questions: [
      { id: "inventoryBeginning", label: "Inventory at Beginning of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "purchases", label: "Purchases", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "costOfLabor", label: "Cost of Labor", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "materialsSupplies", label: "Materials and Supplies", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "inventoryEnd", label: "Inventory at the End of the Year", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "expenses",
    title: "Partnership Expenses",
    questions: [
      { id: "expAdvertising", label: "Advertising", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBadDebts", label: "Bad Debts", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBankCharges", label: "Bank Charges", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expBusinessLicenses", label: "Business Licenses", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expCommissions", label: "Commissions and Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expContractLabor", label: "Contract Labor", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEmployeeBenefits", label: "Employee Benefit Programs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEmployeeHealthCare", label: "Employee Health Care Plans", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expEntertainment", label: "Entertainment (not deductible)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expGifts", label: "Gifts", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expGuaranteedPayments", label: "Guaranteed Payments to Partners", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInsurance", label: "Insurance (other than health insurance)", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestMortgage", label: "Interest — Mortgage", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInterestOther", label: "Interest — Other", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expInternet", label: "Internet Service", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expLegalProfessional", label: "Legal and Professional Services", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expMealsBusiness", label: "Meals — Business", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOfficeSupplies", label: "Office Supplies", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOrganizationCosts", label: "Organization Costs", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expPension", label: "Pension and Profit Sharing Plans", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentEquipment", label: "Rent or Lease — Car, Machinery, Equipment", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRentProperty", label: "Rent or Lease — Other Business Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expRepairs", label: "Repairs and Maintenance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesPayroll", label: "Taxes — Payroll", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesProperty", label: "Taxes — Property", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesSales", label: "Taxes — Sales", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTaxesState", label: "Taxes — State", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expTelephone", label: "Telephone", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expUtilities", label: "Utilities", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expWages", label: "Wages", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther1Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
      { id: "expOther2", label: "Other Expense", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "expOther2Desc", label: "Other Expense Description", type: "text", placeholder: "Describe", halfWidth: true },
    ],
  },
  {
    id: "carExpenses",
    title: "Car Expenses",
    description: "Use a separate form for each vehicle. You can use either the standard mileage rate or actual expenses.",
    questions: [
      { id: "carMakeModel", label: "Make/Model", type: "text", placeholder: "e.g., 2022 Toyota Camry", halfWidth: true },
      { id: "carDateInService", label: "Date Car Placed in Service", type: "date", halfWidth: true },
      { id: "carPersonalUse", label: "Car available for personal use during off-duty hours?", type: "yesNo" },
      { id: "carOtherPersonalCars", label: "Do you (or your spouse) have any other cars for personal use?", type: "yesNo" },
      { id: "carHaveEvidence", label: "Do you have evidence?", type: "yesNo" },
      { id: "carEvidenceWritten", label: "Is your evidence written?", type: "yesNo" },
      { id: "carTradedIn", label: "Did you trade in your car this year?", type: "yesNo" },
      { id: "carTradeInCost", label: "Cost of Trade-in", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carTradeInValue", label: "Trade-in Value", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carOdometerBegin", label: "Beginning of Year Odometer", type: "number", placeholder: "0", halfWidth: true },
      { id: "carOdometerEnd", label: "End of Year Odometer", type: "number", placeholder: "0", halfWidth: true },
      { id: "carBusinessMileage", label: "Business Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carCommutingMileage", label: "Commuting Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carOtherMileage", label: "Other Mileage", type: "number", placeholder: "0", halfWidth: true },
      { id: "carGasOil", label: "Gas/Oil", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carInsurance", label: "Insurance", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carParkingTolls", label: "Parking Fees/Tolls", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carRegistration", label: "Registration/Fees", type: "currency", placeholder: "0.00", halfWidth: true },
      { id: "carRepairs", label: "Repairs", type: "currency", placeholder: "0.00", halfWidth: true },
    ],
  },
  {
    id: "equipmentPurchases",
    title: "Equipment Purchases",
    description: "Enter depreciable assets purchased that have a useful life greater than one year.",
    questions: [
      {
        id: "equipmentPurchases",
        label: "Equipment Purchased",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "datePurchased", label: "Date Purchased", type: "date" },
          { id: "cost", label: "Cost", type: "currency", placeholder: "0.00" },
          { id: "dateInService", label: "Date Placed in Service", type: "date" },
          { id: "newOrUsed", label: "New or Used?", type: "select", options: [{ value: "new", label: "New" }, { value: "used", label: "Used" }] },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "equipmentDisposed",
    title: "Equipment Sold or Disposed of During Year",
    questions: [
      {
        id: "equipmentDisposed",
        label: "Equipment Disposed",
        type: "repeater",
        addLabel: "+ Add Equipment",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "dateOutOfService", label: "Date Out of Service", type: "date" },
          { id: "dateSold", label: "Date Sold", type: "date" },
          { id: "sellingPrice", label: "Selling Price/FMV", type: "currency", placeholder: "0.00" },
          { id: "tradeIn", label: "Trade-in?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "businessCredits",
    title: "Partnership Business Credits",
    description: "If answered Yes for any of the below, please provide a statement with details.",
    questions: [
      { id: "creditDisability", label: "Did the partnership pay expenses to make it accessible by individuals with disabilities?", type: "yesNo" },
      { id: "creditFicaTips", label: "Did the partnership pay any FICA on employee wages for tips above minimum wage?", type: "yesNo" },
      { id: "creditLowIncomeHousing", label: "Did the partnership own any residential rental buildings providing qualified low-income housing?", type: "yesNo" },
      { id: "creditResearch", label: "Did the partnership incur any research and experimental expenditures during the tax year?", type: "yesNo" },
      { id: "creditPensionStartup", label: "Did the partnership have employer pension plan start-up costs?", type: "yesNo" },
      { id: "creditPensionEmployees", label: "Total Number of Employees (for pension)", type: "number", placeholder: "0" },
      { id: "creditHealthInsurance", label: "Did the partnership pay health insurance premiums for employees?", type: "yesNo" },
      { id: "creditHealthEmployees", label: "Total Number of Employees (for health insurance)", type: "number", placeholder: "0" },
      { id: "creditElectricVehicles", label: "Did the partnership purchase and place in service any electric vehicles or energy efficient commercial building property?", type: "yesNo" },
    ],
  },
  {
    id: "stateTaxPayments",
    title: "State Estimated or Pass-Through Entity (PTE) Tax Payments",
    questions: [
      {
        id: "stateTaxPayments",
        label: "State Tax Payments",
        type: "repeater",
        addLabel: "+ Add Payment",
        fields: [
          { id: "state", label: "State", type: "text", placeholder: "State" },
          { id: "amount", label: "Amount", type: "currency", placeholder: "0.00" },
          { id: "datePaid", label: "Date Paid", type: "date" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "notes",
    title: "Additional Notes",
    questions: [
      {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Any additional information, documents needed, or questions for your tax professional...",
      },
    ],
  },
];

// ── 1041 Estate & Trust (Rental Property) ──────────────────────

const FORM_1041: FormSection[] = [
  {
    id: "generalInfo",
    title: "Estate / Trust General Information",
    questions: [
      { id: "legalName", label: "Name of Estate or Trust", type: "text", required: true, placeholder: "Legal name of estate or trust", halfWidth: true },
      { id: "ein", label: "EIN", type: "text", required: true, placeholder: "XX-XXXXXXX", halfWidth: true },
      { id: "fiduciaryName", label: "Fiduciary / Trustee Name", type: "text", placeholder: "Name of fiduciary or trustee", halfWidth: true },
      { id: "fiduciaryPhone", label: "Phone", type: "phone", placeholder: "(555) 123-4567", halfWidth: true },
      { id: "fiduciaryEmail", label: "Email", type: "email", placeholder: "trustee@email.com", halfWidth: true },
      { id: "address", label: "Mailing Address", type: "text", placeholder: "Full mailing address" },
    ],
  },
  {
    id: "rentalProperties",
    title: "Rental Income and Expenses",
    description: "Add each rental property and enter its income and expenses.",
    questions: [
      {
        id: "rentalProperties",
        label: "Rental Properties",
        type: "repeater",
        addLabel: "+ Add Rental Property",
        fields: [
          { id: "address", label: "Address of Property", type: "text", placeholder: "Full property address" },
          {
            id: "propertyType",
            label: "Type of Property",
            type: "select",
            options: [
              { value: "1", label: "Single Family Residence" },
              { value: "2", label: "Multi-Family Residence" },
              { value: "3", label: "Vacation/Short-Term Rental" },
              { value: "4", label: "Commercial" },
              { value: "5", label: "Land" },
              { value: "6", label: "Self-Rental" },
              { value: "7", label: "Other" },
            ],
          },
          { id: "personalUse", label: "Any Personal Use?", type: "yesNo" },
          { id: "fairRentalDays", label: "Fair Rental Days", type: "number", placeholder: "0" },
          { id: "personalUseDays", label: "Personal Use Days", type: "number", placeholder: "0" },
          { id: "datePlacedInService", label: "Date Placed in Service", type: "date" },
          { id: "rentsReceived", label: "Rents Received", type: "currency", placeholder: "0.00" },
          // Expenses
          { id: "expAdvertising", label: "Advertising", type: "currency", placeholder: "0.00" },
          { id: "expAutoTravel", label: "Auto and Travel", type: "currency", placeholder: "0.00" },
          { id: "expCleaning", label: "Cleaning and Maintenance", type: "currency", placeholder: "0.00" },
          { id: "expCommissions", label: "Commissions", type: "currency", placeholder: "0.00" },
          { id: "expInsurance", label: "Insurance", type: "currency", placeholder: "0.00" },
          { id: "expLegalProfessional", label: "Legal and Professional Fees", type: "currency", placeholder: "0.00" },
          { id: "expManagement", label: "Management Fees", type: "currency", placeholder: "0.00" },
          { id: "expMortgageInterest", label: "Mortgage Interest Paid to Banks", type: "currency", placeholder: "0.00" },
          { id: "expOtherInterest", label: "Other Interest", type: "currency", placeholder: "0.00" },
          { id: "expRepairs", label: "Repairs", type: "currency", placeholder: "0.00" },
          { id: "expSupplies", label: "Supplies", type: "currency", placeholder: "0.00" },
          { id: "expTaxes", label: "Taxes", type: "currency", placeholder: "0.00" },
          { id: "expUtilities", label: "Utilities", type: "currency", placeholder: "0.00" },
          { id: "expOther", label: "Other Expenses (list)", type: "text", placeholder: "Describe other expenses and amounts" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "propertyPurchased",
    title: "Property Purchased",
    description: "Treat the cost of improvements made to real property as the purchase of a new asset. If this is your first year with our firm, provide a depreciation schedule for all property placed in service before the current year.",
    questions: [
      {
        id: "propertyPurchased",
        label: "Property Purchased",
        type: "repeater",
        addLabel: "+ Add Property",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "datePurchased", label: "Date Purchased", type: "date" },
          { id: "cost", label: "Cost", type: "currency", placeholder: "0.00" },
          { id: "dateInService", label: "Date Placed in Service", type: "date" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "propertySold",
    title: "Property Sold or Taken Out of Service",
    questions: [
      {
        id: "propertySold",
        label: "Property Sold/Disposed",
        type: "repeater",
        addLabel: "+ Add Property",
        fields: [
          { id: "asset", label: "Asset", type: "text", placeholder: "Asset description" },
          { id: "dateSold", label: "Date Sold or Taken Out of Service", type: "date" },
          { id: "sellingPrice", label: "Selling Price", type: "currency", placeholder: "0.00" },
          { id: "tradeIn", label: "Trade-in?", type: "yesNo" },
        ],
      } as RepeaterQuestion,
    ],
  },
  {
    id: "notes",
    title: "Additional Notes",
    questions: [
      {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Any additional information, documents needed, or questions for your tax professional...",
      },
    ],
  },
];

// ── Form Definitions Map ───────────────────────────────────────

export const FORM_DEFINITIONS: Record<string, FormSection[]> = {
  "1040": FORM_1040,
  "1041": FORM_1041,
  "1065": FORM_1065,
  "1120": FORM_1120,
  "1120S": FORM_1120S,
};

export function getFormSections(returnType: string): FormSection[] {
  return FORM_DEFINITIONS[returnType] || FORM_DEFINITIONS["1040"];
}

// Document categories per form type
export const DOC_CATEGORIES: Record<string, string[]> = {
  "1040": [
    "W-2", "1099-INT", "1099-DIV", "1099-NEC", "1099-MISC",
    "1098", "Bank Statement", "ID / License", "Other",
  ],
  "1041": [
    "Depreciation Schedule", "Rental Statements", "1099-INT", "1099-DIV",
    "1099-MISC", "K-1", "Trust Agreement", "Death Certificate",
    "Bank Statement", "Prior Year Returns", "Other",
  ],
  "1065": [
    "Financial Statements", "Balance Sheet", "Depreciation Schedule",
    "W-2", "W-3", "Form 940", "Form 941", "Form 1096",
    "1099-NEC", "1099-MISC", "1099-K",
    "Partnership Agreement", "Bank Statement",
    "State Tax Filing", "Prior Year Returns", "Other",
  ],
  "1120": [
    "Financial Statements", "W-3", "Form 940", "Form 941",
    "1099-NEC", "1099-MISC", "1099-K", "Form 1096",
    "State Tax Filing", "Bank Statement",
    "Articles of Incorporation", "Bylaws", "Buy-Sell Agreement",
    "Depreciation Schedule", "Prior Year Returns", "Other",
  ],
  "1120S": [
    "Financial Statements", "W-3", "Form 940", "Form 941",
    "1099-NEC", "1099-K", "State Tax Filing", "Bank Statement",
    "Articles of Incorporation", "Bylaws", "IRS Form 2553",
    "Depreciation Schedule", "Prior Year Returns", "Other",
  ],
  default: [
    "Financial Statements", "1099-NEC", "1099-K",
    "Bank Statement", "Prior Year Returns", "Other",
  ],
};

export function getDocCategories(returnType: string): string[] {
  return DOC_CATEGORIES[returnType] || DOC_CATEGORIES["default"];
}

// ── Conditional Document Mappings ────────────────────────────────
// Documents recommended based on specific form answers.

const CONDITIONAL_DOCS_1040_CHECKBOX: Record<
  string,
  Record<string, ConditionalDoc>
> = {
  incomeSources: {
    w2: { category: "W-2", reason: "You indicated W-2 employment income" },
    selfEmployment: { category: "1099-NEC", reason: "You indicated self-employment income" },
    interest: { category: "1099-INT", reason: "You indicated interest income" },
    dividends: { category: "1099-DIV", reason: "You indicated dividend income" },
    rental: { category: "Rental Income Statements", reason: "You indicated rental income" },
    socialSecurity: { category: "SSA-1099", reason: "You indicated Social Security benefits" },
    retirement: { category: "1099-R", reason: "You indicated retirement distributions" },
    capitalGains: { category: "1099-B", reason: "You indicated capital gains/losses" },
    unemployment: { category: "1099-G", reason: "You indicated unemployment compensation" },
    crypto: { category: "Crypto Transaction Records", reason: "You indicated cryptocurrency transactions" },
  },
  deductions: {
    mortgage: { category: "1098 (Mortgage Interest)", reason: "You indicated mortgage interest deduction" },
    studentLoan: { category: "1098-E (Student Loan Interest)", reason: "You indicated student loan interest" },
    education: { category: "1098-T (Tuition)", reason: "You indicated education credits/tuition" },
    childcare: { category: "Child/Dependent Care Statements", reason: "You indicated child/dependent care" },
    charitable: { category: "Charitable Donation Receipts", reason: "You indicated charitable donations" },
    medical: { category: "Medical Expense Records", reason: "You indicated medical expenses" },
    hsa: { category: "1099-SA / 5498-SA", reason: "You indicated HSA contributions" },
    ira: { category: "Form 5498 (IRA)", reason: "You indicated IRA contributions" },
    homeOffice: { category: "Home Office Records", reason: "You indicated home office expenses" },
    estimatedTax: { category: "Estimated Tax Payment Receipts", reason: "You indicated estimated tax payments" },
  },
};

const CONDITIONAL_DOCS_BUSINESS_YESNO: Record<string, ConditionalDoc> = {
  paid600Nonemployee: { category: "1099-NEC (for each payee)", reason: "You paid $600+ to non-employees" },
  pppLoan: { category: "PPP Loan Forgiveness Documents", reason: "You had a forgiven PPP loan" },
  digitalAssets: { category: "Crypto/Digital Asset Records", reason: "You had digital asset transactions" },
  foreignAccount: { category: "FBAR / Foreign Account Records", reason: "You had a foreign financial account" },
};

export function getConditionalDocs(
  returnType: string,
  formData: Record<string, unknown>
): ConditionalDoc[] {
  const results: ConditionalDoc[] = [];
  const seen = new Set<string>();

  if (returnType === "1040") {
    for (const [fieldId, optionMap] of Object.entries(CONDITIONAL_DOCS_1040_CHECKBOX)) {
      const selected = formData[fieldId];
      if (!(selected instanceof Set)) continue;
      for (const [optionId, doc] of Object.entries(optionMap)) {
        if (selected.has(optionId) && !seen.has(doc.category)) {
          seen.add(doc.category);
          results.push(doc);
        }
      }
    }
  } else if (["1065", "1120", "1120S"].includes(returnType)) {
    for (const [fieldId, doc] of Object.entries(CONDITIONAL_DOCS_BUSINESS_YESNO)) {
      if (formData[fieldId] === "yes" && !seen.has(doc.category)) {
        seen.add(doc.category);
        results.push(doc);
      }
    }
  }

  return results;
}
