// Shapes returned by GET /api/dashboard/client-tracker.

export interface Kpis {
  totalClients: number;
  totalDeals: number;
  totalRevenue: number;
  totalMrr: number;
  totalOutstanding: number;
  totalClientRevenue?: number;
  totalAdSpend?: number;
  /** Admin only: linked clients whose weekly update is due, overdue or never sent. */
  updatesDue?: number;
}

/** Newest SENT biweekly NPS survey for a linked client (null when unlinked). */
export interface NpsStatus {
  score: number | null;
  legacyScore: number | null;
  sentAt: string | null;
  answeredAt: string | null;
  expiresAt: string | null;
  state: "not_sent" | "awaiting" | "answered" | "expired";
}

/** Weekly update cadence for a linked client (null when unlinked). */
export interface UpdateStatus {
  lastSentAt: string | null;
  lastViewedAt: string | null;
  daysSinceSent: number | null;
  state: "sent" | "due" | "overdue" | "never" | "pending";
}

export interface ClientRow {
  email: string;
  name: string;
  company: string | null;
  billingPlan: "monthly" | "annual" | "enterprise" | null;
  signedAt: string | null;
  startDate: string | null;
  termEnd?: string | null;
  /** The term runs from launch and the client hasn't launched yet. */
  termStartsAtLaunch?: boolean;
  dealsCount: number;
  revenue: number;
  adSpendCollected?: number;
  mrr: number;
  outstanding: number;
  lastPaymentAt: string | null;
  status: "active" | "signed";
  clientUserId?: string | null;
  websiteUrl?: string | null;
  theirRevenue?: number | null;
  nps?: NpsStatus | null;
  update?: UpdateStatus | null;
}

export interface DueClient {
  name: string;
  clientUserId: string;
}

export const EMPTY_KPIS: Kpis = {
  totalClients: 0,
  totalDeals: 0,
  totalRevenue: 0,
  totalMrr: 0,
  totalOutstanding: 0,
  totalClientRevenue: 0,
};
