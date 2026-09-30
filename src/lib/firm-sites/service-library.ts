/**
 * Canonical service copy for Firm Foundation websites, keyed by the ids the
 * marketing app's intake form collects (leads.onboarding_intake.services).
 */
import type { FirmSiteConfig } from "./types";

export type IntakeServiceId =
  | "individual-tax"
  | "business-tax"
  | "bookkeeping"
  | "tax-planning"
  | "payroll"
  | "cfo";

export interface ServiceLibraryEntry {
  title: string;
  description: string;
  icon: string;
}

export const SERVICE_LIBRARY: Record<IntakeServiceId, ServiceLibraryEntry> = {
  "individual-tax": {
    title: "Individual Tax Preparation",
    description:
      "Accurate, on-time federal and state returns for individuals and families, with every credit and deduction you are entitled to reviewed by a CPA.",
    icon: "user",
  },
  "business-tax": {
    title: "Business Tax Returns",
    description:
      "Partnership, S corporation, C corporation and sole proprietor filings prepared with an eye toward reducing your liability and keeping you compliant year round.",
    icon: "building",
  },
  bookkeeping: {
    title: "Bookkeeping & Accounting",
    description:
      "Monthly reconciliations and clean, reliable financial statements so you always know where the business stands and tax season holds no surprises.",
    icon: "book",
  },
  "tax-planning": {
    title: "Tax Planning & Strategy",
    description:
      "Proactive, year-round planning that structures your income, entities and investments to lower what you owe before the year closes.",
    icon: "target",
  },
  payroll: {
    title: "Payroll Services",
    description:
      "Reliable payroll processing, tax deposits and quarterly filings handled for you, so your team is paid correctly and on schedule every time.",
    icon: "banknote",
  },
  cfo: {
    title: "Fractional CFO & Advisory",
    description:
      "Cash-flow forecasting, budgeting and financial guidance from an experienced CPA who understands where you want to take the business.",
    icon: "trending-up",
  },
};

export const INTAKE_SERVICE_IDS = Object.keys(SERVICE_LIBRARY) as IntakeServiceId[];

export const DEFAULT_SERVICE_IDS: IntakeServiceId[] = [
  "individual-tax",
  "business-tax",
  "tax-planning",
  "bookkeeping",
];

export function isIntakeServiceId(id: unknown): id is IntakeServiceId {
  return typeof id === "string" && id in SERVICE_LIBRARY;
}

/**
 * Map intake ids to site services in the order given. Unknown ids are
 * ignored and duplicates collapsed; an empty or missing list falls back to
 * DEFAULT_SERVICE_IDS.
 */
export function servicesFromIntake(ids?: string[] | null): FirmSiteConfig["services"] {
  const seen = new Set<IntakeServiceId>();
  const picked: IntakeServiceId[] = [];
  for (const id of ids ?? []) {
    if (isIntakeServiceId(id) && !seen.has(id)) {
      seen.add(id);
      picked.push(id);
    }
  }
  const list = picked.length ? picked : DEFAULT_SERVICE_IDS;
  return list.map((id) => {
    const entry = SERVICE_LIBRARY[id];
    return { title: entry.title, description: entry.description, icon: entry.icon };
  });
}
