import { db } from "@/db";
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/db/schema";
import type { ManusActivitySnapshot, PhotoAdWaiting } from "@/lib/creative-studio/tables";

/**
 * The Ads tab's tables (runtime DDL — there's no migration pipeline):
 * goals/settings per ad account, Manus analyses, and the next steps each
 * analysis produced (a checklist Marcel works through). `account_id` is the
 * Meta ad account (no act_ prefix) so client firms' accounts can come later.
 */

export const adSettings = pgTable(
  "ad_settings",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    targetCpbCents: integer("target_cpb_cents"),
    targetCplCents: integer("target_cpl_cents"),
    monthlyBudgetCents: integer("monthly_budget_cents"),
    maxCacCents: integer("max_cac_cents"),
    /** Notes for Manus ("new landing page Nov 5"). */
    context: text("context").notNull().default(""),
    weeklyAuto: boolean("weekly_auto").notNull().default(true),
    agentProfile: text("agent_profile").notNull().default("standard"),
    notifyEmail: boolean("notify_email").notNull().default(true),
    studioKey: text("studio_key").notNull().default("nexli"),
    lastWeeklyKey: text("last_weekly_key"),
    manusConnector: jsonb("manus_connector").$type<{ id: string | null; name: string | null; checkedAt: string } | null>(),
    /** An Ad Library connector installed in Manus (for research), checked daily. */
    libraryConnector: jsonb("library_connector").$type<{ id: string | null; name: string | null; checkedAt: string } | null>(),
    /** Competitors Ad Library research always checks (one per line: name, page or library link). */
    competitors: text("competitors").notNull().default(""),
    lastCronAt: timestamp("last_cron_at"),
    lastCronError: text("last_cron_error"),
    /** 1 = the daily-plan rules' one-time defaults ($300 per booked call) were applied. */
    rulesVersion: integer("rules_version"),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.accountId] })]
);

export type AnalysisStatus = "queued" | "building" | "starting" | "running" | "waiting" | "saving" | "done" | "failed" | "stopped";
/** What a Manus run does: the account analysis, or Ad Library research. */
export type RunKind = "analysis" | "research";
export const ACTIVE_ANALYSIS: AnalysisStatus[] = ["queued", "building", "starting", "running", "waiting", "saving"];

