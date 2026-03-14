CREATE TYPE "public"."engagement_status" AS ENUM('draft', 'sent', 'viewed', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "engagement_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"template_id" uuid,
	"token" text NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"status" "engagement_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"signature_data" text,
	"signature_ip" text,
	"signature_user_agent" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "engagements_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "engagement_templates" ADD CONSTRAINT "engagement_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_template_id_engagement_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."engagement_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagement_templates_owner_idx" ON "engagement_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engagements_token_idx" ON "engagements" USING btree ("token");--> statement-breakpoint
CREATE INDEX "engagements_owner_idx" ON "engagements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "engagements_status_idx" ON "engagements" USING btree ("status");