// Shapes returned by GET /api/dashboard/client-tracker/[clientId].
import type { SurveyAnswers } from "@/lib/survey-questions";

export interface SurveyItem {
  id: string;
  weekStart: string;
  /** NPS 0–10; null for legacy (pre-NPS) submissions and unanswered surveys. */
  npsScore: number | null;
  /** Legacy 1–5 confidence score from the old single-question survey. */
  legacyScore: number | null;
  /** 1–5 answers to the four rated questions. */
  answers: SurveyAnswers | null;
  valueAnswer: string | null;
  comment: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
}

export interface UpdateStatusItem {
  lastSentAt: string | null;
  lastViewedAt: string | null;
  thisWeekStatus: "sent" | "draft" | null;
  daysSinceSent: number | null;
  state: "sent" | "due" | "overdue" | "never" | "pending";
}

export interface NpsStatusItem {
  score: number | null;
  legacyScore: number | null;
  sentAt: string | null;
  viewedAt: string | null;
  answeredAt: string | null;
  expiresAt: string | null;
  state: "not_sent" | "awaiting" | "answered" | "expired";
}

export interface WeeklyUpdateItem {
  id: string;
  weekStart: string;
  headline: string | null;
  body: string;
  adSpendCents: number | null;
  status: string;
  sentAt: string | null;
  viewedAt: string | null;
  updatedAt: string;
}

export type ActivityType = "payment" | "invoice" | "engagement" | "lead" | "portal_login";

export interface DetailData {
  client: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    websiteUrl: string | null;
    lastLoginAt: string | null;
  };
  theirBook: {
    kpis: { totalClients: number; totalDeals: number; totalRevenue: number; totalMrr: number; totalOutstanding: number };
    topClients: { email: string; name: string; company: string | null; revenue: number; mrr: number; lastPaymentAt: string | null }[];
  };
  leads30d: number;
  /** Campaign progress tracker; null when they have no DRS engagement (or GHL was down). */
  campaign: {
    launchedAt: string | null;
    leads: number;
    daysSinceLaunch: number;
    pipelineValueCents: number;
    avgEngagementCents: number;
    status: "not_launched" | "live";
    source: "ghl" | "notifications" | "none";
    computedAt: string;
  } | null;
  traffic: { pageViews30d: number; uniqueVisitors30d: number; daily: { date: string; pageViews: number; uniqueVisitors: number }[] };
  youCollect: { revenue: number; mrr: number; outstanding: number; adSpendCollected?: number } | null;
  activity: { at: string; type: ActivityType; message: string }[];
  surveys?: SurveyItem[];
  weeklyUpdates?: WeeklyUpdateItem[];
  /** Where things stand right now; null members when the success tables are unavailable. */
  status?: { update: UpdateStatusItem | null; nps: NpsStatusItem | null };
}
