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
  real,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "client"]);

export const brandFileCategoryEnum = pgEnum("brand_file_category", [
  "logo",
  "brand_guideline",
  "photo",
  "design_file",
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

// ── Marketing Video Status ──────────────────────────────
export const videoStatusEnum = pgEnum("video_status", [
  "draft",
  "generating",
  "completed",
  "failed",
]);

// ── Marketing Videos ────────────────────────────────────
export const marketingVideos = pgTable(
  "marketing_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    script: text("script").notNull(),
    visualPrompt: text("visual_prompt"),
    avatarStoragePath: text("avatar_storage_path"),
    avatarUrl: text("avatar_url"),
    audioStoragePath: text("audio_storage_path"),
    audioUrl: text("audio_url"),
    videoStoragePath: text("video_storage_path"),
    videoUrl: text("video_url"),
    status: videoStatusEnum("status").default("draft").notNull(),
    durationSeconds: integer("duration_seconds"),
    resolution: text("resolution").default("480p"),
    falRequestId: text("fal_request_id"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("marketing_videos_created_by_idx").on(table.createdBy),
    index("marketing_videos_status_idx").on(table.status),
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

// ══════════════════════════════════════════════════════════
// ══  DOCUMENT PORTAL TABLES  ═════════════════════════════
// ══════════════════════════════════════════════════════════

// ── Document Portal Enums ────────────────────────────────
export const documentStatusEnum = pgEnum("document_status", [
  "new",
  "reviewed",
  "archived",
]);

export const documentLinkStatusEnum = pgEnum("document_link_status", [
  "active",
  "expired",
  "revoked",
]);

export const eSignStatusEnum = pgEnum("esign_status", [
  "pending",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "uploaded",
  "viewed",
  "downloaded",
  "reviewed",
  "archived",
  "deleted",
  "link_created",
  "link_accessed",
  "esign_sent",
  "esign_signed",
  "esign_declined",
  "tax_organizer_sent",
  "tax_organizer_submitted",
]);

// ── Document Links (secure upload links for clients) ─────
export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    message: text("message"),
    requiredDocuments: jsonb("required_documents"), // string[]
    maxUploads: integer("max_uploads").default(10),
    uploadCount: integer("upload_count").default(0),
    status: documentLinkStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
    deliveryMethod: text("delivery_method"), // "sms" | "email" | "manual"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("document_links_token_idx").on(table.token),
    index("document_links_owner_idx").on(table.ownerId),
    index("document_links_expires_idx").on(table.expiresAt),
  ]
);

// ── Documents ────────────────────────────────────────────
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    linkId: uuid("link_id").references(() => documentLinks.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    storagePath: text("storage_path").notNull(),
    storageUrl: text("storage_url"),
    status: documentStatusEnum("status").default("new").notNull(),
    category: text("category"), // "W-2", "1099", "Bank Statement", etc.
    taxYear: text("tax_year"),
    notes: text("notes"),
    sharedWithClient: boolean("shared_with_client").default(false).notNull(),
    sharedAt: timestamp("shared_at"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("documents_owner_idx").on(table.ownerId),
    index("documents_owner_status_idx").on(table.ownerId, table.status),
    index("documents_link_idx").on(table.linkId),
    index("documents_client_email_idx").on(table.clientEmail),
  ]
);

// ── Document Audit Log ───────────────────────────────────
export const documentAuditLog = pgTable(
  "document_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    linkId: uuid("link_id").references(() => documentLinks.id, {
      onDelete: "cascade",
    }),
    action: auditActionEnum("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name"),
    actorIp: text("actor_ip"),
    actorUserAgent: text("actor_user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_document_idx").on(table.documentId),
    index("audit_log_link_idx").on(table.linkId),
    index("audit_log_actor_idx").on(table.actorId),
    index("audit_log_created_idx").on(table.createdAt),
  ]
);

