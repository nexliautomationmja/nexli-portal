"use client";

// ─── An AI avatar's intro video (Mux) ──────────────────────
// Two modes, like the player on nexli.net/ai-avatars:
//   preview  silent, looping, no controls, not clickable: the hover preview
//            on a library tile (the tile underneath takes the click).
//   full     sound and controls: the pop-up player on the Launch Pad.
// MuxPlayer rather than <video src>: Mux serves these as HLS only (no MP4
// renditions), and a plain video tag plays HLS natively in Safari alone.
// Captions are burned into every video, so the player's own stay hidden.
// Loaded with next/dynamic, so it's only downloaded when a video plays.
// CSP: script/media/connect/worker sources for Mux are allowed in middleware.ts.

import MuxPlayer, { type MuxCSSProperties } from "@mux/mux-player-react";

export interface AvatarVideoProps {
  playbackId: string;
  name: string;
  mode: "preview" | "full";
  /** Her portrait, so the frame before play matches the tile. */
  poster?: string;
  /** Full mode: start playing (with sound) as soon as it opens. */
  autoPlay?: boolean;
  /** First frame on screen (the hover preview fades in over the tile). */
  onPlaying?: () => void;
  className?: string;
}

export default function AvatarVideo({ playbackId, name, mode, poster, autoPlay = false, onPlaying, className }: AvatarVideoProps) {
  const preview = mode === "preview";
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{ video_title: `AI avatar: ${name}` }}
      streamType="on-demand"
      poster={poster}
      playsInline
      defaultHiddenCaptions
      accentColor="#22d3ee"
      // No hotkeys prop: mux-player exposes it read-only and setting it throws.
      {...(preview
        ? { muted: true, autoPlay: "muted" as const, loop: true, nohotkeys: true }
        : { autoPlay: autoPlay ? ("any" as const) : false })}
      onPlaying={onPlaying}
      className={className}
      style={
        {
          height: "100%",
          width: "100%",
          "--media-object-fit": "cover",
          "--captions-button": "none",
          ...(preview ? { "--controls": "none", pointerEvents: "none" } : {}),
        } as MuxCSSProperties
      }
    />
  );
}
