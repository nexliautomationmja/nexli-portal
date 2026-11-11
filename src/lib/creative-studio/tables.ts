import { db } from "@/db";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/db/schema";
import type { CaptionWord, EditOverlays, EditStyle, PipTrack } from "@/remotion/types";

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

/**
 * How a clip is shot (story videos; a classic one-frame video is always
 * to_camera): talks into the lens · talks to someone/something in the scene ·
 * acts while their voice narrates · nobody talks.
 */
export type ClipKind = "to_camera" | "in_scene" | "voiceover" | "silent";
export const CLIP_KINDS: ClipKind[] = ["to_camera", "in_scene", "voiceover", "silent"];
export type SceneCamera = "locked" | "selfie" | "handheld";
export type Pronoun = "she" | "he";

/** One person in a story scene, as Claude describes them from the frame. */
export interface ScenePerson {
  /** ONLY when they're alone in the frame. */
  position: "ONLY" | "LEFT" | "CENTER" | "RIGHT";
  /** The video's presenter. */
  presenter: boolean;
  /** "the man on the LEFT in the navy suit" */
  who: string;
  /** §5 Subject style: look, outfit, seat, pose, how they move from it. */
  look: string;
  /** "The man in navy" — for listener directions. */
  shortName: string;
  pronoun: Pronoun;
  /** No longer written (always ""): Kling picks every voice from the frame; only Daniela's is set. */
  voice: string;
}

/** A story scene's description (one per scene frame), written by Claude with the script. */
export interface SceneSpec {
  /** The scene's frame (creative_assets id). */
  frameId: string;
  label: string;
  camera: SceneCamera;
  /** §5 Room: props by side, background left to right, light. */
  setting: string;
  /** Who's in the frame (empty for a shot with nobody in it). */
  people: ScenePerson[];
  /** The frame was replaced after this was written (the script should catch up). */
  stale?: boolean;
}

/**
 * A scene of a story video, in story order: its frame, a short label and
 * (when Claude planned it) the shot Manus was asked for.
 */
export interface SceneSlot {
  id: string;
  label: string;
  shot: string;
  frameId: string | null;
}

/** Claude's read of frames that arrived without a direction, and its question. */
export interface SceneAsk {
  /** The frame ids it looked at, in order (a different set means it's out of date). */
  frames: string[];
  reads: { label: string; read: string }[];
  question: string;
  /** A direction the user could take as is. */
  suggestion: string;
}

/** Who presents a video (a snapshot of creative_presenters; null = the studio's default). */
export interface PresenterInfo {
  id: string;
  name: string;
  pronoun: Pronoun;
  /** Daniela's set voice line; "" for anyone else (Kling picks the voice from the frame). */
  voice: string;
  /** What they look like (Manus uses it when there are no photos). */
  look: string;
}

export interface CreativeBrief {
  /** What Marcel says the video is about, in his own words (the simple flow). */
  direction?: string;
  /**
   * Frames came in with no direction: what Claude sees in each one and the
   * one question it asks (for the frames listed in `frames`).
   */
  ask?: SceneAsk;
  /** Claude's note on how it split the story into scenes (the storyboard plan). */
  plan?: string;
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
  /**
   * A story video: one description per scene (subject/room above mirror
   * scene 1). Absent on a classic one-frame video.
   */
  scenes?: SceneSpec[];
  /** The presenter a story script was written for (null = the studio's default). */
  presenterId?: string | null;
  /**
   * A one-frame video re-described for a new frame (clips re-made from it):
   * that frame. Absent = the description is the one the script was written with.
   */
  describedFrameId?: string | null;
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
  /** How it's shot (story videos); absent = to_camera. */
  kind?: ClipKind;
  /** The scene's frame (creative_clips.frame_asset_id); absent = the opening frame. */
  frameId?: string | null;
  /** A reaction video's watch clip: the part of the video she watches. Absent on every other clip. */
  watch?: WatchWindow | null;
}

/**
 * A reaction video (Nov 2026): the presenter holds her phone, opens with a
 * hook, watches a video, then reacts, with the video in the corner of the
 * edit. Null on every other video.
 */
