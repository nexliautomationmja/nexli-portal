"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ACCENT, CTA_CLASSES, SECONDARY_BTN, type Accent } from "./primitives";
import { AI_AVATAR_ROSTER, AVATAR_LIBRARY_URL, avatarName, portraitUrl, rosterAvatar } from "@/lib/ai-avatar-roster";
import { asAvatarChoice, feeText } from "@/lib/ai-avatar-choice";
import { AI_AVATAR_PICK_CENTS } from "@/lib/drs-pricing";

// ══════════════════════════════════════════════════════════
// "Your AI Avatar" on the client's Launch Pad (Nov 16 2026). By default
// Nexli is selecting the firm's avatar (free). The client can choose a
// specific one from the library instead: $2,500 one-time on their first
// monthly invoice. Avatars other firms hold show as Taken. Locked once the
// first monthly invoice has gone out.
//
// Her intro video (Mux) plays right here: a silent preview over the tile on
// hover (mouse only), and a pop-up player with sound from "Watch".
// ══════════════════════════════════════════════════════════

// The Mux player only downloads when a video is about to play.
const AvatarVideo = dynamic(() => import("./avatar-video"), { ssr: false });

/** A real mouse that can hover (no hover previews on phones and tablets). */
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export interface AvatarInfo {
  /** Library slugs other firms hold. */
  taken: string[];
  /** The avatar Nexli assigned (free), if any. */
  assigned: string | null;
  /** The first monthly invoice has gone out: no more changes. */
  locked: boolean;
}

interface StepTask {
  status: "todo" | "submitted" | "approved" | "needs_attention";
  submission?: unknown;
}

const FEE = feeText(AI_AVATAR_PICK_CENTS);

function Portrait({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={portraitUrl(slug)} alt={`${avatarName(slug)}, an AI-generated avatar`} loading="lazy" className={`object-cover object-top ${className}`} />
  );
}

const PLAY = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
  </svg>
);

/** Opens her intro video in the pop-up player. */
function WatchButton({ slug, onWatch, label = "Watch her intro", className = "" }: { slug: string; onWatch: (slug: string) => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onWatch(slug);
      }}
      className={`inline-flex min-h-8 items-center gap-1.5 font-semibold text-cyan-300 hover:text-white ${className}`}
    >
      {PLAY}
      {label}
    </button>
  );
}

/** The silent hover preview, faded in over the tile once its first frame is up. */
function HoverPreview({ slug }: { slug: string }) {
  const r = rosterAvatar(slug);
  const [playing, setPlaying] = useState(false);
  if (!r) return null;
  return (
    <span className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}>
      <AvatarVideo playbackId={r.playbackId} name={r.name} mode="preview" poster={portraitUrl(slug)} onPlaying={() => setPlaying(true)} />
    </span>
  );
}

/**
 * Her intro with sound, over the page (portaled to <body>: the Launch Pad's
 * animated cards would trap a fixed overlay). Choose from here when she's
 * available.
 */
