"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { SYNE, ShimmerPill } from "@/components/launch-pad";
import { uploadFrameFile } from "@/components/creative-studio/upload";
import { Chip, ErrorStrip, GradientText, SP, STATUS_PILL, StudioCanvas, SvgIcon } from "@/components/creative-studio/canvas";
import { Composer, type ComposerSubmit } from "@/components/creative-studio/composer";

interface ProjectRow {
  id: string;
  title: string;
  format: CreativeFormat;
  status: string;
  direction: string;
  clips: number;
  thumbUrl: string | null;
  updatedAt: string;
}

const SUGGESTIONS = [
  "Belief-shift ad: C-P-A firms think they need more clients to grow — show the math on fewer, bigger planning clients.",
  "VSL for firms doing 750K–1M: why a tax-planning offer beats chasing returns, ending with booking a call.",
  "Selfie-style ad: Daniela talks straight to owners writing the I-R-S a seven-figure check.",
];

/**
 * Creative Studio home — like opening a new chat: one big box. Describe the
 * video, paste Daniela's frame if you have it, pick Ad or VSL, send.
 */
export function StudioHome() {
  const router = useRouter();
  const [format, setFormat] = useState<CreativeFormat>("ad_9x16");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [prefill, setPrefill] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/projects")
      .then((r) => r.json())
      .then((b) => !cancelled && setProjects(b?.projects ?? []))
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function start({ text, images, format: fmt }: ComposerSubmit): Promise<boolean> {
    if (!text && images.length === 0) return false;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/creative-studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: { direction: text }, format: fmt }),
      });
      const b = await r.json().catch(() => null);
      if (!r.ok || !b?.id) throw new Error(b?.error || "Couldn't start the video");
      if (images[0]) await uploadFrameFile(b.id, images[0], fmt === "ad_9x16");
      router.push(`/dashboard/creative-studio/${b.id}${text ? "?start=1" : ""}`);
      return true;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't start the video");
      return false;
    }
  }

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <div className="lp-card flex justify-center">
          <ShimmerPill>
            <SvgIcon d={SP.sparkles} size={14} className="text-cyan-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white md:text-xs">Creative Studio</span>
          </ShimmerPill>
        </div>
        <h1 className="lp-card mt-6 text-center text-4xl font-bold tracking-tighter text-white sm:text-5xl" style={{ ...SYNE, animationDelay: "0.05s" }}>
          What are we <GradientText>making?</GradientText>
        </h1>
        <p className="lp-card mx-auto mt-3 max-w-xl text-center text-sm text-neutral-400 sm:text-base" style={{ animationDelay: "0.1s" }}>
          Describe the video and paste Daniela&apos;s frame. Claude writes it with your Kling framework, you approve, Kling renders it.
        </p>

        <div className="lp-card mt-8" style={{ animationDelay: "0.15s" }}>
          <Composer
            key={seed}
            large
            autoFocus
            defaultText={prefill ?? undefined}
            placeholder="Describe the video — paste Daniela's frame if you have it"
            hint="Enter to start · Shift+Enter for a new line"
            busy={busy}
            allowFormat
            format={format}
            onFormat={setFormat}
            onSubmit={start}
          />
          {error && (
            <div className="mt-3">
              <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>
            </div>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPrefill(s);
                  setSeed((n) => n + 1);
                }}
                className="max-w-[260px] truncate rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400 transition-colors hover:border-blue-400/40 hover:text-white"
                title={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <section className="mt-16">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white" style={SYNE}>
              Recent videos
            </h2>
            {projects && projects.length > 0 && <span className="text-xs text-neutral-500">{projects.length}</span>}
          </div>
          {projects === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-neutral-500">Your videos will show up here.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {projects.map((p, i) => {
                const pill = STATUS_PILL[p.status] ?? STATUS_PILL.draft;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/creative-studio/${p.id}`}
                    className="lp-card group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.05]"
                    style={{ animationDelay: `${Math.min(0.4, 0.2 + i * 0.03)}s` }}
                  >
                    <div className="relative aspect-[4/3] bg-black">
                      {p.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img src={p.thumbUrl} alt="" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.04]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-600">
                          <SvgIcon d={SP.image} size={28} />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                      <span className="absolute right-2 top-2">
                        <Chip tone={pill.tone}>{pill.label}</Chip>
                      </span>
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white/80">
                        {p.format === "vsl_16x9" ? "VSL" : "Ad"} · {p.clips} clips
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold text-white">{p.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-500">{p.direction || "No direction yet"}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudioCanvas>
  );
}
