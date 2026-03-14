CREATE TYPE "public"."audit_action" AS ENUM('uploaded', 'viewed', 'downloaded', 'reviewed', 'archived', 'deleted', 'link_created', 'link_accessed', 'esign_sent', 'esign_signed', 'esign_declined');--> statement-breakpoint
CREATE TYPE "public"."document_link_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('new', 'reviewed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."esign_status" AS ENUM('pending', 'sent', 'viewed', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "document_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"link_id" uuid,
	"action" "audit_action" NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"actor_ip" text,
	"actor_user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"token" text NOT NULL,
	"client_name" text,
	"client_email" text,
	"client_phone" text,
	"message" text,
	"required_documents" jsonb,
	"max_uploads" integer DEFAULT 10,
	"upload_count" integer DEFAULT 0,
	"status" "document_link_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_accessed_at" timestamp,
	"delivery_method" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_name" text,
	"client_email" text,
	"client_phone" text,
	"link_id" uuid,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"storage_url" text,
	"status" "document_status" DEFAULT 'new' NOT NULL,
	"category" text,
	"tax_year" text,
	"notes" text,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"status" "esign_status" DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"signed_at" timestamp,
	"signature_data" text,
	"signature_ip" text,
	"signature_user_agent" text,
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "e_signatures_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tax_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"form_id" text NOT NULL,
	"form_number" text NOT NULL,
	"client_name" text,
	"client_email" text,
	"tax_year" text NOT NULL,
	"form_data" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"pdf_storage_path" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_link_id_document_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."document_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_link_id_document_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."document_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signatures" ADD CONSTRAINT "e_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signatures" ADD CONSTRAINT "e_signatures_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_form_submissions" ADD CONSTRAINT "tax_form_submissions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_document_idx" ON "document_audit_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "audit_log_link_idx" ON "document_audit_log" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "document_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "document_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_token_idx" ON "document_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "document_links_owner_idx" ON "document_links" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "document_links_expires_idx" ON "document_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "documents_owner_status_idx" ON "documents" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "documents_link_idx" ON "documents" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "documents_client_email_idx" ON "documents" USING btree ("client_email");--> statement-breakpoint
CREATE UNIQUE INDEX "esignatures_token_idx" ON "e_signatures" USING btree ("token");--> statement-breakpoint
CREATE INDEX "esignatures_document_idx" ON "e_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "esignatures_owner_idx" ON "e_signatures" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "esignatures_signer_email_idx" ON "e_signatures" USING btree ("signer_email");--> statement-breakpoint
CREATE INDEX "tax_form_submissions_owner_idx" ON "tax_form_submissions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tax_form_submissions_client_idx" ON "tax_form_submissions" USING btree ("client_name");