// ── E-Signatures ─────────────────────────────────────────
export const eSignatures = pgTable(
  "e_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    status: eSignStatusEnum("status").default("pending").notNull(),
    token: text("token").notNull().unique(),
    signedAt: timestamp("signed_at"),
    signatureData: text("signature_data"), // Base64 SVG/PNG
    signatureIp: text("signature_ip"),
    signatureUserAgent: text("signature_user_agent"),
    expiresAt: timestamp("expires_at").notNull(),
    sentAt: timestamp("sent_at"),
    viewedAt: timestamp("viewed_at"),
    declinedAt: timestamp("declined_at"),
    declineReason: text("decline_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("esignatures_token_idx").on(table.token),
    index("esignatures_document_idx").on(table.documentId),
    index("esignatures_owner_idx").on(table.ownerId),
    index("esignatures_signer_email_idx").on(table.signerEmail),
  ]
);

// ── Tax Form Submissions ─────────────────────────────────
export const taxFormSubmissions = pgTable(
  "tax_form_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(), // References TaxForm.id from data/taxForms.ts
    formNumber: text("form_number").notNull(), // e.g., "1040"
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    taxYear: text("tax_year").notNull(),
    formData: jsonb("form_data").notNull(), // Filled field values
    status: text("status").default("draft").notNull(), // "draft" | "completed" | "submitted"
    pdfStoragePath: text("pdf_storage_path"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_form_submissions_owner_idx").on(table.ownerId),
    index("tax_form_submissions_client_idx").on(table.clientName),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  ENGAGEMENT LETTERS  ═════════════════════════════════
// ══════════════════════════════════════════════════════════

export const engagementStatusEnum = pgEnum("engagement_status", [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
]);

// ── Engagement Templates ─────────────────────────────────
export const engagementTemplates = pgTable(
  "engagement_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("engagement_templates_owner_idx").on(table.ownerId),
  ]
);

// ── Engagements ──────────────────────────────────────────
export const engagements = pgTable(
  "engagements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => engagementTemplates.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    content: text("content").notNull(),
    status: engagementStatusEnum("status").default("draft").notNull(),
    sentAt: timestamp("sent_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("engagements_owner_idx").on(table.ownerId),
    index("engagements_status_idx").on(table.status),
  ]
);

// ── Engagement Signers ──────────────────────────────────────
export const engagementSigners = pgTable(
  "engagement_signers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    order: integer("order").notNull().default(1),
    status: engagementStatusEnum("status").default("sent").notNull(),
    sentAt: timestamp("sent_at"),
    viewedAt: timestamp("viewed_at"),
    signedAt: timestamp("signed_at"),
    declinedAt: timestamp("declined_at"),
    declineReason: text("decline_reason"),
    role: text("role"),
    signatureData: text("signature_data"),
    signatureIp: text("signature_ip"),
    signatureUserAgent: text("signature_user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("engagement_signers_token_idx").on(table.token),
    index("engagement_signers_engagement_idx").on(table.engagementId),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  INVOICING  ══════════════════════════════════════════
// ══════════════════════════════════════════════════════════

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "paid",
  "partial",
  "overdue",
  "canceled",
  "void",
]);

export const recurringIntervalEnum = pgEnum("recurring_interval", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const billingTypeEnum = pgEnum("billing_type", [
  "one_time",
  "monthly",
  "quarterly",
  "yearly",
]);

export const invoiceCurrencyEnum = pgEnum("invoice_currency", [
  "usd",
  "cad",
  "gbp",
  "eur",
  "aud",
]);

// ── Invoices ─────────────────────────────────────────────
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Client info
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientPhone: text("client_phone"),
    clientCompany: text("client_company"),

    // Invoice metadata
    invoiceNumber: text("invoice_number").notNull().unique(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    currency: invoiceCurrencyEnum("currency").default("usd").notNull(),
    token: text("token").notNull().unique(),

    // Financials (integer cents)
    subtotal: integer("subtotal").notNull().default(0),
    taxRate: integer("tax_rate").default(0), // basis points: 825 = 8.25%
    taxAmount: integer("tax_amount").default(0),
    total: integer("total").notNull().default(0),

    // Dates
    issueDate: timestamp("issue_date").defaultNow().notNull(),
    dueDate: timestamp("due_date").notNull(),

    // Content
    notes: text("notes"),
    terms: text("terms"),

    // Stripe references
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paymentUrl: text("payment_url"),
    paymentMethod: text("payment_method"), // "card" | "ach"
    achSettlementStatus: text("ach_settlement_status"), // "pending" | "approved" | "declined"

    // Partial payment tracking (integer cents)
    amountPaid: integer("amount_paid").default(0).notNull(),
    balanceDue: integer("balance_due").default(0).notNull(),

    // Recurring invoice fields
    isRecurring: boolean("is_recurring").default(false).notNull(),
    recurringInterval: recurringIntervalEnum("recurring_interval"),
    recurringEndDate: timestamp("recurring_end_date"),
    nextRecurrenceDate: timestamp("next_recurrence_date"),
    recurringParentId: uuid("recurring_parent_id"),

    // Accounting sync references
    qbInvoiceId: text("qb_invoice_id"),
    xeroInvoiceId: text("xero_invoice_id"),
    customBooksInvoiceId: text("custom_books_invoice_id"),

    // Reminder config (JSONB)
    // { schedule: [{ dayOffset: -7 }, { dayOffset: 0 }, { dayOffset: 3 }] }
    reminderConfig: jsonb("reminder_config"),

    // Generic metadata bag — used for things like the Digital Rainmaker
    // System auto-invoicing flow:
    //   { engagementId, drsRole: "initial_setup" | "final_setup" | "monthly_subscription" }
    metadata: jsonb("metadata"),

    // Lifecycle timestamps
    sentAt: timestamp("sent_at"),
    viewedAt: timestamp("viewed_at"),
    paidAt: timestamp("paid_at"),
    canceledAt: timestamp("canceled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("invoices_token_idx").on(table.token),
    uniqueIndex("invoices_number_idx").on(table.invoiceNumber),
    index("invoices_owner_idx").on(table.ownerId),
    index("invoices_owner_status_idx").on(table.ownerId, table.status),
    index("invoices_client_email_idx").on(table.clientEmail),
    index("invoices_due_date_idx").on(table.dueDate),
  ]
);

// ── Invoice Line Items ───────────────────────────────────
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(100), // stored * 100 (1.5 → 150)
    unitPrice: integer("unit_price").notNull(), // cents
    amount: integer("amount").notNull(), // cents
    billingType: billingTypeEnum("billing_type").default("one_time").notNull(),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_line_items_invoice_idx").on(table.invoiceId),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  ACCOUNTING INTEGRATIONS  ════════════════════════════
// ══════════════════════════════════════════════════════════

export const accountingProviderEnum = pgEnum("accounting_provider", [
  "quickbooks",
  "xero",
  "custombooks",
]);

export const accountingConnections = pgTable(
  "accounting_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: accountingProviderEnum("provider").notNull(),

    // OAuth tokens
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at").notNull(),

    // Provider-specific IDs
    realmId: text("realm_id"), // QuickBooks company ID
    tenantId: text("tenant_id"), // Xero organization ID

    companyName: text("company_name"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    lastSyncAt: timestamp("last_sync_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("accounting_connections_user_provider_idx").on(
      table.userId,
      table.provider
    ),
    index("accounting_connections_user_idx").on(table.userId),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  TAX RETURNS  ════════════════════════════════════════
// ══════════════════════════════════════════════════════════

export const taxReturnStatusEnum = pgEnum("tax_return_status", [
  "not_started",
  "documents_received",
  "in_progress",
  "filed",
  "accepted",
]);

export const taxReturnTypeEnum = pgEnum("tax_return_type", [
  "1040",
  "1120",
  "1120S",
  "1065",
  "990",
  "other",
]);

export const taxReturns = pgTable(
  "tax_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientCompany: text("client_company"),
    taxYear: text("tax_year").notNull(),
    returnType: taxReturnTypeEnum("return_type").default("1040").notNull(),
    status: taxReturnStatusEnum("status").default("not_started").notNull(),
    dueDate: timestamp("due_date"),
    filedDate: timestamp("filed_date"),
    acceptedDate: timestamp("accepted_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_returns_owner_idx").on(table.ownerId),
    index("tax_returns_owner_status_idx").on(table.ownerId, table.status),
    index("tax_returns_owner_year_idx").on(table.ownerId, table.taxYear),
  ]
);

// ── Tax Organizer Links (secure token-based, no login required) ──
export const taxOrganizerLinks = pgTable(
  "tax_organizer_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taxReturnId: uuid("tax_return_id").references(() => taxReturns.id, {
      onDelete: "cascade",
    }),
    token: text("token").notNull().unique(),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    taxYear: text("tax_year").notNull(),
    returnType: text("return_type").notNull(),
    status: documentLinkStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tax_organizer_links_token_idx").on(table.token),
    index("tax_organizer_links_owner_idx").on(table.ownerId),
    index("tax_organizer_links_tax_return_idx").on(table.taxReturnId),
    index("tax_organizer_links_expires_idx").on(table.expiresAt),
  ]
);