export const adAnalyses = pgTable("ad_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  kind: text("kind").$type<RunKind>().notNull().default("analysis"),
  /** weekly | manual */
  trigger: text("trigger").notNull(),
  weekKey: text("week_key"),
  status: text("status").$type<AnalysisStatus>().notNull().default("queued"),
  throughDate: text("through_date"),
  timezone: text("timezone"),
  agentProfile: text("agent_profile").notNull().default("standard"),
  playbookVersion: text("playbook_version"),
  schemaVersion: text("schema_version"),
  /** What Manus was sent (kept 12 weeks). */
  dataPack: jsonb("data_pack"),
  /** Headline numbers + every live entity's status/budget/metrics then (history, verification). */
  snapshotSummary: jsonb("snapshot_summary"),
  manusTaskId: text("manus_task_id"),
  taskUrl: text("task_url"),
  connectors: jsonb("connectors").$type<string[] | null>(),
  activity: jsonb("activity").$type<ManusActivitySnapshot | null>(),
  waiting: jsonb("waiting").$type<PhotoAdWaiting | null>(),
  answeredKey: text("answered_key"),
  autoReplies: integer("auto_replies").notNull().default(0),
  stoppedAt: timestamp("stopped_at"),
  result: jsonb("result"),
  reportMd: text("report_md"),
  verdict: text("verdict"),
  healthScore: integer("health_score"),
  headline: text("headline"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  startedBy: uuid("started_by"),
  notifiedAt: timestamp("notified_at"),
  waitingNotifiedKey: text("waiting_notified_key"),
  seenAt: timestamp("seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

export type StepStatus = "open" | "done" | "skipped" | "superseded";

export const adSteps = pgTable("ad_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => adAnalyses.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull(),
  accountId: text("account_id").notNull(),
  idx: integer("idx").notNull(),
  stepKey: text("step_key").notNull(),
  carriedFrom: uuid("carried_from"),
  firstSuggestedAt: timestamp("first_suggested_at").notNull().defaultNow(),
  kind: text("kind").notNull(),
  priority: text("priority").notNull(),
  title: text("title").notNull(),
  why: text("why").notNull().default(""),
  how: text("how").notNull().default(""),
  targets: jsonb("targets").$type<unknown[]>().notNull().default([]),
  evidence: jsonb("evidence").$type<unknown[]>().notNull().default([]),
  waitDays: integer("wait_days"),
  checkBackAt: timestamp("check_back_at"),
  checkedAt: timestamp("checked_at"),
  remindSentAt: timestamp("remind_sent_at"),
  successCheck: jsonb("success_check"),
  creativeRefresh: jsonb("creative_refresh"),
  budgetChange: jsonb("budget_change"),
  expectedImpact: text("expected_impact").notNull().default(""),
  confidence: text("confidence").notNull().default("medium"),
  effort: text("effort"),
  risk: text("risk"),
  baseline: jsonb("baseline"),
  status: text("status").$type<StepStatus>().notNull().default("open"),
  doneAt: timestamp("done_at"),
  doneBy: uuid("done_by"),
  skippedReason: text("skipped_reason"),
  note: text("note"),
  selfOutcome: text("self_outcome"),
  manusOutcome: text("manus_outcome"),
  manusOutcomeNote: text("manus_outcome_note"),
  handoff: jsonb("handoff"),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * The daily plan (one per ad account per day, made each morning): the Cut /
 * Keep calls then, what to make, the tracking verdict, and whether it needs
 * Marcel (email + badge only then).
 */
export const adDailyPlans = pgTable("ad_daily_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  /** The account-local day it's for (YYYY-MM-DD). */
  planDate: text("plan_date").notNull(),
  status: text("status").$type<"making" | "done" | "failed">().notNull().default("making"),
  throughDate: text("through_date"),
  plan: jsonb("plan"),
  make: jsonb("make"),
  tracking: jsonb("tracking"),
  /** The VSL scoreboard's one-line verdict that morning (VslHeadline). */
  vsl: jsonb("vsl"),
  actionable: boolean("actionable").notNull().default(false),
  error: text("error"),
  emailedAt: timestamp("emailed_at"),
  seenAt: timestamp("seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** What each creative is (format, angle, hook), read once by Claude and kept until the creative changes. */
export const adCreativeTags = pgTable(
  "ad_creative_tags",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    adId: text("ad_id").notNull(),
    /** Hash of what the tags were read from (name, copy, media type). */
    key: text("key").notNull(),
    tags: jsonb("tags").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.accountId, t.adId] })]
);

/**
 * "Create new creatives": each set of video ideas Claude came up with (backed
 * by Marcel's results and the Ad Library research), the Creative Studio
 * videos made from them, and which of those went live — the "on deck" list.
 */
export const adCreativeIdeas = pgTable("ad_creative_ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  count: integer("count").notNull(),
  note: text("note").notNull().default(""),
  ideas: jsonb("ideas").notNull(),
  /** What the ideas were backed by (summary lines for the page). */
  backing: jsonb("backing"),
  batchId: uuid("batch_id"),
  /** Creative Studio project per idea (index-aligned; null = not made). */
  projectIds: jsonb("project_ids").$type<(string | null)[]>().notNull().default([]),
  /** projectId → when Marcel marked it live in Meta. */
  live: jsonb("live").$type<Record<string, string>>().notNull().default({}),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Changes Claude proposed in the Ask chat (and Marcel applied, dismissed or
 * undid): a lead or booked call that didn't really happen, Marcel's own Cut /
 * Keep call on a creative, or new goals. Only "applied" rows count anywhere.
 */
export type AdChangeKind = "lead_not_real" | "booking_not_real" | "call_override" | "goals";
export type AdChangeStatus = "proposed" | "applied" | "dismissed" | "undone";

export const adChanges = pgTable("ad_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  chatId: uuid("chat_id"),
  kind: text("kind").$type<AdChangeKind>().notNull(),
  adId: text("ad_id"),
  payload: jsonb("payload").notNull(),
  summary: text("summary").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").$type<AdChangeStatus>().notNull().default("proposed"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  appliedAt: timestamp("applied_at"),
  appliedBy: uuid("applied_by"),
  undoneAt: timestamp("undone_at"),
});

/** The Ask chat: the model's history (append-only, as returned) and what the page shows. */
export const adChats = pgTable("ad_chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  messages: jsonb("messages").notNull().default([]),
  display: jsonb("display").notNull().default([]),
  /** Hash of the last account brief sent (sent again only when it changes). */
  briefHash: text("brief_hash"),
  version: integer("version").notNull().default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

let ensured: Promise<void> | null = null;

export function ensureAdsTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_settings" (
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "target_cpb_cents" integer,
          "target_cpl_cents" integer,
          "monthly_budget_cents" integer,
          "max_cac_cents" integer,
          "context" text NOT NULL DEFAULT '',
          "weekly_auto" boolean NOT NULL DEFAULT true,
          "agent_profile" text NOT NULL DEFAULT 'standard',
          "notify_email" boolean NOT NULL DEFAULT true,
          "studio_key" text NOT NULL DEFAULT 'nexli',
          "last_weekly_key" text,
          "manus_connector" jsonb,
          "last_cron_at" timestamp,
          "last_cron_error" text,
          "updated_by" uuid,
          "updated_at" timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY ("owner_id", "account_id")
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_analyses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "kind" text NOT NULL DEFAULT 'analysis',
          "trigger" text NOT NULL,
          "week_key" text,
          "status" text NOT NULL DEFAULT 'queued',
          "through_date" text,
          "timezone" text,
          "agent_profile" text NOT NULL DEFAULT 'standard',
          "playbook_version" text,
          "schema_version" text,
          "data_pack" jsonb,
          "snapshot_summary" jsonb,
          "manus_task_id" text,
          "task_url" text,
          "connectors" jsonb,
          "activity" jsonb,
          "waiting" jsonb,
          "answered_key" text,
          "auto_replies" integer NOT NULL DEFAULT 0,
          "stopped_at" timestamp,
          "result" jsonb,
          "report_md" text,
          "verdict" text,
          "health_score" integer,
          "headline" text,
          "error" text,
          "attempts" integer NOT NULL DEFAULT 0,
          "started_by" uuid,
          "notified_at" timestamp,
          "waiting_notified_key" text,
          "seen_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now(),
          "started_at" timestamp,
          "finished_at" timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_analyses_owner_idx" ON "ad_analyses" ("owner_id", "account_id", "created_at" DESC)`);
      // Nov 2026: runs have a kind (analysis | research). One run in flight per kind;
      // weekly keys per kind. New indexes first (the old, stricter ones guarantee no
      // duplicates), then drop the old ones — logged, never fatal.
      await db.execute(sql`ALTER TABLE "ad_analyses" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'analysis'`);
      for (const stmt of [
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "ad_analyses_week_kind_uq" ON "ad_analyses" ("owner_id", "account_id", "kind", "week_key") WHERE "week_key" IS NOT NULL`,
        sql`DROP INDEX IF EXISTS "ad_analyses_week_uq"`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "ad_analyses_active_kind_uq" ON "ad_analyses" ("owner_id", "account_id", "kind") WHERE "status" IN ('queued','building','starting','running','waiting','saving')`,
        sql`DROP INDEX IF EXISTS "ad_analyses_one_active"`,
      ]) {
        await db.execute(stmt).catch((err) => console.error("[ads] index update failed (continuing):", err instanceof Error ? err.message : err));
      }
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_steps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "analysis_id" uuid NOT NULL REFERENCES "ad_analyses"("id") ON DELETE CASCADE,
          "owner_id" uuid NOT NULL,
          "account_id" text NOT NULL,
          "idx" integer NOT NULL,
          "step_key" text NOT NULL,
          "carried_from" uuid,
          "first_suggested_at" timestamp NOT NULL DEFAULT now(),
          "kind" text NOT NULL,
          "priority" text NOT NULL,
          "title" text NOT NULL,
          "why" text NOT NULL DEFAULT '',
          "how" text NOT NULL DEFAULT '',
          "targets" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "wait_days" integer,
          "check_back_at" timestamp,
          "checked_at" timestamp,
          "remind_sent_at" timestamp,
          "success_check" jsonb,
          "creative_refresh" jsonb,
          "budget_change" jsonb,
          "expected_impact" text NOT NULL DEFAULT '',
          "confidence" text NOT NULL DEFAULT 'medium',
          "effort" text,
          "risk" text,
          "baseline" jsonb,
          "status" text NOT NULL DEFAULT 'open',
          "done_at" timestamp,
          "done_by" uuid,
          "skipped_reason" text,
          "note" text,
          "self_outcome" text,
          "manus_outcome" text,
          "manus_outcome_note" text,
          "handoff" jsonb,
          "superseded_by" uuid,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`ALTER TABLE "ad_settings" ADD COLUMN IF NOT EXISTS "competitors" text NOT NULL DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "ad_settings" ADD COLUMN IF NOT EXISTS "library_connector" jsonb`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_steps_analysis_idx" ON "ad_steps" ("analysis_id", "idx")`);
      // Nov 15 2026: the daily plan + creative tags, and the plan rules' one-time default
      // target ($300 per booked call, Marcel's pick) — applied once per account, then Goals owns it.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_daily_plans" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "plan_date" text NOT NULL,
          "status" text NOT NULL DEFAULT 'making',
          "through_date" text,
          "plan" jsonb,
          "make" jsonb,
          "tracking" jsonb,
          "actionable" boolean NOT NULL DEFAULT false,
          "error" text,
          "emailed_at" timestamp,
          "seen_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "ad_daily_plans_day_uq" ON "ad_daily_plans" ("owner_id", "account_id", "plan_date")`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_creative_tags" (
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "ad_id" text NOT NULL,
          "key" text NOT NULL,
          "tags" jsonb NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY ("owner_id", "account_id", "ad_id")
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_creative_ideas" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "count" integer NOT NULL,
          "note" text NOT NULL DEFAULT '',
          "ideas" jsonb NOT NULL,
          "backing" jsonb,
          "batch_id" uuid,
          "project_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "live" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "created_by" uuid,
          "created_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_creative_ideas_owner_idx" ON "ad_creative_ideas" ("owner_id", "account_id", "created_at" DESC)`);
      await db.execute(sql`ALTER TABLE "ad_settings" ADD COLUMN IF NOT EXISTS "rules_version" integer`);
      await db.execute(sql`UPDATE "ad_settings" SET "target_cpb_cents" = 30000, "rules_version" = 1 WHERE "rules_version" IS NULL`);
      await db.execute(sql`ALTER TABLE "ad_settings" ALTER COLUMN "rules_version" SET DEFAULT 1`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_steps_owner_status_idx" ON "ad_steps" ("owner_id", "account_id", "status")`);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "ad_steps_check_back_idx" ON "ad_steps" ("check_back_at") WHERE "checked_at" IS NULL AND "status" IN ('open','done')`
      );
      // Nov 17 2026: the Ask chat and the changes it proposes.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_changes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "chat_id" uuid,
          "kind" text NOT NULL,
          "ad_id" text,
          "payload" jsonb NOT NULL,
          "summary" text NOT NULL,
          "reason" text NOT NULL DEFAULT '',
          "status" text NOT NULL DEFAULT 'proposed',
          "created_by" uuid,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "applied_at" timestamp,
          "applied_by" uuid,
          "undone_at" timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_changes_owner_idx" ON "ad_changes" ("owner_id", "account_id", "status")`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ad_chats" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "account_id" text NOT NULL,
          "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "display" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "brief_hash" text,
          "version" integer NOT NULL DEFAULT 0,
          "created_by" uuid,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ad_chats_owner_idx" ON "ad_chats" ("owner_id", "account_id", "updated_at" DESC)`);
      // Nov 17 2026: the VSL scoreboard's line in the morning plan.
      await db.execute(sql`ALTER TABLE "ad_daily_plans" ADD COLUMN IF NOT EXISTS "vsl" jsonb`);
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