export interface ReactionInfo {
  /** The creative_assets row (kind source_video) she reacts to. */
  sourceId: string;
  /** The source the current script was written for (a different one = the script needs rewriting). */
  scriptFor?: string | null;
}

/** Seconds on the source video's own timeline. */
export interface WatchWindow {
  from: number;
  to: number;
}

/** One still taken from the source video, for Claude to look at. */
export interface SourceStill {
  path: string;
  /** Seconds into the source. */
  t: number;
}

/** creative_assets.metadata of a source_video. */
export interface SourceMeta {
  filename?: string;
  /** The light copy the edit plays in the corner (960 px, 30 fps, H.264, −16 LUFS). */
  proxyPath?: string;
  proxyError?: string;
  stills?: SourceStill[];
  /** What Scribe heard (empty for a video with no speech). */
  words?: TranscriptWord[];
  text?: string;
  analyzedAt?: string;
  analyzeError?: string;
  hasAudio?: boolean;
  fps?: number | null;
  /** In-flight work: when each step was claimed (a claim older than 320 s is dead). */
  claims?: { analyze?: string; proxy?: string };
  /** Claude's one-line read of the video (written with the script). */
  summary?: string;
  /** The video already shows its own captions (so the edit doesn't add a second set). */
  captioned?: boolean;
}

export interface ScriptSnapshot {
  version: number;
  rig?: CreativeRig;
  createdAt: string;
  reason: string;
  frameSpec: FrameSpec | null;
  notes: string | null;
  clips: ClipFields[];
}

/**
 * A client firm's own Creative Studio. Nexli's studio is implicit (studio_id
 * null everywhere), so everything made before studios existed stays Nexli's.
 * Every admin in the workspace can open every studio.
 */
