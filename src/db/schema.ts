import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "client"]);

export const brandFileCategoryEnum = pgEnum("brand_file_category", [
  "logo",
  "brand_guideline",
  "photo",
  "design_file",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "unpaid",
]);

// ── Users ──────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    hashedPassword: text("hashed_password").notNull(),
    role: userRoleEnum("role").default("client").notNull(),
    companyName: text("company_name"),

    // External system links
    stripeCustomerId: text("stripe_customer_id").unique(),
    ghlContactId: text("ghl_contact_id"),
    ghlLocationId: text("ghl_location_id"),

    // Vercel Analytics identifiers (per-client website)
    vercelProjectId: text("vercel_project_id"),
    vercelTeamId: text("vercel_team_id"),

    websiteUrl: text("website_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_stripe_idx").on(table.stripeCustomerId),
  ]
);

// ── Sessions ───────────────────────────────────────────
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.sessionToken),
    index("sessions_user_idx").on(table.userId),
  ]
);

// ── Subscriptions ──────────────────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripePriceId: text("stripe_price_id").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_user_idx").on(table.userId),
    uniqueIndex("subscriptions_stripe_idx").on(table.stripeSubscriptionId),
  ]
);

// ── Analytics Snapshots ────────────────────────────────
// Caches periodic data from Vercel Analytics & GoHighLevel
// so the dashboard doesn't hit external APIs on every page load
export const analyticsSnapshots = pgTable(
  "analytics_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'vercel' | 'gohighlevel'
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    data: jsonb("data").notNull(), // Flexible JSON for different metric shapes
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_user_period_idx").on(
      table.userId,
      table.source,
      table.periodStart
    ),
  ]
);

// ── Page Views (raw tracking events) ─────────────────
export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    country: text("country"),
    deviceType: text("device_type"), // 'desktop' | 'mobile' | 'tablet'
    sessionId: text("session_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("page_views_client_idx").on(table.clientId),
    index("page_views_client_date_idx").on(table.clientId, table.createdAt),
    index("page_views_session_idx").on(table.sessionId),
  ]
);

// ── Daily Stats (pre-aggregated) ─────────────────────
export const dailyStats = pgTable(
  "daily_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    pageViewsCount: integer("page_views_count").default(0).notNull(),
    uniqueVisitorsCount: integer("unique_visitors_count").default(0).notNull(),
    topPages: jsonb("top_pages"), // Array<{ url: string; count: number }>
    topReferrers: jsonb("top_referrers"), // Array<{ referrer: string; count: number }>
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_stats_client_date_idx").on(table.clientId, table.date),
    uniqueIndex("daily_stats_unique_idx").on(table.clientId, table.date),
  ]
);

// ── Lead Notifications ─────────────────────────────────
export const leadNotifications = pgTable(
  "lead_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadName: text("lead_name"),
    leadEmail: text("lead_email"),
    leadPhone: text("lead_phone"),
    source: text("source"), // 'website_form', 'ghl_workflow', etc.
    notifiedAt: timestamp("notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("lead_notifications_user_idx").on(table.userId),
  ]
);

// ── Brand Files ─────────────────────────────────────────
export const brandFiles = pgTable(
  "brand_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    category: brandFileCategoryEnum("category").notNull(),
    storagePath: text("storage_path").notNull(),
    storageUrl: text("storage_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("brand_files_client_idx").on(table.clientId),
    index("brand_files_client_category_idx").on(table.clientId, table.category),
  ]
);
