"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { SYNE, ShimmerPill } from "@/components/launch-pad";
import { uploadFrameFile } from "@/components/creative-studio/upload";
import { Chip, ErrorStrip, GradientText, SP, STATUS_PILL, StudioCanvas, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { Composer, type ComposerSubmit } from "@/components/creative-studio/composer";
import { BatchPlanCard, type BatchPlan } from "@/components/creative-studio/batch-plan-card";
import { assignFrames, BATCH_MAX } from "@/lib/creative-studio/batch-shared";

interface ProjectRow {
  id: string;
  title: string;
  format: CreativeFormat;
  status: string;
  direction: string;
  clips: number;
  thumbUrl: string | null;
  updatedAt: string;
  batchId: string | null;
}

interface BatchRow {
  id: string;
  format: CreativeFormat;
  count: number;
  brief: string;
  titles: string[];
  scripted: number;
  rendering: number;
  clipsReady: number;
  createdAt: string;
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
  const [count, setCount] = useState(1);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [plan, setPlan] = useState<BatchPlan | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/projects")
      .then((r) => r.json())
      .then((b) => !cancelled && setProjects(b?.projects ?? []))
      .catch(() => !cancelled && setProjects([]));
    fetch("/api/dashboard/creative-studio/batches")
      .then((r) => r.json())
      .then((b) => !cancelled && setBatches(b?.batches ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function changeFormat(f: CreativeFormat) {
    setFormat(f);
    setCount((n) => Math.min(n, BATCH_MAX[f]));
  }

  /** Claude splits the idea into `n` videos; frames are handed out in order (Manus for the rest). */
  async function planBatch(brief: string, fmt: CreativeFormat, n: number, frames: BatchPlan["frames"], keep?: Pick<BatchPlan, "cover" | "random">) {
    setError(null);
    setPlanning(`Claude is planning ${n} ${fmt === "vsl_16x9" ? "VSLs" : "ads"}…`);
    try {
      const r = await fetch("/api/dashboard/creative-studio/batches/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, format: fmt, count: n }),
      });
      const b = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(b?.videos)) throw new Error(b?.error || "Couldn't plan the batch");
      const videos = b.videos as { title: string; direction: string; shot: string }[];
      const cover = keep?.cover ?? "rest";
      const random = keep?.random ?? false;
      const assigned = assignFrames(videos.length, frames.length, cover, random);
      setPlan({ format: fmt, brief, notes: b.notes ?? "", frames, cover, random, items: videos.map((v, i) => ({ ...v, frame: assigned[i] })) });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan the batch");
      return false;
    } finally {
      setPlanning(null);
    }
  }

  function dropPlan() {
    plan?.frames.forEach((f) => URL.revokeObjectURL(f.url));
    setPlan(null);
  }

  /** Create the batch and its videos, upload each assigned pasted frame, then open the batch page. */
  async function createBatch() {
    if (!plan) return;
    setCreating("Creating the videos…");
    setError(null);
    try {
      const r = await fetch("/api/dashboard/creative-studio/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: plan.format, brief: plan.brief, items: plan.items }),
      });
      const b = await r.json().catch(() => null);
      if (!r.ok || !b?.id) throw new Error(b?.error || "Couldn't create the batch");
      const projectsCreated = b.projects as { id: string; index: number }[];
      const uploads = projectsCreated.filter((p) => plan.items[p.index]?.frame !== null && plan.items[p.index]?.frame !== undefined);
      for (let i = 0; i < uploads.length; i++) {
        setCreating(`Adding your frames · ${i + 1} of ${uploads.length}…`);
        const frame = plan.frames[plan.items[uploads[i].index].frame as number];
        if (frame) await uploadFrameFile(uploads[i].id, frame.file, plan.format === "ad_9x16");
      }
      router.push(`/dashboard/creative-studio/batch/${b.id}`);
    } catch (err) {
      setCreating(null);
      setError(err instanceof Error ? err.message : "Couldn't create the batch");
    }
  }

  async function start({ text, images, format: fmt, count: n }: ComposerSubmit): Promise<boolean> {
    if (n > 1) {
      if (!text) {
        setError("Describe what the batch is about, e.g. “5 ads on scope creep”.");
        return false;
      }
      if (plan) dropPlan();
      const frames = images.slice(0, n).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return planBatch(text, fmt, n, frames);
    }
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
        <div className="lp-card flex flex-wrap items-center justify-center gap-3">
          <ShimmerPill>
            <SvgIcon d={SP.sparkles} size={14} className="text-cyan-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white md:text-xs">Creative Studio</span>
          </ShimmerPill>
          <Link
            href="/dashboard/creative-studio/ad-copy"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-500/25 hover:text-white"
            title="Drop any video or image and get 4 primary texts and 4 headlines"
          >
            ✍️ Ad copy
          </Link>
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
            placeholder={
              count > 1
                ? `Describe the batch, e.g. “${count} ${format === "vsl_16x9" ? "VSLs" : "ads"} on scope creep” — paste frames if you have them`
                : "Describe the video — paste Daniela's frame if you have it"
            }
            hint={count > 1 ? "Enter → Claude plans the batch for you to review" : "Enter to start · Shift+Enter for a new line"}
            busy={busy || Boolean(planning) || Boolean(creating)}
            allowFormat
            format={format}
            onFormat={changeFormat}
            count={count}
            onCount={setCount}
            maxCount={BATCH_MAX[format]}
            onSubmit={start}
          />
          {error && (
            <div className="mt-3">
              <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>
            </div>
          )}
          {planning && (
            <div className="mt-4">
              <ThinkingCard accent="violet" label={planning} detail="Different angles and hooks from your idea, with a frame shot for each. About a minute." />
            </div>
          )}
          {plan && !planning && (
            <div className="mt-4">
              <BatchPlanCard
                plan={plan}
                busy={creating}
                onChange={setPlan}
                onReplan={() => void planBatch(plan.brief, plan.format, plan.items.length, plan.frames, { cover: plan.cover, random: plan.random })}
                onCancel={dropPlan}
                onCreate={() => void createBatch()}
              />
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

        {batches.length > 0 && (
          <section className="mt-16">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white" style={SYNE}>
                Batches
              </h2>
              <span className="text-xs text-neutral-500">{batches.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {batches.map((b) => {
                const noun = b.format === "vsl_16x9" ? "VSLs" : "ads";
                const progress = [
                  b.scripted ? `${b.scripted} script${b.scripted > 1 ? "s" : ""} ready` : "",
                  b.rendering ? `${b.rendering} on Kling` : "",
                  b.clipsReady ? `${b.clipsReady} clips ready` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link
                    key={b.id}
                    href={`/dashboard/creative-studio/batch/${b.id}`}
                    className="lp-card rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Chip tone="blue">
                        Batch · {b.count} {noun}
                      </Chip>
                      <span className="text-[10px] text-neutral-500">{new Date(b.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{b.brief}</p>
                    <p className="mt-1 truncate text-[11px] text-neutral-500">{b.titles.join(" · ")}</p>
                    {progress && <p className="mt-2 text-[11px] font-semibold text-cyan-200">{progress}</p>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className={batches.length > 0 ? "mt-10" : "mt-16"}>
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
                      {p.batchId && (
                        <span className="absolute left-2 top-2">
                          <Chip>Batch</Chip>
                        </span>
                      )}
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
