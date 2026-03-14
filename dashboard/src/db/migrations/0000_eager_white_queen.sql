CREATE TYPE "public"."brand_file_category" AS ENUM('logo', 'brand_guideline', 'photo', 'design_file');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'trialing', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"category" "brand_file_category" NOT NULL,
	"storage_path" text NOT NULL,
	"storage_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"page_views_count" integer DEFAULT 0 NOT NULL,
	"unique_visitors_count" integer DEFAULT 0 NOT NULL,
	"top_pages" jsonb,
	"top_referrers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lead_name" text,
	"lead_email" text,
	"lead_phone" text,
	"source" text,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"page_url" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"country" text,
	"device_type" text,
	"session_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"hashed_password" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"company_name" text,
	"stripe_customer_id" text,
	"ghl_contact_id" text,
	"ghl_location_id" text,
	"vercel_project_id" text,
	"vercel_team_id" text,
	"website_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_files" ADD CONSTRAINT "brand_files_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_files" ADD CONSTRAINT "brand_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notifications" ADD CONSTRAINT "lead_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_user_period_idx" ON "analytics_snapshots" USING btree ("user_id","source","period_start");--> statement-breakpoint
CREATE INDEX "brand_files_client_idx" ON "brand_files" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "brand_files_client_category_idx" ON "brand_files" USING btree ("client_id","category");--> statement-breakpoint
CREATE INDEX "daily_stats_client_date_idx" ON "daily_stats" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_stats_unique_idx" ON "daily_stats" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "lead_notifications_user_idx" ON "lead_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "page_views_client_idx" ON "page_views" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "page_views_client_date_idx" ON "page_views" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "page_views_session_idx" ON "page_views" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_stripe_idx" ON "users" USING btree ("stripe_customer_id");