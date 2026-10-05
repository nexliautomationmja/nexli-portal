import { db } from "@/db";
import { engagements, engagementSigners, users } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { decryptSubmission } from "./onboarding-crypto";

// ══════════════════════════════════════════════════════════
// Client Onboarding ("Launch Pad")
//
// State lives entirely under engagements.metadata.onboarding — no new
// tables. The neon-http driver has no transactions, so every write is a
// targeted jsonb_set on its own path (phases/tasks are id-keyed objects,
// never arrays) and concurrent client/admin writes can't clobber each
// other. Titles and copy live here in code, not in the jsonb.
// ══════════════════════════════════════════════════════════

export type PhaseId = "website" | "automations" | "portal";
export type TaskId =
  | "stripe_setup"
  | "dns_access"
  | "dream_clients"
  | "fb_ads_invite"
  | "drivers_license";
export type PhaseStatus = "pending" | "in_progress" | "done";
export type TaskStatus = "todo" | "submitted" | "approved" | "needs_attention";
export type LicenseSide = "front" | "back";

export interface OnboardingPhaseState {
  status: PhaseStatus;
  targetDate: string | null; // ISO date (YYYY-MM-DD)
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

export interface LicenseFileMeta {
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface OnboardingTaskState {
  status: TaskStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  // credentials → encrypted string (or plain object w/o env key)
  // confirm     → { confirmed: true } | { notApplicable: true }
  // upload      → { files: { front: LicenseFileMeta|null, back: ... } }
  submission: unknown;
}

export interface OnboardingActivityEntry {
  at: string;
  actor: "agency" | "client" | "system";
  type: string;
  message: string;
}

export interface OnboardingState {
  version: 1;
  startedAt: string;
  startedBy: "auto_sign" | "admin";
  targetLaunchDate: string | null;
  /**
   * Deadline for the client's own items (YYYY-MM-DD). Seeded to kickoff +
   * CLIENT_ITEMS_DUE_DAYS; admin-editable. Legacy states lack the key —
   * treat undefined as null (no deadline).
   */
  clientDueAt?: string | null;
  /**
   * The day Nexli's ad campaigns for this client went live (YYYY-MM-DD).
   * Starts the Nexli Guarantee clock (NEXLI_GUARANTEE.LEAD_WINDOW_DAYS) —
   * admin-set from the Onboarding page. Legacy states lack the key; treat
   * undefined as null (not launched).
   */
  campaignLaunchedAt?: string | null;
  /** YYYY-MM-DD dates on which a due-date reminder email went out. */
  dueRemindersSent?: string[];
  /** ISO timestamp of the admin "overdue" notification, once sent. */
  overdueNotifiedAt?: string | null;
  /** A tier may seed a subset — see defaultOnboardingState. */
  phases: Partial<Record<PhaseId, OnboardingPhaseState>>;
  tasks: Partial<Record<TaskId, OnboardingTaskState>>;
  activity: OnboardingActivityEntry[];
}

/** Clients get this many days from kickoff to submit all their items. */
export const CLIENT_ITEMS_DUE_DAYS = 5;

/** YYYY-MM-DD in UTC — date-only strings never drift with the server TZ. */
export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date-only string + n days (UTC arithmetic, no DST drift). */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

// ── Template (copy lives in code) ─────────────────────────

export const PHASE_ORDER: PhaseId[] = ["website", "automations", "portal"];

/**
 * What each tier actually buys, and therefore what its Launch Pad shows.
 *
 * Firm Foundation is a website and a client portal — no ads, no automations,
 * so the automations phase and the dream-clients / Facebook / licence tasks
 * would all be dead weight on that page. DRS keeps the full set.
 */
export type OnboardingTier = "foundation" | "drs";

const TIER_PHASES: Record<OnboardingTier, PhaseId[]> = {
  foundation: ["website", "portal"],
  drs: ["website", "automations", "portal"],
};

const TIER_TASKS: Record<OnboardingTier, TaskId[]> = {
  foundation: ["stripe_setup", "dns_access"],
  drs: ["stripe_setup", "dns_access", "dream_clients", "fb_ads_invite", "drivers_license"],
};

/**
 * Which phases/tasks this particular engagement has, in canonical order.
 *
 * The seeded state is the source of truth rather than the tier, so a record
 * keeps whatever it was created with even if the tier definitions change
 * later. Records seeded before tiers existed have every key, so they are
 * unaffected.
 */
export function phaseIdsFor(state: OnboardingState): PhaseId[] {
  const present = PHASE_ORDER.filter((id) => state.phases?.[id]);
  return present.length ? present : PHASE_ORDER;
}

export function taskIdsFor(state: OnboardingState): TaskId[] {
  const present = TASK_ORDER.filter((id) => state.tasks?.[id]);
  return present.length ? present : TASK_ORDER;
}

export const PHASE_INFO: Record<
  PhaseId,
  { title: string; description: string; emoji: string; features: string[] }
> = {
  website: {
    title: "Website Build-Out",
    emoji: "🎨",
    description:
      "Your new high-converting website — designed, written, and built by our team.",
    features: [
      "Custom design tailored to your business",
      "SEO-optimized structure",
      "Conversion-focused layouts",
      "Mobile-responsive & lightning fast",
      "Integrated booking systems",
      "Trust signals & social proof",
    ],
  },
  automations: {
    title: "Automations & Reputation Management",
    emoji: "⚡",
    description:
      "Instant lead follow-up, missed-call textback, and automatic review requests that build your reputation on autopilot.",
    features: [
      "24/7 inbound inquiry processing",
      "Instant follow-up sequences",
      "Missed-call textback",
      "Automated appointment booking",
      "Review requests on autopilot",
      "Zero-touch prospect qualification",
    ],
  },
  portal: {
    title: "Client Portal Build-Out",
    emoji: "🛠️",
    description:
      "Your command center — leads, conversations, and results in one place.",
    features: [
      "Invoicing & payments",
      "Engagement letters & e-sign",
      "Secure document collection",
      "Client messaging",
      "Lead & conversation tracking",
      "Your branded experience",
    ],
  },
};

export const TASK_ORDER: TaskId[] = [
  "stripe_setup",
  "dns_access",
  "dream_clients",
  "fb_ads_invite",
  "drivers_license",
];

export const TASK_INFO: Record<
  TaskId,
  {
    title: string;
    description: string;
    type: "credentials" | "confirm" | "upload" | "form";
    optional: boolean;
    emoji: string;
  }
> = {
  stripe_setup: {
    title: "Stripe Account Setup",
    emoji: "💳",
    type: "credentials",
    optional: false,
    description:
      "Want to collect payments seamlessly? Set up (or connect) the Stripe account for your business — it's how our platform invoices, collects, and routes payments for you. Once it's ready (or if you already have one), share the login below so we can wire everything up. Without it, there's no efficient way to collect.",
  },
  dns_access: {
    title: "Domain & DNS Access",
    emoji: "🌐",
    type: "credentials",
    optional: false,
    description:
      "Tell us where your domain lives (GoDaddy, Namecheap, etc.) and share the login so we can connect your new website. Your info is sent securely and only visible to your Nexli team.",
  },
  dream_clients: {
    title: "Your Top 3 Best Clients",
    emoji: "🎯",
    type: "form",
    optional: false,
    description:
      "Tell us about your three best clients — the ones you'd clone if you could — and what they have in common. Then bring it together: name your avatar, the one person you're 100% confident you can save six to seven figures in taxes. Your whole tax-planning offer and ad targeting get built around that avatar.",
  },
  fb_ads_invite: {
    title: "Facebook Ads Account Invite",
    emoji: "📣",
    type: "confirm",
    optional: true,
    description:
      "If you already run Facebook Ads, invite our agency as a partner so we can manage campaigns from your account.",
  },
  drivers_license: {
    title: "Driver's License — Front & Back",
    emoji: "🪪",
    type: "upload",
    optional: false,
    description:
      "Required for A2P texting compliance: it registers your business phone number to YOUR business — your number, fully verified, never ours.",
  },
};

/**
 * Fresh task state. Also used to backfill task keys onto onboardings created
 * before a task existed (jsonb_set can't create intermediate path elements,
 * so writers must set the whole object when the key is missing).
 */
export function defaultTaskState(taskId: TaskId): OnboardingTaskState {
  return {
    status: "todo",
    submittedAt: null,
    reviewedAt: null,
    adminNote: null,
    submission:
      taskId === "drivers_license" ? { files: { front: null, back: null } } : null,
  };
}

export function defaultOnboardingState(
  startedBy: "auto_sign" | "admin",
  tier: OnboardingTier = "drs"
): OnboardingState {
  const now = new Date().toISOString();
  const phase = (): OnboardingPhaseState => ({
    status: "pending",
    targetDate: null,
    startedAt: null,
    completedAt: null,
    note: null,
  });
  return {
    version: 1,
    startedAt: now,
    startedBy,
    targetLaunchDate: null,
    clientDueAt: addDaysToDateOnly(now.slice(0, 10), CLIENT_ITEMS_DUE_DAYS),
    campaignLaunchedAt: null,
    dueRemindersSent: [],
    overdueNotifiedAt: null,
    phases: Object.fromEntries(TIER_PHASES[tier].map((id) => [id, phase()])) as OnboardingState["phases"],
    tasks: Object.fromEntries(
      TIER_TASKS[tier].map((id) => [id, defaultTaskState(id)])
    ) as OnboardingState["tasks"],
    activity: [
      {
        at: now,
        actor: "system",
        type: "started",
        message: "Kickoff! Your build has officially started 🚀",
      },
    ],
  };
}

// ── Atomic jsonb writes ───────────────────────────────────

function getRows(result: unknown): Record<string, unknown>[] {
  // drizzle's neon-http execute returns { rows: [...] }; be defensive.
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: Record<string, unknown>[] })?.rows;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Create the onboarding state exactly once. The WHERE guard makes concurrent
 * calls (multiple signers finishing, admin double-click) a no-op, and
 * jsonb_set on the "onboarding" key preserves existing pricing metadata.
 * Returns true if this call created it.
 */
export async function initOnboarding(
  engagementId: string,
  startedBy: "auto_sign" | "admin",
  tier: OnboardingTier = "drs"
): Promise<boolean> {
  const state = defaultOnboardingState(startedBy, tier);
  const result = await db.execute(sql`
    UPDATE engagements
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{onboarding}', ${JSON.stringify(state)}::jsonb),
        updated_at = now()
    WHERE id = ${engagementId}
      AND (metadata IS NULL OR metadata->'onboarding' IS NULL)
    RETURNING id
  `);
  return getRows(result).length > 0;
}

function toPathLiteral(segments: string[]): string {
  if (!segments.length || segments.some((s) => !/^[a-zA-Z_]+$/.test(s))) {
    throw new Error(`Invalid onboarding path: ${segments.join(".")}`);
  }
  return `{onboarding,${segments.join(",")}}`;
}

/**
 * Atomically set one or more values under metadata.onboarding.<segments> in a
 * single UPDATE (nested jsonb_set — one DB round trip). Segments must come
 * from code-level whitelists — enforced by regex here as a backstop; never
 * pass raw request input. Optionally returns the value at returningSegments
 * as read back in the same statement.
 */
export async function setOnboardingValues(
  engagementId: string,
  entries: { segments: string[]; value: unknown }[],
  returningSegments?: string[]
): Promise<unknown> {
  if (!entries.length) return null;
  let expr = sql`metadata`;
  for (const { segments, value } of entries) {
    expr = sql`jsonb_set(${expr}, ${toPathLiteral(segments)}::text[], ${JSON.stringify(value)}::jsonb, true)`;
  }
  const returning = returningSegments
    ? sql` RETURNING metadata#>${toPathLiteral(returningSegments)}::text[] AS value`
    : sql``;
  const result = await db.execute(sql`
    UPDATE engagements
    SET metadata = ${expr},
        updated_at = now()
    WHERE id = ${engagementId}
      AND metadata->'onboarding' IS NOT NULL${returning}
  `);
  return returningSegments ? getRows(result)[0]?.value ?? null : null;
}


export async function appendActivity(
  engagementId: string,
  entry: Omit<OnboardingActivityEntry, "at">
): Promise<void> {
  const full: OnboardingActivityEntry = {
    at: new Date().toISOString(),
    ...entry,
  };
  await db.execute(sql`
    UPDATE engagements
    SET metadata = jsonb_set(
          metadata,
          '{onboarding,activity}',
          COALESCE(metadata#>'{onboarding,activity}', '[]'::jsonb) || ${JSON.stringify(full)}::jsonb,
          true
        ),
        updated_at = now()
    WHERE id = ${engagementId}
      AND metadata->'onboarding' IS NOT NULL
  `);
}

// ── Lookup ────────────────────────────────────────────────

export async function getOnboardingBySignerToken(token: string) {
  const [signer] = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.token, token))
    .limit(1);

  // Order 0 is the sender's own (auto-signed) token — not a client link.
  if (!signer || signer.order === 0 || signer.status === "declined") {
    return null;
  }

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, signer.engagementId))
    .limit(1);
  if (!engagement) return null;

  const [owner] = await db
    .select({ name: users.name, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, engagement.ownerId))
    .limit(1);

  // NOTE: engagement.expiresAt is deliberately ignored here — it's the
  // signing-window expiry for the letter; onboarding links must keep
  // working long after that.
  const metadata = (engagement.metadata || {}) as Record<string, unknown>;
  const onboarding = (metadata.onboarding as OnboardingState | undefined) || null;

  return { signer, engagement, owner: owner || null, onboarding };
}