function VideoPopup({
  slug,
  canChoose,
  onChoose,
  onClose,
}: {
  slug: string;
  canChoose: boolean;
  onChoose: () => void;
  onClose: () => void;
}) {
  const r = rosterAvatar(slug);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!r) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${r.name}'s intro video`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[22rem] flex-col items-center gap-3">
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl" style={{ aspectRatio: "9 / 16", maxHeight: "72vh", width: "min(100%, calc(72vh * 9 / 16))" }}>
          <AvatarVideo playbackId={r.playbackId} name={r.name} mode="full" poster={portraitUrl(slug)} autoPlay />
        </div>
        <div className="w-full" style={{ width: "min(100%, calc(72vh * 9 / 16))" }}>
          <p className="text-base font-bold text-white">{r.name}</p>
          <p className="text-[11px] text-neutral-400">AI-generated avatar · exclusive to one firm</p>
          <div className="mt-3 flex flex-col gap-2">
            {canChoose && (
              <button type="button" onClick={onChoose} className={`${CTA_CLASSES} w-full`}>
                Choose {r.name} · {FEE} one-time →
              </button>
            )}
            <button type="button" onClick={onClose} className={`${SECONDARY_BTN} w-full`}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AiAvatarStep({
  task,
  token,
  avatar,
  onSubmitted,
  accent,
}: {
  task: StepTask;
  token: string;
  avatar: AvatarInfo;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const a = ACCENT[accent];
  const saved = asAvatarChoice(task.submission);
  const savedPick =
    (task.status === "submitted" || task.status === "approved") && saved?.choice === "pick" && saved.slug ? saved.slug : null;
  // What the page shows right after a save, before the reload lands.
  const [local, setLocal] = useState<{ pick: string | null } | null>(null);
  const pick = local ? local.pick : savedPick;
  const current = pick ? { slug: pick, source: "client" as const } : avatar.assigned ? { slug: avatar.assigned, source: "nexli" as const } : null;

  const [mode, setMode] = useState<"view" | "browse">("view");
  const [selected, setSelected] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(submission: { choice: "pick"; slug: string; agreeFee: true } | { choice: "nexli" }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "ai_avatar", submission }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setLocal({ pick: submission.choice === "pick" ? submission.slug : null });
      setMode("view");
      setSelected(null);
      setAgree(false);
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const taken = new Set(avatar.taken);
  const choosable = (slug: string) => !avatar.locked && !taken.has(slug) && current?.slug !== slug;
  const choose = (slug: string) => {
    setMode("browse");
    setSelected(slug);
    setAgree(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {watching && (
        <VideoPopup
          slug={watching}
          canChoose={choosable(watching)}
          onChoose={() => {
            choose(watching);
            setWatching(null);
          }}
          onClose={() => setWatching(null)}
        />
      )}
      {/* ─── Who it is (or that we're choosing) ─── */}
      {current ? (
        <div className={`flex items-center gap-4 rounded-2xl p-3 sm:p-4 ${a.noteStrip}`}>
          <Portrait slug={current.slug} className="h-24 w-[54px] shrink-0 rounded-xl sm:h-28 sm:w-[63px]" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Your AI avatar</p>
            <p className="text-lg font-bold text-white">{avatarName(current.slug)}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">
              {current.source === "client"
                ? `You chose her · ${FEE} one-time, added to your first monthly invoice`
                : "Picked for your firm by Nexli · no charge"}
              {" · "}exclusive to your firm
            </p>
            <WatchButton slug={current.slug} onWatch={setWatching} className="mt-1 text-xs" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm font-bold text-white">Hey, we&apos;re selecting your AI avatar.</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            We&apos;ll pick one that fits your firm, and she&apos;s yours alone: no other Nexli client&apos;s ads use her.
          </p>
        </div>
      )}

      {avatar.locked ? (
        <p className="text-xs leading-relaxed text-neutral-400">
          Your avatar is locked in with your first monthly invoice. Message us if you&apos;d like to change it.
        </p>
      ) : mode === "view" ? (
        <div className="space-y-3">
          {pick ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setMode("browse")} className={SECONDARY_BTN}>
                Choose a different one
              </button>
              <button type="button" disabled={submitting} onClick={() => save({ choice: "nexli" })} className={SECONDARY_BTN}>
                {submitting ? "Saving…" : "Let Nexli choose instead (no charge)"}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-sm text-neutral-200">
                {current ? "Prefer a different one?" : "Do you want to choose one specifically from our library?"}{" "}
                <span className="font-semibold text-white">Let us know.</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {FEE} one-time, added to your first monthly invoice when your build is done.{" "}
                {current ? `Otherwise ${avatarName(current.slug)} stays yours at no charge.` : "Otherwise we choose one for you at no charge."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button type="button" onClick={() => setMode("browse")} className={CTA_CLASSES}>
                  Choose from our library →
                </button>
                <a
                  href={AVATAR_LIBRARY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center px-2 text-xs font-semibold text-cyan-300 hover:text-white"
                >
                  See the full library on nexli.net ↗
                </a>
              </div>
            </div>
          )}
          {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
        </div>
      ) : (
        /* ─── The library ─── */
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {selected ? "Confirm your avatar" : "Our AI avatar library"}
            </p>
            <button
              type="button"
              onClick={() => (selected ? setSelected(null) : setMode("view"))}
              className="min-h-10 px-2 text-xs font-semibold text-neutral-400 hover:text-white"
            >
              {selected ? "← Back to the library" : "Close"}
            </button>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-4">
                <Portrait slug={selected} className="h-36 w-[81px] shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white">{avatarName(selected)}</p>
                  <p className="text-xs font-semibold text-amber-200">Exclusive to your firm</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    <span className="font-bold text-white">{FEE} one-time</span>, added to your first monthly invoice when
                    your build is done. While you&apos;re with us, no other Nexli client&apos;s ads use her.
                  </p>
                  <WatchButton slug={selected} onWatch={setWatching} className="mt-2 text-xs" />
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-400"
                />
                <span className="text-xs leading-relaxed text-neutral-200">
                  I agree to the one-time {FEE} fee for {avatarName(selected)}, added to my first monthly invoice.
                </span>
              </label>
              {error && <p className="mt-2 text-xs font-semibold text-rose-400">{error}</p>}
              <button
                type="button"
                disabled={!agree || submitting}
                onClick={() => save({ choice: "pick", slug: selected, agreeFee: true })}
                className={`${CTA_CLASSES} mt-3 w-full sm:w-auto`}
              >
                {submitting ? "Saving…" : `Choose ${avatarName(selected)} →`}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 min-[520px]:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                {AI_AVATAR_ROSTER.map((r) => {
                  const isTaken = taken.has(r.slug);
                  const isYours = current?.slug === r.slug;
                  return (
                    <div
                      key={r.slug}
                      onMouseEnter={() => !isTaken && canHover() && setHovered(r.slug)}
                      onMouseLeave={() => setHovered((h) => (h === r.slug ? null : h))}
                      className={`group relative overflow-hidden rounded-2xl border transition ${
                        isTaken
                          ? "border-white/5 opacity-45"
                          : isYours
                            ? "border-cyan-400/60 ring-1 ring-cyan-400/40"
                            : "border-white/10 hover:-translate-y-0.5 hover:border-white/25"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={isTaken || isYours}
                        onClick={() => choose(r.slug)}
                        className="block w-full text-left disabled:cursor-not-allowed"
                        aria-label={isTaken ? `${r.name} (taken)` : `Choose ${r.name}`}
                      >
                        <Portrait slug={r.slug} className={`aspect-[3/4] w-full ${isTaken ? "grayscale" : ""}`} />
                        {hovered === r.slug && <HoverPreview slug={r.slug} />}
                        <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />
                        {(isTaken || isYours) && (
                          <span
                            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                              isTaken ? "bg-black/70 text-neutral-300" : "bg-cyan-400 text-[#020617]"
                            }`}
                          >
                            {isTaken ? "Taken" : "Yours"}
                          </span>
                        )}
                        <span className="absolute bottom-7 left-3 text-sm font-bold text-white">{r.name}</span>
                      </button>
                      <div className="absolute bottom-1 left-3">
                        <WatchButton slug={r.slug} onWatch={setWatching} label="Watch" className="text-[11px]" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500">
                Every avatar is AI-generated. Tap Watch to see her intro. Taken ones already belong to another firm.{" "}
                <a href={AVATAR_LIBRARY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 hover:text-white">
                  See the full library on nexli.net ↗
                </a>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
