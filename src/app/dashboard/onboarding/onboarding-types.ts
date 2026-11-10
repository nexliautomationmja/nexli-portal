// Types and pure helpers for the admin Onboarding page (client-safe: no db).
// The list reads raw engagements.metadata.onboarding; the sheet reads the
// admin serializer (src/lib/onboarding.ts serializeAdminOnboarding).

import type { Tone } from "@/components/rainmaker";

export type PhaseStatus = "pending" | "in_progress" | "done";
export type TaskStatus = "todo" | "submitted" | "approved" | "needs_attention";

export interface RawOnboardingState {
  /** Template version: 2 = the Facebook question is required (src/lib/onboarding.ts). */
  version?: number;
  phases?: Record<string, { status: PhaseStatus }>;
  tasks?: Record<string, { status: TaskStatus; submission?: unknown }>;
  targetLaunchDate?: string | null;
  clientDueAt?: string | null;
  campaignLaunchedAt?: string | null;
}

export interface EngagementRow {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  metadata?: { onboarding?: RawOnboardingState; billingPlan?: string } | null;
  signers: { id: string; name: string; email: string; order: number; status: string; signedAt?: string | null }[];
}

export interface AdminPhase {
  id: string;
  title: string;
  emoji: string;
  description: string;
  status: PhaseStatus;
  targetDate: string | null;
  note: string | null;
}

export interface AdminTask {
  id: string;
  title: string;
  emoji: string;
  type: "credentials" | "confirm" | "upload" | "form";
  optional: boolean;
  status: TaskStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  submission: unknown;
  /** payment_setup only: a Stripe login sent before that question existed (decrypted). */
  legacyStripe?: unknown;
}

export interface BillingInvoiceRef {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  total: number; // cents
  paidAt: string | null;
}

export interface AdminBilling {
  isDrs: boolean;
  plan: "monthly" | "annual";
  setup: BillingInvoiceRef | null;
  firstMonthly: (BillingInvoiceRef & { createdAt: string }) | null;
  billingStartedAt: string | null;
}

export interface ActivityEntry {
  at: string;
  actor: "agency" | "client" | "system" | string;
  type: string;
  message: string;
}

export interface AdminDetail {
  engagementId: string;
  subject: string;
  onboarding: {
    startedAt: string;
    targetLaunchDate: string | null;
    clientDueAt: string | null;
    campaignLaunchedAt: string | null;
    daysUntilDue: number | null;
    isOverdue: boolean;
    clientItemsComplete: boolean;
    progressPercent: number;
    phases: AdminPhase[];
    tasks: AdminTask[];
    activity: ActivityEntry[];
  };
  clientSigners: { id: string; name: string; email: string; token: string; order: number }[];
  billing?: AdminBilling | null;
}

// ─── Formatting ────────────────────────────────────────────

/** "Nov 10, 2026" from YYYY-MM-DD (noon, so the day never shifts) or an ISO timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── The list's numbers (same rules as src/lib/onboarding.ts) ──

/** The items a Launch Pad shows today, in order. */
const TASK_IDS = ["payment_setup", "dns_access", "fb_ads_invite", "drivers_license"] as const;
/** Mirrors taskOptional() in src/lib/onboarding.ts (server-only module): the
 * Facebook question is optional only on Launch Pads started before version 2. */
const isOptional = (state: RawOnboardingState, id: string) => id === "fb_ads_invite" && (state.version ?? 1) < 2;

/**
 * The client's items with the server's rules: an old Stripe login stands in
 * for "How you get paid" until that's answered (tasksOf), and keys no Launch
 * Pad shows anymore are ignored.
 */
export function rawTasks(state: RawOnboardingState): [string, { status: TaskStatus; submission?: unknown }][] {
  const t = state.tasks || {};
  const out: [string, { status: TaskStatus; submission?: unknown }][] = [];
  for (const id of TASK_IDS) {
    let task = t[id];
    if (id === "payment_setup" && !task && t.stripe_setup) {
      const s = t.stripe_setup.status;
      task = { status: s === "submitted" || s === "approved" ? s : "todo" };
    }
    if (task) out.push([id, task]);
  }
  return out;
}

/** Client items still owed (clientItemsOutstanding). */
export function itemsOutstanding(state: RawOnboardingState): number {
  return rawTasks(state).filter(([id, t]) => {
    if (t.status === "submitted" || t.status === "approved") return false;
    if (isOptional(state, id) && t.status === "todo") return false;
    return true;
  }).length;
}

/** Items the client sent that we haven't reviewed. */
export function itemsToReview(state: RawOnboardingState): number {
  return rawTasks(state).filter(([, t]) => t.status === "submitted").length;
}

/** computeProgress: phases count 2 (1 when in progress), items 1; untouched optional items don't count. */
export function progressPercent(state: RawOnboardingState): number {
  let earned = 0;
  let total = 0;
  for (const p of Object.values(state.phases || {})) {
    total += 2;
    if (p.status === "in_progress") earned += 1;
    if (p.status === "done") earned += 2;
  }
  for (const [id, t] of rawTasks(state)) {
    if (isOptional(state, id) && t.status === "todo") continue;
    total += 1;
    if (t.status === "submitted" || t.status === "approved") earned += 1;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

export function phaseCounts(state: RawOnboardingState): { done: number; total: number } {
  const phases = Object.values(state.phases || {});
  return { done: phases.filter((p) => p.status === "done").length, total: phases.length };
}

/** Whole local-calendar days until a YYYY-MM-DD date (0 = today, negative = past). */
export function daysUntil(dateOnly: string): number {
  const due = new Date(`${dateOnly}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export interface DueView {
  tone: Tone;
  label: string;
}

/** Where the client's items stand against their due date (null = nothing to flag). */
export function dueView(outstanding: number, days: number | null, hasDue: boolean): DueView | null {
  if (!hasDue) return null;
  if (outstanding === 0) return { tone: "green", label: "All in" };
  if (days === null) return null;
  if (days < 0) return { tone: "red", label: `Overdue ${-days}d` };
  if (days === 0) return { tone: "amber", label: "Due today" };
  if (days <= 2) return { tone: "amber", label: `${days}d left` };
  return null;
}

export function rowDue(state: RawOnboardingState): DueView | null {
  return dueView(itemsOutstanding(state), state.clientDueAt ? daysUntil(state.clientDueAt) : null, Boolean(state.clientDueAt));
}

/** They told us they have no Facebook ad account and it isn't set up yet (approved = done). */
export function adAccountToSetUp(state: RawOnboardingState): boolean {
  const fb = state.tasks?.fb_ads_invite;
  const sub = fb?.submission as { hasAccount?: unknown } | null | undefined;
  return Boolean(fb && fb.status === "submitted" && sub && sub.hasAccount === false);
}

export const clientNameFor = (eng: EngagementRow) => eng.signers.find((s) => s.order > 0)?.name || "Unknown client";

export const TASK_STATUS: Record<TaskStatus, { tone: Tone; label: string }> = {
  todo: { tone: "neutral", label: "Waiting on client" },
  submitted: { tone: "amber", label: "Needs review" },
  approved: { tone: "green", label: "Approved" },
  needs_attention: { tone: "red", label: "Sent back" },
};
