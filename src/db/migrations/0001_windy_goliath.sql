CREATE TYPE "public"."video_status" AS ENUM('draft', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "marketing_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"script" text NOT NULL,
	"visual_prompt" text,
	"avatar_storage_path" text,
	"avatar_url" text,
	"audio_storage_path" text,
	"audio_url" text,
	"video_storage_path" text,
	"video_url" text,
	"status" "video_status" DEFAULT 'draft' NOT NULL,
	"duration_seconds" integer,
	"resolution" text DEFAULT '480p',
	"fal_request_id" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_videos" ADD CONSTRAINT "marketing_videos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_videos_created_by_idx" ON "marketing_videos" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "marketing_videos_status_idx" ON "marketing_videos" USING btree ("status");