/** Read the current onboarding state for an engagement (null if not started). */
export async function getOnboardingState(
  engagementId: string
): Promise<OnboardingState | null> {
  const [row] = await db
    .select({ metadata: engagements.metadata })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  const metadata = (row?.metadata || {}) as Record<string, unknown>;
  return (metadata.onboarding as OnboardingState | undefined) || null;
}

// ── Progress ──────────────────────────────────────────────

export function computeProgress(state: OnboardingState): number {
  let earned = 0;
  let total = 0;
  for (const id of phaseIdsFor(state)) {
    const p = state.phases[id];
    total += 2;
    if (p?.status === "in_progress") earned += 1;
    if (p?.status === "done") earned += 2;
  }
  for (const id of taskIdsFor(state)) {
    const t = state.tasks[id];
    const optional = TASK_INFO[id].optional;
    // needs_attention was sent back to the client — not complete
    const counted = t?.status === "submitted" || t?.status === "approved";
    const touched = t && t.status !== "todo";
    if (optional && !touched) continue; // untouched optional tasks don't count
    total += 1;
    if (counted) earned += 1;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

// ── Client due date ───────────────────────────────────────

/**
 * Tasks the client still owes. Mirrors computeProgress: a task is done once
 * submitted or approved; optional tasks the client never touched are not
 * owed (but an optional task sent back as needs_attention is).
 */
export function clientItemsOutstanding(state: OnboardingState): TaskId[] {
  return taskIdsFor(state).filter((id) => {
    const t = state.tasks[id];
    const done = t?.status === "submitted" || t?.status === "approved";
    if (done) return false;
    const touched = t && t.status !== "todo";
    if (TASK_INFO[id].optional && !touched) return false;
    return true;
  });
}

export function clientItemsComplete(state: OnboardingState): boolean {
  return clientItemsOutstanding(state).length === 0;
}

/**
 * Whole days until clientDueAt (UTC calendar days): 0 = due today, negative
 * = overdue. Null when the state has no deadline (legacy records).
 */
export function daysUntilDue(
  state: OnboardingState,
  now: Date = new Date()
): number | null {
  const due = state.clientDueAt;
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const dueMs = Date.parse(`${due}T00:00:00Z`);
  const todayMs = Date.parse(`${toDateOnly(now)}T00:00:00Z`);
  if (Number.isNaN(dueMs) || Number.isNaN(todayMs)) return null;
  return Math.round((dueMs - todayMs) / 86_400_000);
}

/** Past the deadline with items still owed. */
export function isClientOverdue(
  state: OnboardingState,
  now: Date = new Date()
): boolean {
  const days = daysUntilDue(state, now);
  return days !== null && days < 0 && !clientItemsComplete(state);
}

// ── Serializers ───────────────────────────────────────────

const ACTIVITY_LIMIT = 50;

/**
 * Public (client-facing) shape — THE security boundary. Credential
 * submissions are never echoed; uploads expose file names only (no storage
 * paths or URLs). Confirm-type submissions are not sensitive and pass
 * through so the UI can distinguish "sent" from "not applicable".
 */
export function serializePublicOnboarding(state: OnboardingState) {
  return {
    startedAt: state.startedAt,
    targetLaunchDate: state.targetLaunchDate,
    clientDueAt: state.clientDueAt ?? null,
    campaignLaunchedAt: state.campaignLaunchedAt ?? null,
    daysUntilDue: daysUntilDue(state),
    isOverdue: isClientOverdue(state),
    clientItemsComplete: clientItemsComplete(state),
    progressPercent: computeProgress(state),
    phases: phaseIdsFor(state).map((id) => {
      const p = state.phases[id];
      return {
        id,
        ...PHASE_INFO[id],
        status: p?.status ?? "pending",
        targetDate: p?.targetDate ?? null,
        startedAt: p?.startedAt ?? null,
        completedAt: p?.completedAt ?? null,
        note: p?.note ?? null,
      };
    }),
    tasks: taskIdsFor(state).map((id) => {
      const t = state.tasks[id];
      const info = TASK_INFO[id];
      const base = {
        id,
        title: info.title,
        description: info.description,
        emoji: info.emoji,
        type: info.type,
        optional: info.optional,
        status: t?.status ?? "todo",
        submittedAt: t?.submittedAt ?? null,
        adminNote: t?.adminNote ?? null,
      };
      if (info.type === "upload") {
        const files = (t?.submission as {
          files?: Record<string, LicenseFileMeta | null>;
        } | null)?.files;
        return {
          ...base,
          files: {
            front: files?.front
              ? { fileName: files.front.fileName, uploadedAt: files.front.uploadedAt }
              : null,
            back: files?.back
              ? { fileName: files.back.fileName, uploadedAt: files.back.uploadedAt }
              : null,
          },
        };
      }
      if (info.type === "confirm" || info.type === "form") {
        // Not sensitive — pass through so the client sees their saved answers.
        return { ...base, submission: t?.submission ?? null };
      }
      return base; // credentials: status only, never the submission
    }),
    activity: (state.activity || []).slice(-ACTIVITY_LIMIT),
  };
}

/** Admin shape — full state with credential submissions decrypted. */
export function serializeAdminOnboarding(state: OnboardingState) {
  return {
    ...serializePublicOnboarding(state),
    startedBy: state.startedBy,
    tasks: taskIdsFor(state).map((id) => {
      const t = state.tasks[id];
      const info = TASK_INFO[id];
      return {
        id,
        title: info.title,
        emoji: info.emoji,
        type: info.type,
        optional: info.optional,
        status: t?.status ?? "todo",
        submittedAt: t?.submittedAt ?? null,
        reviewedAt: t?.reviewedAt ?? null,
        adminNote: t?.adminNote ?? null,
        submission:
          info.type === "credentials"
            ? decryptSubmission(t?.submission)
            : t?.submission ?? null,
      };
    }),
  };
}
