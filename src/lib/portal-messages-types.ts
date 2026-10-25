/**
 * Client-safe types for message threads (no server imports). Server code
 * re-exports these from src/lib/portal-messages.ts; client components should
 * `import type { ThreadMessage } from "@/lib/portal-messages-types"`.
 */

export type MessageKind = "text" | "voice" | "weekly_update";

export type TranscriptStatus = "pending" | "done" | "failed";

export interface ThreadMessage {
  id: string;
  senderType: "cpa" | "client";
  kind: MessageKind;
  /** Display text. For voice messages: the transcript (or "🎙 Voice message"). */
  message: string;
  transcript: string | null;
  transcriptStatus: TranscriptStatus | null;
  /** Signed URL (1h) for the audio, or null for text messages. */
  audioUrl: string | null;
  audioDurationMs: number | null;
  weeklyUpdate: { headline: string | null; adSpendCents: number | null } | null;
  read: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

export const VOICE_MESSAGE_PLACEHOLDER = "🎙 Voice message";
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_VOICE_BYTES = 4 * 1024 * 1024;
