/* ================================================================== */
/*  Tax Organizer Question Definitions                                */
/*  Single source of truth for all sections by return type            */
/* ================================================================== */

export type FieldType =
  | "text"
  | "select"
  | "radio"
  | "date"
  | "ssn"
  | "phone"
  | "email"
  | "address"
  | "repeater"
  | "checkbox-group"
  | "currency"
  | "textarea"
  | "heading";

export interface FieldOption {
  value: string;
  label: string;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  /** For repeater fields — define sub-fields */
  subFields?: Field[];
  /** For checkbox-group — items */
  items?: { key: string; label: string }[];
  /** Conditional: only show if another field has a specific value (or one of multiple values) */
  showIf?: { field: string; value: string | boolean | string[] };
  /** Half-width (side by side) */
  half?: boolean;
}

export interface OrganizerSection {
  key: string;
  title: string;
  description?: string;
  fields: Field[];
}

export type ReturnType = "1040" | "1120" | "1120S" | "1065" | "1041";

/* ================================================================== */
/*  US States (for dropdowns)                                         */
/* ================================================================== */
const US_STATES: FieldOption[] = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

/* ================================================================== */
/*  1040 — INDIVIDUAL TAX RETURN                                      */
/* ================================================================== */

const individual1040Sections: OrganizerSection[] = [
  // ── 1. Personal Info ──
  {
    key: "personal_info",
    title: "Personal Information",
    description: "Your basic taxpayer information.",
    fields: [
      { key: "first_name", label: "First Name", type: "text", required: true, half: true },
      { key: "middle_initial", label: "Middle Initial", type: "text", half: true },
      { key: "last_name", label: "Last Name", type: "text", required: true, half: true },
      { key: "suffix", label: "Suffix", type: "select", half: true, options: [
        { value: "", label: "None" }, { value: "Jr.", label: "Jr." },
        { value: "Sr.", label: "Sr." }, { value: "II", label: "II" },
        { value: "III", label: "III" }, { value: "IV", label: "IV" },
      ]},
      { key: "phone", label: "Best Contact Number", type: "phone", required: true },
      { key: "email", label: "Email Address", type: "email", required: true },
      { key: "heading_taxpayer", label: "Taxpayer Info", type: "heading" },
      { key: "ssn", label: "SSN / ITIN", type: "ssn", required: true },
      { key: "occupation", label: "Occupation", type: "text" },
      { key: "dob", label: "Date of Birth", type: "date", required: true },
      { key: "heading_id", label: "Identification", type: "heading" },
      { key: "id_type", label: "ID Type", type: "select", required: true, options: [
        { value: "drivers_license", label: "Driver's License" },
        { value: "state_id", label: "State Issued ID Card" },
        { value: "none", label: "I don't have a Driver's License or ID Card" },
      ]},
      { key: "id_number", label: "ID Number", type: "text", required: true, showIf: { field: "id_type", value: ["drivers_license", "state_id"] } },
      { key: "id_state", label: "Issuing State", type: "select", options: US_STATES, showIf: { field: "id_type", value: ["drivers_license", "state_id"] } },
      { key: "id_issue_date", label: "Issue Date", type: "date", half: true, showIf: { field: "id_type", value: ["drivers_license", "state_id"] } },
      { key: "id_expiration_date", label: "Expiration Date", type: "date", half: true, showIf: { field: "id_type", value: ["drivers_license", "state_id"] } },
      { key: "filing_status", label: "Filing Status", type: "select", required: true, options: [
        { value: "single", label: "Single" },
        { value: "mfj", label: "Married Filing Jointly" },
        { value: "mfs", label: "Married Filing Separately" },
        { value: "hoh", label: "Head of Household" },
        { value: "qw", label: "Qualifying Surviving Spouse" },
      ]},
      { key: "spouse_death_year", label: "What year did your spouse pass away?", type: "select", required: true, showIf: { field: "filing_status", value: "qw" }, options: Array.from({ length: 5 }, (_, i) => {
        const y = new Date().getFullYear() - i;
        return { value: String(y), label: String(y) };
      })},
    ],
  },

  // ── 2. Spouse Info ──
  {
    key: "spouse_info",
    title: "Spouse Information",
    description: "If filing jointly or separately, provide your spouse's information.",
    fields: [
      { key: "spouse_first_name", label: "Spouse First Name", type: "text", required: true, half: true },
      { key: "spouse_middle_initial", label: "Middle Initial", type: "text", half: true },
      { key: "spouse_last_name", label: "Spouse Last Name", type: "text", required: true, half: true },
      { key: "spouse_suffix", label: "Suffix", type: "select", half: true, options: [
        { value: "", label: "None" }, { value: "Jr.", label: "Jr." },
        { value: "Sr.", label: "Sr." }, { value: "II", label: "II" },
        { value: "III", label: "III" }, { value: "IV", label: "IV" },
      ]},
      { key: "spouse_ssn", label: "Spouse SSN / ITIN", type: "ssn", required: true },
      { key: "spouse_occupation", label: "Spouse Occupation", type: "text" },
      { key: "spouse_dob", label: "Spouse Date of Birth", type: "date", required: true },
      { key: "heading_spouse_id", label: "Spouse Identification", type: "heading" },
      { key: "spouse_id_type", label: "Spouse ID Type", type: "select", options: [
        { value: "drivers_license", label: "Driver's License" },
        { value: "state_id", label: "State Issued ID Card" },
        { value: "none", label: "No ID" },
      ]},
      { key: "spouse_id_number", label: "ID Number", type: "text", required: true, showIf: { field: "spouse_id_type", value: ["drivers_license", "state_id"] } },
      { key: "spouse_id_state", label: "Issuing State", type: "select", options: US_STATES, showIf: { field: "spouse_id_type", value: ["drivers_license", "state_id"] } },
      { key: "spouse_id_issue_date", label: "Issue Date", type: "date", half: true, showIf: { field: "spouse_id_type", value: ["drivers_license", "state_id"] } },
      { key: "spouse_id_expiration_date", label: "Expiration Date", type: "date", half: true, showIf: { field: "spouse_id_type", value: ["drivers_license", "state_id"] } },
    ],
  },

  // ── 3. Dependents ──
  {
    key: "dependents",
    title: "Dependents",
    description: "Add any dependents you will be claiming on your return.",
    fields: [
      { key: "has_dependents", label: "Do you have any dependents?", type: "radio", required: true, options: [
        { value: "yes", label: "Yes" }, { value: "no", label: "No" },
      ]},
      { key: "dependents", label: "Dependents", type: "repeater", showIf: { field: "has_dependents", value: "yes" }, subFields: [
        { key: "first_name", label: "First Name", type: "text", required: true, half: true },
        { key: "last_name", label: "Last Name", type: "text", required: true, half: true },
        { key: "dob", label: "Date of Birth", type: "date", required: true, half: true },
        { key: "ssn", label: "SSN", type: "ssn", required: true, half: true },
        { key: "relationship", label: "Relationship", type: "select", required: true, options: [
          { value: "son", label: "Son" }, { value: "daughter", label: "Daughter" },
          { value: "stepson", label: "Stepson" }, { value: "stepdaughter", label: "Stepdaughter" },
          { value: "foster_child", label: "Foster Child" }, { value: "brother", label: "Brother" },
          { value: "sister", label: "Sister" }, { value: "parent", label: "Parent" },
          { value: "grandchild", label: "Grandchild" }, { value: "niece_nephew", label: "Niece/Nephew" },
          { value: "other", label: "Other" },
        ]},
        { key: "months_lived", label: "Months lived with you", type: "select", options: Array.from({ length: 13 }, (_, i) => ({ value: String(i), label: String(i) })) },
      ]},
    ],
  },

  // ── 4. Address ──
  {
    key: "address",
    title: "Address",
    description: "Your current address and any other addresses during the tax year.",
    fields: [
      { key: "heading_current", label: "Current Address", type: "heading" },
      { key: "address_type", label: "Type of Address", type: "radio", options: [
        { value: "us", label: "U.S." }, { value: "foreign", label: "Foreign" },
      ]},
      { key: "street", label: "Street", type: "text", required: true },
      { key: "apt", label: "Apartment Number", type: "text" },
      { key: "city", label: "City", type: "text", required: true, half: true },
      { key: "state", label: "State", type: "select", required: true, options: US_STATES, half: true },
      { key: "zip", label: "ZIP Code", type: "text", required: true },
      { key: "heading_other", label: "Other Addresses", type: "heading" },
      { key: "lived_elsewhere", label: "During the tax year, did you live somewhere other than the address listed above?", type: "radio", required: true, options: [
        { value: "yes", label: "Yes" }, { value: "no", label: "No" },
      ]},
      { key: "other_addresses", label: "Other Addresses", type: "repeater", showIf: { field: "lived_elsewhere", value: "yes" }, subFields: [
        { key: "street", label: "Street", type: "text", required: true },
        { key: "city", label: "City", type: "text", required: true, half: true },
        { key: "state", label: "State", type: "select", options: US_STATES, half: true },
        { key: "zip", label: "ZIP Code", type: "text" },
        { key: "from_date", label: "From", type: "date", half: true },
        { key: "to_date", label: "To", type: "date", half: true },
      ]},
    ],
  },

  // ── 5. Taxpayer-Specific Questions ──
  {
    key: "taxpayer_questions",
    title: "Taxpayer-Specific Questions",
    description: "Please answer the following questions about the taxpayer.",
    fields: [
      { key: "legally_blind", label: "Was the taxpayer legally blind as of 12/31 of the tax year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "permanently_disabled", label: "Was the taxpayer permanently and totally disabled at any time during the tax year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "claimed_dependent", label: "Could the taxpayer be claimed as a dependent on another individual's return?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "full_time_student", label: "Was the taxpayer a full-time student during the tax year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "presidential_fund", label: "Does the taxpayer want $3 to go to the Presidential Election Campaign Fund?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
  },

  // ── 6. Life Events ──
  {
    key: "life_events",
    title: "Life Events",
    description: "The following questions apply to the tax year unless otherwise specified.",
    fields: [
      { key: "marital_status_change", label: "Did your marital status change?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "name_change_ssa", label: "Did the taxpayer, spouse, or a dependent change their name with the Social Security Administration?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "irs_notice", label: "Did you receive a notice or letter from the IRS or a state revenue agency?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "ip_pin", label: "Did the taxpayer, spouse, or a dependent receive an identity protection PIN (IP PIN) from the IRS?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "children_born_adopted", label: "Were any children born or adopted?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "death_in_family", label: "Did the taxpayer, spouse, or a dependent pass away during the year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "armed_forces", label: "Were you a member of the Armed Forces?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "armed_forces_duty_type", label: "Select your duty type", type: "radio", showIf: { field: "armed_forces", value: "yes" }, options: [{ value: "active", label: "Active" }, { value: "reserve_guard", label: "Reserve or National Guard" }] },
      { key: "armed_forces_pcs", label: "Did you move because of a permanent change of station?", type: "radio", showIf: { field: "armed_forces_duty_type", value: "active" }, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "prior_firm_prep", label: "Did our firm prepare your prior year tax returns?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "first_time_filing", label: "Is this your first time filing a tax return?", type: "radio", showIf: { field: "prior_firm_prep", value: "no" }, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
  },

  // ── 7. Financial Events ──
  {
    key: "financial_events",
    title: "Financial Events",
    description: "The following questions apply to the tax year.",
    fields: [
      { key: "home_transaction", label: "Did you buy, sell, or refinance a home or rental property?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "disaster_damage", label: "Did you incur property damage or theft caused by a federally declared disaster?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "retirement_rollover", label: "Did you convert or roll over any retirement accounts?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "digital_assets", label: "Did you receive, sell, exchange, gift, or otherwise dispose of a digital asset?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "foreign_accounts", label: "Did you have a financial interest in or signature authority over a foreign account or trust?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "foreign_accounts_over_10k", label: "Did the combined value of all foreign accounts exceed $10,000 at any time during the year?", type: "radio", showIf: { field: "foreign_accounts", value: "yes" }, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "large_gifts", label: "Did you gift $19,000 or more to another individual?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "marketplace_insurance", label: "Did you purchase health insurance through the Marketplace or a public exchange?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "health_coverage_full_year", label: "Did you have health insurance coverage for the entire year? (CA, DC, MA, NJ, and RI only)", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
  },

  // ── 8. Income ──
  {
    key: "income",
    title: "Income",
    description: "Select all types of income received during the tax year, even if you didn't receive a form.",
    fields: [
      { key: "income_types", label: "Type(s) of income received", type: "checkbox-group", items: [
        { key: "w2", label: "Employment (W-2)" },
        { key: "1099_misc_rents", label: "Rents (1099-MISC)" },
        { key: "1099_r", label: "Retirement distribution (1099-R)" },
        { key: "1099_misc_royalties", label: "Royalties (1099-MISC)" },
        { key: "ssa_1099", label: "Social Security (SSA-1099)" },
        { key: "1099_q", label: "ESA or 529 distribution (1099-Q)" },
        { key: "1099_nec_k", label: "Self-employment (1099-NEC or 1099-K)" },
        { key: "1099_sa", label: "HSA or MSA distribution (1099-SA)" },
        { key: "1099_g_refund", label: "State or local tax refund (1099-G)" },
        { key: "k1_partnership", label: "Partnership (Schedule K-1)" },
        { key: "1099_g_unemployment", label: "Unemployment (1099-G)" },
        { key: "k1_scorp", label: "S-corporation (Schedule K-1)" },
        { key: "1099_int", label: "Interest (1099-INT)" },
        { key: "k1_estate_trust", label: "Estate or trust (Schedule K-1)" },
        { key: "1099_div", label: "Dividends (1099-DIV)" },
        { key: "w2g", label: "Gambling (W-2G)" },
        { key: "1099_b", label: "Sold stock or investments (1099-B)" },
        { key: "farming", label: "Farming" },
        { key: "1099_c", label: "Canceled debt (1099-C)" },
        { key: "other_income", label: "Other income" },
      ]},
    ],
  },

  // ── 9. Expenses ──
  {
    key: "expenses",
    title: "Expenses",
    description: "Select all expenses that apply to the tax year.",
    fields: [
      { key: "expense_types", label: "Did you pay any of the following expenses?", type: "checkbox-group", items: [
        { key: "adoption", label: "Adoption expenses" },
        { key: "alimony", label: "Alimony from a divorce finalized on or before December 31, 2018" },
        { key: "childcare", label: "Child or dependent care expenses" },
        { key: "educator", label: "Educator expenses" },
        { key: "higher_education", label: "Higher education expenses" },
        { key: "household_worker", label: "Household worker expenses" },
        { key: "hsa", label: "Health savings account (HSA) contributions" },
        { key: "ira", label: "Individual retirement arrangement (IRA) contributions" },
        { key: "student_loan", label: "Student loan interest" },
        { key: "energy_improvements", label: "Energy-efficient home improvements" },
        { key: "ev_purchase", label: "Plug-in electric vehicle purchase" },
        { key: "vehicle_loan", label: "Personal vehicle loan interest" },
      ]},
    ],
  },

  // ── 10. Deductions ──
  {
    key: "deductions",
    title: "Deductions",
    description: "Enter amounts for any itemized deductions.",
    fields: [
      { key: "has_deductions", label: "Did you pay any of the following during the tax year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "medical_dental", label: "Medical and dental expenses", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "mortgage_interest", label: "Mortgage interest", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "state_local_taxes", label: "State and local income taxes", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "charitable_cash", label: "Donations to charity (cash)", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "sales_taxes", label: "Sales taxes", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "charitable_noncash", label: "Donations to charity (non-cash)", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "real_estate_taxes", label: "Real estate taxes", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "casualty_theft", label: "Casualty and theft losses", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "personal_property_taxes", label: "Personal property taxes", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
      { key: "gambling_losses", label: "Gambling losses", type: "currency", half: true, showIf: { field: "has_deductions", value: "yes" } },
    ],
  },

  // ── 11. Estimated Taxes ──
  {
    key: "estimated_taxes",
    title: "Estimated Taxes",
    description: "Federal and state estimated tax payments made during the year.",
    fields: [
      { key: "made_estimated", label: "Did you make any estimated tax payments or apply your prior year refund?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "heading_federal", label: "Federal Payments", type: "heading", showIf: { field: "made_estimated", value: "yes" } },
      { key: "overpayment_applied", label: "Overpayment applied from prior year", type: "currency", showIf: { field: "made_estimated", value: "yes" } },
      { key: "q1_amount", label: "First quarterly payment", type: "currency", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q1_date", label: "Date", type: "date", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q2_amount", label: "Second quarterly payment", type: "currency", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q2_date", label: "Date", type: "date", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q3_amount", label: "Third quarterly payment", type: "currency", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q3_date", label: "Date", type: "date", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q4_amount", label: "Fourth quarterly payment", type: "currency", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "q4_date", label: "Date", type: "date", half: true, showIf: { field: "made_estimated", value: "yes" } },
      { key: "additional_amount", label: "Additional payment", type: "currency", showIf: { field: "made_estimated", value: "yes" } },
      { key: "heading_state", label: "State Estimated Payments", type: "heading", showIf: { field: "made_estimated", value: "yes" } },
      { key: "state_estimated_states", label: "In which states did you make estimated payments?", type: "select", options: US_STATES, showIf: { field: "made_estimated", value: "yes" } },
      { key: "state_estimated_amount", label: "Total state estimated payments", type: "currency", showIf: { field: "made_estimated", value: "yes" } },
    ],
  },

  // ── 12. Refund & Payment ──
  {
    key: "refund_payment",
    title: "Additional Information",
    description: "Refund and payment preferences.",
    fields: [
      { key: "heading_refund", label: "Refund and Payment", type: "heading" },
      { key: "refund_method", label: "If you are due a refund, how would you like to receive it?", type: "radio", required: true, options: [
        { value: "direct_deposit", label: "Direct deposit into a bank account" },
        { value: "paper_check", label: "Paper check by mail" },
        { value: "apply_next_year", label: "Apply to next year estimated taxes" },
      ]},
      { key: "payment_method", label: "If you owe a balance, how would you like to pay it?", type: "radio", required: true, options: [
        { value: "draft_bank", label: "Draft payment from a bank account" },
        { value: "mail_check", label: "Mail a check" },
        { value: "credit_card", label: "Pay by credit card (additional costs apply)" },
        { value: "payment_plan", label: "Setup a payment plan (additional costs apply)" },
      ]},
      { key: "heading_bank", label: "Bank Account Information", type: "heading" },
      { key: "routing_number", label: "Routing Number", type: "text", half: true },
      { key: "account_number", label: "Account Number", type: "text", half: true },
      { key: "account_type", label: "Account Type", type: "radio", options: [
        { value: "checking", label: "Checking" }, { value: "savings", label: "Savings" },
      ]},
    ],
  },

  // ── 13. Comments ──
  {
    key: "comments",
    title: "Comments",
    description: "Enter any additional information or questions here.",
    fields: [
      { key: "comments", label: "Additional Information", type: "textarea", placeholder: "Enter any additional information or questions here..." },
    ],
  },
];

/* ================================================================== */
/*  1120 / 1120-S — CORPORATE RETURNS                                 */
/* ================================================================== */

const businessSections: OrganizerSection[] = [
  {
    key: "business_info",
    title: "Business Information",
    description: "Basic information about the business entity.",
    fields: [
      { key: "business_name", label: "Legal Business Name", type: "text", required: true },
      { key: "dba", label: "DBA (Doing Business As)", type: "text" },
      { key: "ein", label: "EIN (Employer Identification Number)", type: "ssn", required: true },
      { key: "formation_date", label: "Date of Formation/Incorporation", type: "date" },
      { key: "formation_state", label: "State of Formation", type: "select", options: US_STATES },
      { key: "naics_code", label: "NAICS Code / Industry", type: "text" },
      { key: "fiscal_year_end", label: "Fiscal Year End", type: "select", options: [
        { value: "12/31", label: "December 31 (Calendar Year)" },
        { value: "01/31", label: "January 31" }, { value: "02/28", label: "February 28" },
        { value: "03/31", label: "March 31" }, { value: "04/30", label: "April 30" },
        { value: "05/31", label: "May 31" }, { value: "06/30", label: "June 30" },
        { value: "07/31", label: "July 31" }, { value: "08/31", label: "August 31" },
        { value: "09/30", label: "September 30" }, { value: "10/31", label: "October 31" },
        { value: "11/30", label: "November 30" },
      ]},
      { key: "heading_address", label: "Business Address", type: "heading" },
      { key: "street", label: "Street", type: "text", required: true },
      { key: "suite", label: "Suite / Unit", type: "text" },
      { key: "city", label: "City", type: "text", required: true, half: true },
      { key: "state", label: "State", type: "select", required: true, options: US_STATES, half: true },
      { key: "zip", label: "ZIP Code", type: "text", required: true },
      { key: "phone", label: "Business Phone", type: "phone" },
    ],
  },
  {
    key: "officers",
    title: "Officers / Shareholders",
    description: "List all officers, directors, and shareholders/partners.",
    fields: [
      { key: "officers", label: "Officers / Shareholders", type: "repeater", subFields: [
        { key: "name", label: "Full Name", type: "text", required: true },
        { key: "title", label: "Title", type: "text", required: true, half: true },
        { key: "ssn", label: "SSN", type: "ssn", required: true, half: true },
        { key: "ownership_pct", label: "Ownership %", type: "text", half: true },
        { key: "compensation", label: "Annual Compensation", type: "currency", half: true },
      ]},
    ],
  },
  {
    key: "financial_summary",
    title: "Financial Summary",
    description: "Provide a high-level summary of business financials for the tax year.",
    fields: [
      { key: "gross_revenue", label: "Gross Revenue / Sales", type: "currency" },
      { key: "cost_of_goods", label: "Cost of Goods Sold", type: "currency" },
      { key: "total_payroll", label: "Total Payroll", type: "currency" },
      { key: "officer_compensation", label: "Total Officer Compensation", type: "currency" },
      { key: "rent_expense", label: "Rent / Lease Payments", type: "currency" },
      { key: "estimated_payments", label: "Estimated Tax Payments Made", type: "currency" },
      { key: "heading_questions", label: "Business Activity", type: "heading" },
      { key: "new_employees", label: "Did you hire any new employees?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "asset_purchases", label: "Did you purchase any major assets (equipment, vehicles, property)?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "asset_dispositions", label: "Did you sell or dispose of any assets?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "new_loans", label: "Did you take on any new loans or credit lines?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "distributions", label: "Were distributions made to shareholders/partners?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
  },
  {
    key: "state_filing",
    title: "State Filing",
    description: "Indicate which states the business operates in or has filing obligations.",
    fields: [
      { key: "states_filing", label: "In which states does the business have filing requirements?", type: "checkbox-group", items:
        US_STATES.map((s) => ({ key: s.value, label: s.label }))
      },
    ],
  },
  {
    key: "comments",
    title: "Comments",
    description: "Enter any additional information or questions here.",
    fields: [
      { key: "comments", label: "Additional Information", type: "textarea", placeholder: "Enter any additional information or questions here..." },
    ],
  },
];

/* ================================================================== */
/*  1065 — PARTNERSHIP RETURN                                         */
/* ================================================================== */

const partnership1065Sections: OrganizerSection[] = [
  businessSections[0], // business_info
  {
    key: "officers",
    title: "Partners",
    description: "List all partners with their ownership details.",
    fields: [
      { key: "officers", label: "Partners", type: "repeater", subFields: [
        { key: "name", label: "Full Name", type: "text", required: true },
        { key: "type", label: "Partner Type", type: "select", options: [
          { value: "general", label: "General Partner" },
          { value: "limited", label: "Limited Partner" },
          { value: "managing", label: "Managing Partner" },
        ], half: true },
        { key: "ssn", label: "SSN / EIN", type: "ssn", required: true, half: true },
        { key: "ownership_pct", label: "Ownership %", type: "text", half: true },
        { key: "profit_sharing_pct", label: "Profit Sharing %", type: "text", half: true },
        { key: "guaranteed_payments", label: "Guaranteed Payments", type: "currency" },
      ]},
    ],
  },
  businessSections[2], // financial_summary
  businessSections[3], // state_filing
  businessSections[4], // comments
];

/* ================================================================== */
/*  1041 — ESTATE / TRUST RETURN                                      */
/* ================================================================== */

const estateTrust1041Sections: OrganizerSection[] = [
  {
    key: "trust_info",
    title: "Trust / Estate Information",
    description: "Basic information about the trust or estate.",
    fields: [
      { key: "entity_name", label: "Trust/Estate Name", type: "text", required: true },
      { key: "ein", label: "EIN", type: "ssn", required: true },
      { key: "entity_type", label: "Entity Type", type: "select", required: true, options: [
        { value: "revocable_trust", label: "Revocable Trust" },
        { value: "irrevocable_trust", label: "Irrevocable Trust" },
        { value: "estate", label: "Estate" },
        { value: "grantor_trust", label: "Grantor Trust" },
        { value: "charitable_trust", label: "Charitable Trust" },
      ]},
      { key: "formation_date", label: "Date Established", type: "date" },
      { key: "heading_grantor", label: "Grantor / Decedent Information", type: "heading" },
      { key: "grantor_name", label: "Grantor/Decedent Full Name", type: "text", required: true },
      { key: "grantor_ssn", label: "SSN", type: "ssn" },
      { key: "grantor_dob", label: "Date of Birth", type: "date" },
      { key: "date_of_death", label: "Date of Death (if applicable)", type: "date" },
      { key: "heading_trustee", label: "Trustee / Executor", type: "heading" },
      { key: "trustee_name", label: "Trustee/Executor Name", type: "text", required: true },
      { key: "trustee_phone", label: "Phone", type: "phone" },
      { key: "trustee_email", label: "Email", type: "email" },
    ],
  },
  {
    key: "beneficiaries",
    title: "Beneficiaries",
    description: "List all beneficiaries of the trust or estate.",
    fields: [
      { key: "beneficiaries", label: "Beneficiaries", type: "repeater", subFields: [
        { key: "name", label: "Full Name", type: "text", required: true },
        { key: "ssn", label: "SSN", type: "ssn", required: true, half: true },
        { key: "distribution_pct", label: "Distribution %", type: "text", half: true },
        { key: "relationship", label: "Relationship", type: "text" },
        { key: "address", label: "Address", type: "text" },
      ]},
    ],
  },
  {
    key: "assets_income",
    title: "Assets & Income",
    description: "Provide details about trust/estate assets and income.",
    fields: [
      { key: "income_types", label: "Types of income received", type: "checkbox-group", items: [
        { key: "interest", label: "Interest income" },
        { key: "dividends", label: "Dividend income" },
        { key: "rental", label: "Rental income" },
        { key: "capital_gains", label: "Capital gains / losses" },
        { key: "business_income", label: "Business income" },
        { key: "royalties", label: "Royalties" },
        { key: "farm_income", label: "Farm income" },
        { key: "other", label: "Other income" },
      ]},
      { key: "total_assets", label: "Estimated Total Asset Value", type: "currency" },
      { key: "heading_expenses", label: "Trust/Estate Expenses", type: "heading" },
      { key: "trustee_fees", label: "Trustee/Executor fees", type: "currency", half: true },
      { key: "legal_fees", label: "Legal fees", type: "currency", half: true },
      { key: "accounting_fees", label: "Accounting fees", type: "currency", half: true },
      { key: "other_expenses", label: "Other expenses", type: "currency", half: true },
    ],
  },
  {
    key: "distributions",
    title: "Distributions",
    description: "Record of distributions made to beneficiaries.",
    fields: [
      { key: "made_distributions", label: "Were distributions made to beneficiaries during the tax year?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "total_distributions", label: "Total Distributions", type: "currency", showIf: { field: "made_distributions", value: "yes" } },
      { key: "distribution_type", label: "Type of Distributions", type: "select", showIf: { field: "made_distributions", value: "yes" }, options: [
        { value: "income", label: "Income only" },
        { value: "principal", label: "Principal only" },
        { value: "both", label: "Both income and principal" },
      ]},
    ],
  },
  {
    key: "comments",
    title: "Comments",
    description: "Enter any additional information or questions here.",
    fields: [
      { key: "comments", label: "Additional Information", type: "textarea", placeholder: "Enter any additional information or questions here..." },
    ],
  },
];

/* ================================================================== */
/*  Export: getSectionsForReturnType                                    */
/* ================================================================== */

export function getSectionsForReturnType(
  returnType: ReturnType
): OrganizerSection[] {
  switch (returnType) {
    case "1040":
      return individual1040Sections;
    case "1120":
    case "1120S":
      return businessSections;
    case "1065":
      return partnership1065Sections;
    case "1041":
      return estateTrust1041Sections;
    default:
      return individual1040Sections;
  }
}

/** Get section keys for a return type */
export function getSectionKeys(returnType: ReturnType): string[] {
  return getSectionsForReturnType(returnType).map((s) => s.key);
}

/** Labels for return types */
export const returnTypeLabels: Record<ReturnType, string> = {
  "1040": "Individual Tax Return (1040)",
  "1120": "C Corporation (1120)",
  "1120S": "S Corporation (1120-S)",
  "1065": "Partnership (1065)",
  "1041": "Estate / Trust (1041)",
};
