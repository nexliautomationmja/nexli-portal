/**
 * `site_previews` — Firm Foundation "see your new website" previews.
 * OWNED BY THE MARKETING APP (repo root: lib/site-previews-schema.ts;
 * migration: scripts/add-site-previews.sql). This is a READ-ONLY mirror so
 * provisioning can import a pre-purchase preview into `firm_sites`.
 *
 * NEVER include this file in drizzle-kit (drizzle.config.ts excludes the
 * table via tablesFilter) and never write to it from the portal. Keep the
 * column list in sync with the marketing app's copy.
 */
import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import type { FirmSiteConfig } from "@/lib/firm-sites/types";

export type SitePreviewStatus = "pending" | "generating" | "ready" | "failed";
export type SitePreviewTheme = "dark" | "light";

/** Raw facts pulled from the prospect's current website. */
export interface ExtractedSiteFacts {
  url: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  ogImage?: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeColor?: string;
  colors?: string[];
  phone?: string;
  email?: string;
  address?: string;
  headings?: string[];
  navLinks?: string[];
  text?: string;
  fetchedAt: string;
}

export const sitePreviews = pgTable(
  "site_previews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull().unique(),
    leadId: uuid("lead_id"),
    sourceUrl: text("source_url"),
    status: text("status").$type<SitePreviewStatus>().notNull().default("pending"),
    config: jsonb("config").$type<FirmSiteConfig>(),
    theme: text("theme").$type<SitePreviewTheme>().notNull().default("dark"),
    extracted: jsonb("extracted").$type<ExtractedSiteFacts>(),
    generatedBy: text("generated_by"), // 'claude' | 'template'
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("site_previews_lead_idx").on(table.leadId),
    index("site_previews_status_idx").on(table.status),
  ]
);

export type SitePreviewRow = typeof sitePreviews.$inferSelect;
