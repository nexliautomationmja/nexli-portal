import { db } from "@/db";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Money received in Nexli's Mercury account, as read by the Mercury sync
 * (lib/mercury.ts). One row per incoming Mercury transaction, so every credit
 * is looked at exactly once: matched to an invoice, left for Marcel to
 * review, or ignored (Stripe payouts, transfers between his own accounts…).
 */
export const mercuryTransactions = pgTable("mercury_transactions", {
  /** Mercury's transaction id. */
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  kind: text("kind"),
  status: text("status").notNull(),
  counterpartyName: text("counterparty_name"),
  externalMemo: text("external_memo"),
  bankDescription: text("bank_description"),
  postedAt: timestamp("posted_at"),
  /** The invoice it paid (matched), or null. */
  invoiceId: uuid("invoice_id"),
  /** matched | review | ignored (applying: briefly, while a payment is being applied) */
  matchStatus: text("match_status").notNull(),
  /** auto | admin */
  matchedBy: text("matched_by"),
  /** Invoices it might be paying, best first (review). */
  suggestedInvoiceIds: jsonb("suggested_invoice_ids").$type<string[]>(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One row (id 1): when the sync last ran, and the receiving account last seen. */
export const mercurySync = pgTable("mercury_sync", {
  id: integer("id").primaryKey(),
  lastRunAt: timestamp("last_run_at"),
  lastOkAt: timestamp("last_ok_at"),
  lastError: text("last_error"),
  creditsSeen: integer("credits_seen"),
  /** Last known receiving account, so the pay page still shows it if Mercury's API is down. */
  account: jsonb("account").$type<{
    id: string;
    name: string;
    legalBusinessName: string;
    accountNumber: string;
    routingNumber: string;
  }>(),
});

let ensured: Promise<void> | null = null;

/** Lazy DDL (no migration pipeline in this repo); memoised per instance, retried on failure. */
export function ensureMercuryTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "mercury_transactions" (
          "id" text PRIMARY KEY,
          "account_id" text NOT NULL,
          "amount_cents" integer NOT NULL,
          "kind" text,
          "status" text NOT NULL,
          "counterparty_name" text,
          "external_memo" text,
          "bank_description" text,
          "posted_at" timestamp,
          "invoice_id" uuid,
          "match_status" text NOT NULL,
          "matched_by" text,
          "suggested_invoice_ids" jsonb,
          "reason" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "mercury_transactions_match_idx" ON "mercury_transactions" ("match_status")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "mercury_sync" (
          "id" integer PRIMARY KEY,
          "last_run_at" timestamp,
          "last_ok_at" timestamp,
          "last_error" text,
          "credits_seen" integer,
          "account" jsonb
        )
      `);
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
