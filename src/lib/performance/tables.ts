import { db } from "@/db";
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ExtraLine, StatementLine, StatementTotals } from "./match";

/**
 * Performance Pay (Nov 19 2026 pricing) — what the portal keeps so a month's
 * statement can be worked out from its own data and shown with its proof.
 * Created lazily (no migration pipeline in this repo).
 */

/**
 * A contact that came into a client firm's CRM from an ad Nexli runs, saved
 * with how it came in. GoHighLevel only holds this live; a statement needs
 * it on record, unchanged, for as long as the client pays.
 */
export const performanceLeads = pgTable("performance_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The client firm (users.id). */
  firmUserId: uuid("firm_user_id").notNull(),
  ghlContactId: text("ghl_contact_id").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  /** When the contact was added in the firm's CRM. */
  firstSeenAt: timestamp("first_seen_at").notNull(),
  /** facebook | instagram | other | unknown */
  platform: text("platform"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  landingUrl: text("landing_url"),
  booked: boolean("booked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Marcel's own call on one paying client of a firm: this is that lead, or leave them out. It sticks for later months. */
export const performanceClientRules = pgTable("performance_client_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmUserId: uuid("firm_user_id").notNull(),
  /** The payer's email on the firm's invoices, lowercased. */
  email: text("email").notNull(),
  /** include | exclude */
  rule: text("rule").notNull(),
  /** include: the performance_leads row this payer is. */
  leadId: uuid("lead_id"),
  reason: text("reason"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** The frozen statement: exactly what the client was sent. */
export interface StatementSnapshot {
  periodLabel: string;
  totals: StatementTotals;
  lines: StatementLine[];
  extras: ExtraLine[];
  /** meta | weekly_updates | manual | none */
  adSpendSource: string;
}

/**
 * One billing month of one engagement. A draft is worked out live each time
 * it is opened (so a late payment or a new link shows up); only Marcel's own
 * inputs are stored on it. Sending freezes it into `snapshot`.
 */
export const performanceStatements = pgTable("performance_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  engagementId: uuid("engagement_id").notNull(),
  firmUserId: uuid("firm_user_id").notNull(),
  /** 1 = the Month that begins at signing (lib/performance/periods.ts). */
  monthIndex: integer("month_index").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  /** draft | sent | none_due */
  status: text("status").notNull().default("draft"),
  /** Marcel's own ad spend figure for the month (cents); null = read it from Meta / the weekly updates. */
  adSpendOverrideCents: integer("ad_spend_override_cents"),
  /** Payments he added by hand (money collected outside the portal, or a correction). */
  extras: jsonb("extras").$type<ExtraLine[]>().notNull().default([]),
  snapshot: jsonb("snapshot").$type<StatementSnapshot>(),
  /** The Performance Pay invoice (sent statements with something due). */
  invoiceId: uuid("invoice_id"),
  /** When Marcel was told this month is ready to review. */
  notifiedAt: timestamp("notified_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

let ensured: Promise<void> | null = null;

/** Lazy DDL; memoised per instance, retried on failure. Keep in step with the tables above. */
export function ensurePerformanceTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "performance_leads" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "firm_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "ghl_contact_id" text NOT NULL,
          "name" text,
          "email" text,
          "phone" text,
          "first_seen_at" timestamp NOT NULL,
          "platform" text,
          "utm_source" text,
          "utm_campaign" text,
          "utm_content" text,
          "landing_url" text,
          "booked" boolean NOT NULL DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "performance_leads_firm_contact_idx" ON "performance_leads" ("firm_user_id", "ghl_contact_id")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "performance_client_rules" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "firm_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "email" text NOT NULL,
          "rule" text NOT NULL,
          "lead_id" uuid,
          "reason" text,
          "created_by" uuid,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "performance_client_rules_firm_email_idx" ON "performance_client_rules" ("firm_user_id", "email")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "performance_statements" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
          "firm_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "month_index" integer NOT NULL,
          "period_start" timestamp NOT NULL,
          "period_end" timestamp NOT NULL,
          "status" text NOT NULL DEFAULT 'draft',
          "ad_spend_override_cents" integer,
          "extras" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "snapshot" jsonb,
          "invoice_id" uuid,
          "notified_at" timestamp,
          "sent_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "performance_statements_engagement_month_idx" ON "performance_statements" ("engagement_id", "month_index")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "performance_statements_firm_idx" ON "performance_statements" ("firm_user_id", "status")`
      );
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