// ── Tax Organizer Submissions ────────────────────────────
export const taxOrganizerSubmissions = pgTable(
  "tax_organizer_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => taxOrganizerLinks.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taxReturnId: uuid("tax_return_id").references(() => taxReturns.id, {
      onDelete: "cascade",
    }),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    formData: jsonb("form_data").notNull(),
    uploadedDocumentIds: jsonb("uploaded_document_ids"),
    submitterIp: text("submitter_ip"),
    submitterUserAgent: text("submitter_user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_organizer_submissions_link_idx").on(table.linkId),
    index("tax_organizer_submissions_owner_idx").on(table.ownerId),
    index("tax_organizer_submissions_tax_return_idx").on(table.taxReturnId),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  CLIENT PORTAL  ═══════════════════════════════════════
// ══════════════════════════════════════════════════════════

export const portalMagicLinks = pgTable(
  "portal_magic_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portal_magic_links_token_idx").on(table.token),
    index("portal_magic_links_email_idx").on(table.email),
  ]
);

export const portalSessions = pgTable(
  "portal_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    sessionToken: text("session_token").notNull().unique(),
    clientName: text("client_name"),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portal_sessions_token_idx").on(table.sessionToken),
    index("portal_sessions_email_idx").on(table.email),
    index("portal_sessions_expires_idx").on(table.expiresAt),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  INVOICE REMINDERS  ══════════════════════════════════
// ══════════════════════════════════════════════════════════

export const invoiceReminders = pgTable(
  "invoice_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    dayOffset: integer("day_offset").notNull(), // e.g. -7 = 7 days before due
    scheduledFor: timestamp("scheduled_for").notNull(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_reminders_invoice_idx").on(table.invoiceId),
    index("invoice_reminders_scheduled_idx").on(table.scheduledFor),
    uniqueIndex("invoice_reminders_invoice_offset_idx").on(
      table.invoiceId,
      table.dayOffset
    ),
  ]
);

// ══════════════════════════════════════════════════════════
// ══  EMAIL LOG  ══════════════════════════════════════════
// ══════════════════════════════════════════════════════════

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject").notNull(),
    emailType: text("email_type").notNull(),
    relatedId: text("related_id"),
    status: text("status").default("sent").notNull(),
    resendMessageId: text("resend_message_id"),
    error: text("error"),
    sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("email_log_recipient_idx").on(table.recipientEmail),
    index("email_log_type_idx").on(table.emailType),
    index("email_log_created_idx").on(table.createdAt),
    index("email_log_sent_by_idx").on(table.sentBy),
  ]
);

