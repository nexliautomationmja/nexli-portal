"use client";

import { useState } from "react";
import { ACCENT, CTA_CLASSES, SECONDARY_BTN, type Accent } from "./primitives";
import { AI_AVATAR_ROSTER, AVATAR_LIBRARY_URL, avatarName, avatarPageUrl, portraitUrl } from "@/lib/ai-avatar-roster";
import { asAvatarChoice, feeText } from "@/lib/ai-avatar-choice";
import { AI_AVATAR_PICK_CENTS } from "@/lib/drs-pricing";

// ══════════════════════════════════════════════════════════
// "Your AI Avatar" on the client's Launch Pad (Nov 16 2026). By default
// Nexli is selecting the firm's avatar (free). The client can choose a
// specific one from the library instead: $2,500 one-time on their first
// monthly invoice. Avatars other firms hold show as Taken. Locked once the
// first monthly invoice has gone out.
// ══════════════════════════════════════════════════════════

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

function IntroLink({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <a
      href={avatarPageUrl(slug)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-white ${className}`}
    >
      Watch her intro <span aria-hidden="true">↗</span>
    </a>
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

  return (
    <div className="space-y-4">
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
            <IntroLink slug={current.slug} className="mt-1 text-xs" />
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
                  <IntroLink slug={selected} className="mt-2 text-xs" />
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
                        onClick={() => {
                          setSelected(r.slug);
                          setAgree(false);
                          setError(null);
                        }}
                        className="block w-full text-left disabled:cursor-not-allowed"
                        aria-label={isTaken ? `${r.name} (taken)` : `Choose ${r.name}`}
                      >
                        <Portrait slug={r.slug} className={`aspect-[3/4] w-full ${isTaken ? "grayscale" : ""}`} />
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
                      <div className="absolute bottom-2 left-3">
                        <IntroLink slug={r.slug} className="text-[11px]" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500">
                Every avatar is AI-generated. Taken ones already belong to another firm.{" "}
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
