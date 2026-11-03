import { db } from "@/db";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/db/schema";

/**
 * Creative Studio tables (admin-only tab: frame → script → Kling clips →
 * edited video). Defined here rather than in src/db/schema.ts and created
 * lazily with CREATE TABLE IF NOT EXISTS, because this repo has no migration
 * pipeline (same approach as src/lib/client-success-tables.ts). Keep the DDL
 * below in sync with these pgTable definitions.
 *
 * Files are stored by storage path only and signed on read — never store a
 * signed URL (they expire).
 */

export type CreativeFormat = "ad_9x16" | "vsl_16x9";
export type CreativeRig = "solo_locked" | "solo_selfie" | "duo" | "trio";
export type ClipSpeaker = "LEFT" | "CENTER" | "RIGHT" | null;

export interface CreativeBrief {
  oldBelief: string;
  newBelief: string;
  proof: string;
  cta: string;
  requiredLines: string;
  notes: string;
}

export interface FramePosition {
  position: "LEFT" | "CENTER" | "RIGHT";
  /** "the woman on the RIGHT in the olive three-piece suit with a white shirt" */
  who: string;
  /** "the olive three-piece suit with a white shirt" */
  outfit: string;
  /** "The woman in olive" — used for listener directions. */
  shortName: string;
}

/** §5 frame description, written by Claude from the frame image. */
export interface FrameSpec {
  /** Single presenter: "Daniela, the woman with … ; as she talks she moves naturally from this pose" */
  subject: string;
  /** Props by side, background left to right, light. Ends "Warm natural daylight, soft background blur." */
  room: string;
  /** Multi-person: who they are, shared look. */
  base: string;
  /** Multi-person: one entry per position. Empty for a single presenter. */
  positions: FramePosition[];
}

export interface ListenerReaction {
  shortName: string;
  reaction: string;
}

/** The editable fields of one clip (what a script version snapshots). */
export interface ClipFields {
  section: string;
  speaker: ClipSpeaker;
  line: string;
  register: string;
  action: string;
  editNote: string;
  cues: string;
  listenerReactions: ListenerReaction[];
}

export interface ScriptSnapshot {
  version: number;
  createdAt: string;
  reason: string;
  frameSpec: FrameSpec | null;
  notes: string | null;
  clips: ClipFields[];
}

export const creativeProjects = pgTable("creative_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The person who created it (team member id when a member did). */
  createdBy: uuid("created_by"),
  title: text("title").notNull(),
  format: text("format").$type<CreativeFormat>().notNull(),
  rig: text("rig").$type<CreativeRig>().notNull(),
  brief: jsonb("brief").$type<CreativeBrief>().notNull(),
  frameSpec: jsonb("frame_spec").$type<FrameSpec | null>(),
  /** draft → scripted → approved (→ rendering → clips_ready → editing → done in later phases) */
  status: text("status").notNull().default("draft"),
  scriptNotes: text("script_notes"),
  scriptVersion: integer("script_version").notNull().default(0),
  scriptHistory: jsonb("script_history").$type<ScriptSnapshot[]>().notNull().default([]),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creativeAssets = pgTable("creative_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => creativeProjects.id, { onDelete: "cascade" }),
  /** frame | clip | audio | render */
  kind: text("kind").notNull(),
  storagePath: text("storage_path"),
  mime: text("mime"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  /** upload | manus | kling | remotion */
  source: text("source").notNull().default("upload"),
  providerTaskId: text("provider_task_id"),
  status: text("status").notNull().default("ready"),
  error: text("error"),
  sort: integer("sort").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creativeClips = pgTable("creative_clips", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => creativeProjects.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  section: text("section").notNull(),
  speaker: text("speaker").$type<"LEFT" | "CENTER" | "RIGHT">(),
  line: text("line").notNull(),
  register: text("register").notNull().default(""),
  action: text("action").notNull().default(""),
  editNote: text("edit_note").notNull().default(""),
  cues: text("cues").notNull().default(""),
  listenerReactions: jsonb("listener_reactions").$type<ListenerReaction[]>().notNull().default([]),
  durationS: integer("duration_s").notNull(),
  /** The complete Kling prompt, assembled in code from the §7 templates. */
  prompt: text("prompt").notNull(),
  frameAssetId: uuid("frame_asset_id"),
  model: text("model"),
  klingTaskId: text("kling_task_id"),
  /** draft | queued | rendering | done | failed | blocked */
  status: text("status").notNull().default("draft"),
  videoAssetId: uuid("video_asset_id"),
  version: integer("version").notNull().default(1),
  previous: jsonb("previous").$type<Record<string, unknown>[]>().notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

let ensured: Promise<void> | null = null;

export function ensureCreativeStudioTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_projects" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "created_by" uuid,
          "title" text NOT NULL,
          "format" text NOT NULL,
          "rig" text NOT NULL,
          "brief" jsonb NOT NULL,
          "frame_spec" jsonb,
          "status" text NOT NULL DEFAULT 'draft',
          "script_notes" text,
          "script_version" integer NOT NULL DEFAULT 0,
          "script_history" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "approved_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_projects_owner_idx" ON "creative_projects" ("owner_id", "updated_at")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_assets" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "project_id" uuid NOT NULL REFERENCES "creative_projects"("id") ON DELETE CASCADE,
          "kind" text NOT NULL,
          "storage_path" text,
          "mime" text,
          "width" integer,
          "height" integer,
          "duration_ms" integer,
          "source" text NOT NULL DEFAULT 'upload',
          "provider_task_id" text,
          "status" text NOT NULL DEFAULT 'ready',
          "error" text,
          "sort" integer NOT NULL DEFAULT 0,
          "metadata" jsonb,
          "created_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_assets_project_idx" ON "creative_assets" ("project_id", "kind", "sort")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_clips" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "project_id" uuid NOT NULL REFERENCES "creative_projects"("id") ON DELETE CASCADE,
          "idx" integer NOT NULL,
          "section" text NOT NULL,
          "speaker" text,
          "line" text NOT NULL,
          "register" text NOT NULL DEFAULT '',
          "action" text NOT NULL DEFAULT '',
          "edit_note" text NOT NULL DEFAULT '',
          "cues" text NOT NULL DEFAULT '',
          "listener_reactions" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "duration_s" integer NOT NULL,
          "prompt" text NOT NULL,
          "frame_asset_id" uuid,
          "model" text,
          "kling_task_id" text,
          "status" text NOT NULL DEFAULT 'draft',
          "video_asset_id" uuid,
          "version" integer NOT NULL DEFAULT 1,
          "previous" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "error" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_clips_project_idx" ON "creative_clips" ("project_id", "idx")`
      );
    })().catch((err) => {
      ensured = null; // retry on the next request
      throw err;
    });
  }
  return ensured;
}