// ── Portal Messages ──────────────────────────────────────
export const portalMessages = pgTable(
  "portal_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientEmail: text("client_email").notNull(),
    senderType: text("sender_type").notNull(), // "cpa" | "client"
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portal_messages_thread_idx").on(
      table.ownerId,
      table.clientEmail,
      table.createdAt
    ),
    index("portal_messages_unread_idx").on(
      table.ownerId,
      table.clientEmail,
      table.read
    ),
  ]
);

// ── Notifications ─────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.read),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ]
);

// ── VSL Video Tracking ────────────────────────────────────
export const vslTracking = pgTable(
  "vsl_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    email: text("email"), // Nullable - set when user submits form
    eventType: text("event_type").notNull(), // 'play', 'pause', 'progress', 'milestone', 'complete'
    videoPosition: real("video_position").default(0).notNull(), // Current time in seconds
    videoDuration: real("video_duration").default(0).notNull(), // Total duration in seconds
    completionPercentage: real("completion_percentage").default(0).notNull(), // 0-100
    milestone: integer("milestone"), // 25, 50, 75, 100 for milestone events
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("vsl_tracking_session_idx").on(table.sessionId),
    index("vsl_tracking_email_idx").on(table.email),
    index("vsl_tracking_created_idx").on(table.createdAt),
  ]
);