export const creativeStudios = pgTable("creative_studios", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** What the firm offers, who it serves, where, its call to action — fed to every writer in this studio. */
  about: text("about"),
  website: text("website"),
  /** The firm's portal client account, when it has one (name/logo come from there). */
  clientUserId: uuid("client_user_id").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Someone who presents videos in a studio, other than the default (Daniela
 * in Nexli's studio): name, pronoun, how they sound and how they look.
 * Their reference photos are creative_assets kind "reference" with
 * presenter_id set.
 */
export const creativePresenters = pgTable("creative_presenters", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** null = Nexli's studio. */
  studioId: uuid("studio_id"),
  name: text("name").notNull(),
  pronoun: text("pronoun").$type<Pronoun>().notNull().default("she"),
  /** No longer used: Kling picks a presenter's voice from the frame (kept for old rows). */
  voice: text("voice").notNull().default(""),
  /** How they look (Manus works from this when there are no photos). */
  look: text("look").notNull().default(""),
  createdBy: uuid("created_by"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  /** Set when the video was made as part of a batch (creative_batches). */
  batchId: uuid("batch_id"),
  batchIndex: integer("batch_index"),
  /** The client studio it belongs to (creative_studios); null = Nexli's own studio. */
  studioId: uuid("studio_id"),
  /** A story video's scenes in order; null = a classic one-frame video (its first frame). */
  scenes: jsonb("scenes").$type<SceneSlot[] | null>(),
  /** Who presents it; null = the studio's default (Daniela in Nexli's studio). */
  presenter: jsonb("presenter").$type<PresenterInfo | null>(),
  /** A reaction video's source; null = every other video. */
  reaction: jsonb("reaction").$type<ReactionInfo | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One planned video in a batch (what Claude proposed, as the user edited it). */
export interface BatchPlanItem {
  title: string;
  /** The brief for this one video, as the user would write it. */
  direction: string;
  /** One-line frame description for Manus (used when no pasted frame is assigned). */
  shot: string;
  /** Index into the frames the user pasted, or null = Manus makes one. */
  frame: number | null;
}

/** Several videos made together from one idea (up to 10 ads or 5 VSLs). */
export const creativeBatches = pgTable("creative_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by"),
  format: text("format").$type<CreativeFormat>().notNull(),
  count: integer("count").notNull(),
  /** The idea the user typed. */
  brief: text("brief").notNull(),
  plan: jsonb("plan").$type<BatchPlanItem[]>().notNull(),
  /** null = Nexli's own studio. */
  studioId: uuid("studio_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creativeAssets = pgTable("creative_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Null for workspace-wide assets (Daniela reference images). */
  projectId: uuid("project_id").references(() => creativeProjects.id, { onDelete: "cascade" }),
  /** Set on workspace-wide assets. */
  ownerId: uuid("owner_id"),
  /** Workspace-wide assets (reference, copy_job): their client studio; null = Nexli's own. */
  studioId: uuid("studio_id"),
  /** A reference photo of a saved presenter (null = the studio's default presenter). */
  presenterId: uuid("presenter_id"),
  /** frame | frame_option | manus_task | reference | clip | cut_part | rough_cut | final_cut | render */
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
  /** to_camera | in_scene | voiceover | silent (story videos). */
  kind: text("kind").$type<ClipKind>().notNull().default("to_camera"),
  /** A reaction video's watch clip: the part of the source she watches (null otherwise). */
  watch: jsonb("watch").$type<WatchWindow | null>(),
  durationS: integer("duration_s").notNull(),
  /** The complete Kling prompt, assembled in code from the §7 templates. */
  prompt: text("prompt").notNull(),
  frameAssetId: uuid("frame_asset_id"),
  /** The frame the current take was made from (a different frame_asset_id = the take is from an old frame). */
  takeFrameId: uuid("take_frame_id"),
  model: text("model"),
  klingTaskId: text("kling_task_id"),
  /** draft | queued | rendering | done | failed | blocked */
  status: text("status").notNull().default("draft"),
  videoAssetId: uuid("video_asset_id"),
  version: integer("version").notNull().default(1),
  previous: jsonb("previous").$type<Record<string, unknown>[]>().notNull().default([]),
  error: text("error"),
  /** Word timings from speech-to-text of the rendered clip (for the auto-cut). */
  transcript: jsonb("transcript").$type<ClipTranscript | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface ClipTranscript {
  /** Which take (clip version) these timings belong to. */
  version: number;
  durationS: number;
  words: TranscriptWord[];
  text: string;
}

/** A per-range override from feedback ("tighter where she says…"). Word indexes are inclusive. */
export interface CutOverride {
  fromWord: number;
  toWord: number;
  action: "tighten" | "loosen" | "cut" | "restore";
  gapSeconds?: number;
}

/** A hand-set trim window for one clip, in source seconds. */
export interface ManualTrim {
  /** Exact keep window — the clip starts and ends precisely here (no auto lead/tail). */
  start: number;
  end: number;
  /** Keep every pause inside the window as-is (no auto-tightening for this clip). */
  keepPauses?: boolean;
}

/**
 * A stretch of a take cut out by hand, in source seconds — exact, not
 * snapped to words: the clip jumps straight from `start` to `end`.
 */
export interface TimeCut {
  start: number;
  end: number;
}

export interface CutClipPlan {
  clipId: string;
  version: number;
  /** Set by the trim editor; absent = the auto-cut's own window. */
  manual?: ManualTrim | null;
  /** Sections cut out by hand (trim editor); absent = none. */
  sections?: TimeCut[] | null;
  /** Kept segments in source seconds. */
  segments: { start: number; end: number }[];
  overrides: CutOverride[];
  sourceS: number;
  keptS: number;
  hash: string;
}

/** What Manus is doing right now (task.listMessages verbose=true), saved on the task asset. */
export interface ManusActivitySnapshot {
  status: "running" | "waiting" | "stopped" | "error" | "unknown";
  /** The "Manus is …" line (latest status_update brief/description). */
  now: string | null;
  plan: { title: string; status: "todo" | "doing" | "done" | "failed"; startedAt: number | null; endAt: number | null }[];
  feed: {
    id: string;
    kind: "tool" | "explanation" | "message" | "step";
    tool: string | null;
    title: string;
    detail: string | null;
    status: string | null;
    at: number;
  }[];
  startedAt: number | null;
  updatedAt: number;
}

export interface CutSettings {
  speed: number;
  /** Max pause at playback speed, seconds. */
  gap: number;
}

/** One auto-cut version: settings + per-clip plan + the joined rough cut. */
export const creativeCuts = pgTable("creative_cuts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => creativeProjects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  settings: jsonb("settings").$type<CutSettings>().notNull(),
  plan: jsonb("plan").$type<CutClipPlan[]>().notNull(),
  /** cutting | ready | approved | failed */
  status: text("status").notNull().default("cutting"),
  note: text("note"),
  assetId: uuid("asset_id"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A reaction video's corner video as an edit stores it: the Remotion track, with the source's id instead of a signed URL. */
export type StoredPip = Omit<PipTrack, "src"> & {
  sourceId: string;
  /** Claude's one-line read of the video (for the edit's context; not rendered). */
  summary?: string;
};

/** What one edit version renders (the Remotion props minus the signed video URL). */
export interface EditPropsStored {
  format: CreativeFormat;
  durationS: number;
  words: CaptionWord[];
  overlays: EditOverlays;
  /** "Your way": how the user described the edit, kept for later changes. */
  instruction?: string;
  /** A reaction video's corner video (absent on every other edit). */
  pip?: StoredPip;
}

/** Specs read off the delivered mp4 (rulebook § 7 gate 5). */
export interface RenderSpecs {
  width: number | null;
  height: number | null;
  fps: number | null;
  durationS: number | null;
  expectedS: number;
  hasAudio: boolean;
  ok: boolean;
}

/** One Remotion edit version: style + captions + overlays, and its Lambda render. */
export const creativeEdits = pgTable("creative_edits", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => creativeProjects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  style: text("style").$type<EditStyle>().notNull(),
  /** The final_cut asset this edit sits on. */
  finalCutAssetId: uuid("final_cut_asset_id").notNull(),
  props: jsonb("props").$type<EditPropsStored>().notNull(),
  /** Claude's notes for this version (judgment calls, what changed). */
  notes: text("notes"),
  /** The user's change request that produced this version (null for a fresh style). */
  note: text("note"),
  /**
   * draft | rendering | done | failed. "rendering" with no render id yet =
   * in line for a free Lambda slot (render-queue.ts).
   */
  status: text("status").notNull().default("draft"),
  renderId: text("render_id"),
  /** Times AWS refused to start this render (each retry uses fewer Lambda copies). */
  renderAttempts: integer("render_attempts").notNull().default(0),
  /** Times a Lambda copy crashed mid-render (the retry uses lighter settings, same copies). */
  renderCrashes: integer("render_crashes").notNull().default(0),
  renderBucket: text("render_bucket"),
  progress: integer("progress").notNull().default(0),
  outputAssetId: uuid("output_asset_id"),
  /** S3 key of the render when it was too big to copy into storage. */
  outputKey: text("output_key"),
  specs: jsonb("specs").$type<RenderSpecs | null>(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Photo ads (Nov 2026): one prompt → up to 20 concepts Claude plans and the
 * user reviews; Manus then makes each concept as a finished static ad with
 * Daniela, in a Story (1080×1920) and a Feed (1080×1350) version.
 * studio_id null = Nexli's studio, like everything else.
 */
export const creativePhotoBatches = pgTable("creative_photo_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  studioId: uuid("studio_id"),
  createdBy: uuid("created_by"),
  prompt: text("prompt").notNull(),
  /** Claude's note on how it split the prompt. */
  notes: text("notes"),
  /** planned (in review) | started */
  status: text("status").notNull().default("planned"),
  /** Reference ads the user wants these to look like (storage paths; Claude and Manus both see them). */
  styleRefs: jsonb("style_refs").$type<string[] | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface PhotoAdWaiting {
  kind: "question" | "confirm";
  prompt: string;
  options: string[];
  eventId: string | null;
  eventType: string | null;
  key: string;
}

export const creativePhotoAds = pgTable("creative_photo_ads", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => creativePhotoBatches.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull(),
  idx: integer("idx").notNull(),
  title: text("title").notNull(),
  /** The angle / old belief it plays on (for the review). */
  angle: text("angle").notNull().default(""),
  /** The words on the image, exactly. */
  headline: text("headline").notNull(),
  /** Optional small line under the headline (often the call to action). */
  subline: text("subline").notNull().default(""),
  /** Daniela's photo: setting, pose, expression, framing. */
  scene: text("scene").notNull(),
  /** Type and color treatment. */
  look: text("look").notNull().default(""),
  /** A redo note from the user for the next Manus run. */
  note: text("note"),
  /** planned | queued | starting | running | waiting | saving | done | failed */
  status: text("status").notNull().default("planned"),
  manusTaskId: text("manus_task_id"),
  taskUrl: text("task_url"),
  activity: jsonb("activity").$type<ManusActivitySnapshot | null>(),
  waiting: jsonb("waiting").$type<PhotoAdWaiting | null>(),
  answeredKey: text("answered_key"),
  autoReplies: integer("auto_replies").notNull().default(0),
  storyPath: text("story_path"),
  feedPath: text("feed_path"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Held in creative_edits.render_id while the Lambda launch call is in flight. */
export const RENDER_STARTING = "starting";

/** A final render in line for a free AWS Lambda slot (not on Lambda yet) — render-queue.ts. */
export const isWaiting = (e: { status: string; renderId: string | null }) =>
  e.status === "rendering" && (!e.renderId || e.renderId === RENDER_STARTING);

/**
 * The workspace's Kling connection: the portal is its own MCP client of
 * Kling's MCP server (OAuth 2.1 + PKCE, dynamic client registration), so
 * renders spend the same kling.ai credits Marcel uses in Claude. Tokens are
 * AES-256-GCM encrypted at rest (see kling-mcp.ts).
 */
export const creativeKlingConnections = pgTable("creative_kling_connections", {
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: timestamp("expires_at"),
  klingUserId: text("kling_user_id"),
  connectedAt: timestamp("connected_at"),
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
      // Nov 2026 batch create.
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "batch_id" uuid`);
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "batch_index" integer`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_batches" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "created_by" uuid,
          "format" text NOT NULL,
          "count" integer NOT NULL,
          "brief" text NOT NULL,
          "plan" jsonb NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_batches_owner_idx" ON "creative_batches" ("owner_id", "created_at")`
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
      // Nov 2026 simple flow: workspace-wide reference images have no project.
      await db.execute(sql`ALTER TABLE "creative_assets" ALTER COLUMN "project_id" DROP NOT NULL`);
      await db.execute(sql`ALTER TABLE "creative_assets" ADD COLUMN IF NOT EXISTS "owner_id" uuid`);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_assets_owner_idx" ON "creative_assets" ("owner_id", "kind")`
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
      await db.execute(sql`ALTER TABLE "creative_clips" ADD COLUMN IF NOT EXISTS "transcript" jsonb`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_cuts" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "project_id" uuid NOT NULL REFERENCES "creative_projects"("id") ON DELETE CASCADE,
          "version" integer NOT NULL,
          "settings" jsonb NOT NULL,
          "plan" jsonb NOT NULL,
          "status" text NOT NULL DEFAULT 'cutting',
          "note" text,
          "asset_id" uuid,
          "error" text,
          "created_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_cuts_project_idx" ON "creative_cuts" ("project_id", "version")`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_edits" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "project_id" uuid NOT NULL REFERENCES "creative_projects"("id") ON DELETE CASCADE,
          "version" integer NOT NULL,
          "style" text NOT NULL,
          "final_cut_asset_id" uuid NOT NULL,
          "props" jsonb NOT NULL,
          "notes" text,
          "note" text,
          "status" text NOT NULL DEFAULT 'draft',
          "render_id" text,
          "render_bucket" text,
          "progress" integer NOT NULL DEFAULT 0,
          "output_asset_id" uuid,
          "output_key" text,
          "specs" jsonb,
          "error" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "creative_edits_project_idx" ON "creative_edits" ("project_id", "version")`
      );
      // Nov 2026: a studio per client firm (null studio_id = Nexli's own studio).
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_studios" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "about" text,
          "website" text,
          "client_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "created_by" uuid,
          "archived_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "creative_studios_owner_idx" ON "creative_studios" ("owner_id")`);
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "studio_id" uuid`);
      await db.execute(sql`ALTER TABLE "creative_batches" ADD COLUMN IF NOT EXISTS "studio_id" uuid`);
      await db.execute(sql`ALTER TABLE "creative_assets" ADD COLUMN IF NOT EXISTS "studio_id" uuid`);
      // Nov 2026: photo ads (prompt → concepts → Manus statics in Story + Feed).
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_photo_batches" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "studio_id" uuid,
          "created_by" uuid,
          "prompt" text NOT NULL,
          "notes" text,
          "status" text NOT NULL DEFAULT 'planned',
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "creative_photo_batches_owner_idx" ON "creative_photo_batches" ("owner_id", "created_at")`);
      // Nov 2026: a reference ad to mimic.
      await db.execute(sql`ALTER TABLE "creative_photo_batches" ADD COLUMN IF NOT EXISTS "style_refs" jsonb`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_photo_ads" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "batch_id" uuid NOT NULL REFERENCES "creative_photo_batches"("id") ON DELETE CASCADE,
          "owner_id" uuid NOT NULL,
          "idx" integer NOT NULL,
          "title" text NOT NULL,
          "angle" text NOT NULL DEFAULT '',
          "headline" text NOT NULL,
          "subline" text NOT NULL DEFAULT '',
          "scene" text NOT NULL,
          "look" text NOT NULL DEFAULT '',
          "note" text,
          "status" text NOT NULL DEFAULT 'planned',
          "manus_task_id" text,
          "task_url" text,
          "activity" jsonb,
          "waiting" jsonb,
          "answered_key" text,
          "auto_replies" integer NOT NULL DEFAULT 0,
          "story_path" text,
          "feed_path" text,
          "error" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "creative_photo_ads_batch_idx" ON "creative_photo_ads" ("batch_id", "idx")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "creative_photo_ads_owner_status_idx" ON "creative_photo_ads" ("owner_id", "status")`);
      // Nov 2026: renders queue for the AWS Lambda concurrency limit.
      await db.execute(sql`ALTER TABLE "creative_edits" ADD COLUMN IF NOT EXISTS "render_attempts" integer NOT NULL DEFAULT 0`);
      // Nov 2026: a copy that crashes (out of memory) gets one retry with lighter settings.
      await db.execute(sql`ALTER TABLE "creative_edits" ADD COLUMN IF NOT EXISTS "render_crashes" integer NOT NULL DEFAULT 0`);
      // Nov 2026: story videos (several scenes, any kind of shot) and presenters other than Daniela.
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "scenes" jsonb`);
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "presenter" jsonb`);
      await db.execute(sql`ALTER TABLE "creative_clips" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'to_camera'`);
      // Nov 2026: reaction videos (the presenter reacts to a video shown in the corner).
      await db.execute(sql`ALTER TABLE "creative_projects" ADD COLUMN IF NOT EXISTS "reaction" jsonb`);
      await db.execute(sql`ALTER TABLE "creative_clips" ADD COLUMN IF NOT EXISTS "watch" jsonb`);
      // Nov 2026: which frame a take was made from (re-make clips after a frame change).
      await db.execute(sql`ALTER TABLE "creative_clips" ADD COLUMN IF NOT EXISTS "take_frame_id" uuid`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_presenters" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "studio_id" uuid,
          "name" text NOT NULL,
          "pronoun" text NOT NULL DEFAULT 'she',
          "voice" text NOT NULL DEFAULT '',
          "look" text NOT NULL DEFAULT '',
          "created_by" uuid,
          "archived_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "creative_presenters_owner_idx" ON "creative_presenters" ("owner_id", "studio_id")`);
      await db.execute(sql`ALTER TABLE "creative_assets" ADD COLUMN IF NOT EXISTS "presenter_id" uuid`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "creative_kling_connections" (
          "owner_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
          "client_id" text NOT NULL,
          "redirect_uri" text NOT NULL,
          "access_token_enc" text,
          "refresh_token_enc" text,
          "expires_at" timestamp,
          "kling_user_id" text,
          "connected_at" timestamp,
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
    })().catch((err) => {
      ensured = null; // retry on the next request
      throw err;
    });
  }
  return ensured;
}
