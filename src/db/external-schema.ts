/**
 * Tables OWNED BY THE MARKETING APP (repo root), read here over the shared
 * Neon database.
 *
 * Never include this file in drizzle-kit. The dashboard's drizzle.config.ts
 * excludes the `leads` table via `tablesFilter`, and the migration for these
 * columns lives in the root repo under scripts/*.sql.
 *
 * Keep this in sync with /lib/leads-schema.ts at the repo root. Columns here
 * must be a superset-safe mirror: adding a column to the root file means
 * adding it here too, or dashboard reads will silently return undefined.
 */
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const leads = pgTable(
  "leads",
  {
    // Primary key
    id: uuid("id").defaultRandom().primaryKey(),

    // Contact info
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    firmName: text("firm_name"),
    websiteUrl: text("website_url"),
    firmType: text("firm_type"),

    // Qualification data (from QualificationProvider)
    usBased: boolean("us_based"),
    decisionRole: text("decision_role"),
    annualRevenue: text("annual_revenue"),
    goal: text("goal"),
    goalTag: text("goal_tag"),
    problemDuration: text("problem_duration"),
    budgetRange: text("budget_range"),
    timeline: text("timeline"),
    taxSavings: text("tax_savings"),
    taxSavingsTag: text("tax_savings_tag"),

    // Lead classification
    leadScore: text("lead_score"), // 'raw' | 'qualified' | 'disqualified'
    disqualifyReason: text("disqualify_reason"),

    // Source tracking
    formSource: text("form_source"), // 'qualification-gate' | 'free-guide' | 'audit' | 'revenue-calc' | 'roadmap' | 'foundation'

    // Attribution (from cookies/localStorage)
    fbclid: text("fbclid"),
    fbp: text("fbp"),
    fbc: text("fbc"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    landingPage: text("landing_page"),
    referrer: text("referrer"),

    // Meta CAPI tracking
    metaEventId: text("meta_event_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Consent
    marketingSmsOptIn: boolean("marketing_sms_opt_in").default(false),
    nonMarketingSmsOptIn: boolean("non_marketing_sms_opt_in").default(false),

    // CRM integration
    ghlContactId: text("ghl_contact_id"),

    // Lifecycle stage tracking
    bookedCallAt: timestamp("booked_call_at"),
    showedCallAt: timestamp("showed_call_at"),
    opportunityAt: timestamp("opportunity_at"),
    purchasedAt: timestamp("purchased_at"),

    // Low-ticket (CPA Scaling Roadmap) purchase
    roadmapPurchasedAt: timestamp("roadmap_purchased_at"),
    roadmapAmountCents: integer("roadmap_amount_cents"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    // Firm Foundation subscription ($497/mo website + portal tier)
    foundationSubscribedAt: timestamp("foundation_subscribed_at"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status"),
    subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
    provisionedAt: timestamp("provisioned_at"),
    provisioningStatus: text("provisioning_status"), // 'pending' | 'ok' | 'failed'
    provisioningError: text("provisioning_error"),
    onboardingIntake: jsonb("onboarding_intake"),
    kickoffBookedAt: timestamp("kickoff_booked_at"),
    previewToken: text("preview_token"),
    previewStatus: text("preview_status"),

    // Demo funnel (scripts/add-setup-fee-columns.sql in the marketing repo).
    // funnelPath: which side of the qualifier split the lead landed on —
    // 'agency' (pitched the call) or 'web' (self-serve website + portal).
    funnelPath: text("funnel_path"),
    setupFeeCents: integer("setup_fee_cents"),
    firstPaymentCents: integer("first_payment_cents"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("leads_email_idx").on(table.email),
    index("leads_meta_event_id_idx").on(table.metaEventId),
    index("leads_lead_score_idx").on(table.leadScore),
    index("leads_created_idx").on(table.createdAt),
    index("leads_fbclid_idx").on(table.fbclid),
  ]
);
