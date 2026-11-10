"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { SYNE } from "@/components/launch-pad";
import { uploadFrameFile } from "@/components/creative-studio/upload";
import { Chip, ErrorStrip, GradientText, SP, STATUS_PILL, StudioCanvas, StudioTabs, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { Composer, type ComposerSubmit } from "@/components/creative-studio/composer";
import { BatchPlanCard, type BatchPlan, type ManusMode } from "@/components/creative-studio/batch-plan-card";
import { META_LIME, MetaChip, MetaLogo } from "@/components/creative-studio/meta";
import { assignFrames, BATCH_MAX } from "@/lib/creative-studio/batch-shared";
import { useIsTouch } from "@/lib/use-media";
import { inStudioQs, studioHref } from "@/components/creative-studio/client";
import type { StudioView } from "@/lib/creative-studio/studios";

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
  /** Best video to preview on hover (final render > final cut > auto-cut > first clip). */
  previewUrl: string | null;
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

/** Starters for a client firm's studio: the firm's own ads to its own prospects. */
const CLIENT_SUGGESTIONS = [
  "Belief-shift ad: business owners think a big tax bill is just the cost of success — show what year-round planning keeps.",
  "VSL: why owners who only see their C-P-A at tax time overpay, ending with booking a planning call.",
  "Selfie-style ad: straight talk to owners who just wrote the I-R-S a six-figure check.",
];

/**
 * Creative Studio home — like opening a new chat: one big box. Describe the
 * video, paste the frame if you have it, pick Ad or VSL, send. Everything
 * here belongs to one studio (Nexli's own, or a client firm's).
 */
export function StudioHome({ studio }: { studio: StudioView }) {
  const qs = inStudioQs(studio.key);
  const client = studio.kind === "client";
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
  // A client studio's Manus frames need its own reference pictures (who presents isn't decided yet).
  const [clientRefs, setClientRefs] = useState<number | null>(null);
  const manus: ManusMode = !client ? "daniela" : clientRefs ? "studio" : "off";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/creative-studio/projects${qs}`)
      .then((r) => r.json())
      .then((b) => !cancelled && setProjects(b?.projects ?? []))
      .catch(() => !cancelled && setProjects([]));
    fetch(`/api/dashboard/creative-studio/batches${qs}`)
      .then((r) => r.json())
      .then((b) => !cancelled && setBatches(b?.batches ?? []))
      .catch(() => {});
    if (client) {
      fetch(`/api/dashboard/creative-studio/references${qs}`)
        .then((r) => r.json())
        .then((b) => !cancelled && setClientRefs(Array.isArray(b?.references) ? b.references.length : 0))
        .catch(() => !cancelled && setClientRefs(0));
    }
    return () => {
      cancelled = true;
    };
  }, [qs, client]);

  function changeFormat(f: CreativeFormat) {
    setFormat(f);
    setCount((n) => Math.min(n, BATCH_MAX[f]));
  }

  // Sent from the Ads tab ("Make N videos"): the refresh brief and count, filled in once.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const brief = q.get("brief");
    if (!brief) return;
    const f = q.get("format") === "vsl_16x9" ? "vsl_16x9" : "ad_9x16";
    const n = Math.max(1, Math.min(BATCH_MAX[f], Number(q.get("count")) || 1));
    setFormat(f);
    setCount(n);
    setPrefill(brief.slice(0, 1800));
    setSeed((x) => x + 1);
    const u = new URL(window.location.href);
    ["brief", "count", "format", "from", "step"].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState(null, "", u.toString());
  }, []);

  /** Claude splits the idea into `n` videos; frames are handed out in order (Manus for the rest). */
  async function planBatch(brief: string, fmt: CreativeFormat, n: number, frames: BatchPlan["frames"], keep?: Pick<BatchPlan, "cover" | "random">) {
    setError(null);
    setPlanning(`Claude is planning ${n} ${fmt === "vsl_16x9" ? "VSLs" : "ads"}…`);
    try {
      const r = await fetch(`/api/dashboard/creative-studio/batches/plan${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, format: fmt, count: n }),
      });
      const b = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(b?.videos)) throw new Error(b?.error || "Couldn't plan the batch");
      const videos = b.videos as { title: string; direction: string; shot: string }[];
      // No Manus here yet: the pasted frames cover every video.
      const cover = manus === "off" ? "all" : (keep?.cover ?? "rest");
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
      const r = await fetch(`/api/dashboard/creative-studio/batches${qs}`, {
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
      const r = await fetch(`/api/dashboard/creative-studio/projects${qs}`, {
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
        <div className="lp-card mb-5 flex justify-center">
          <StudioSwitch studio={studio} />
        </div>
        <div className="lp-card flex justify-center">
          <StudioTabs active="videos" studioKey={studio.key} />
        </div>
        <h1 className="lp-card mt-6 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl" style={{ ...SYNE, animationDelay: "0.05s" }}>
          What are we <GradientText>making?</GradientText>
        </h1>
        <p className="lp-card mx-auto mt-3 max-w-xl text-center text-sm text-neutral-400 sm:text-base" style={{ animationDelay: "0.1s" }}>
          {client ? (
            <>
              Describe the video and paste the frame. Claude writes it for <b className="text-white">{studio.name}</b> with your Kling framework, you approve, Kling renders it.
            </>
          ) : (
            <>Describe the video and paste Daniela&apos;s frame. Claude writes it with your Kling framework, you approve, Kling renders it.</>
          )}
        </p>
        {client && !studio.hasAbout && (
          <p className="lp-card mx-auto mt-4 max-w-xl rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-100" style={{ animationDelay: "0.12s" }}>
            Tell Claude what {studio.name} offers, who they serve and the call to action, so scripts and copy sell the right thing.{" "}
            <Link href={`/dashboard/creative-studio?edit=${encodeURIComponent(studio.key)}`} className="font-bold text-white underline underline-offset-2">
              Add “About this firm”
            </Link>
          </p>
        )}

        <div className="lp-card mt-8" style={{ animationDelay: "0.15s" }}>
          <Composer
            key={seed}
            large
            autoFocus
            defaultText={prefill ?? undefined}
            placeholder={
              count > 1
                ? `Describe the batch, e.g. “${count} ${format === "vsl_16x9" ? "VSLs" : "ads"} on scope creep” — paste frames if you have them`
                : client
                  ? "Describe the video — paste the frame if you have it"
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
                manus={manus}
                busy={creating}
                onChange={setPlan}
                onReplan={() => void planBatch(plan.brief, plan.format, plan.items.length, plan.frames, { cover: plan.cover, random: plan.random })}
                onCancel={dropPlan}
                onCreate={() => void createBatch()}
              />
            </div>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(client ? CLIENT_SUGGESTIONS : SUGGESTIONS).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPrefill(s);
                  setSeed((n) => n + 1);
                }}
                className="max-w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[11px] text-neutral-400 transition-colors hover:border-blue-400/40 hover:text-white sm:max-w-[260px] sm:truncate sm:rounded-full"
                title={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <AdCopyFeature href={studioHref(studio.key, "adcopy")} />

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
                    <p className="mt-1 truncate text-[11px] text-neutral-400">{b.titles.join(" · ")}</p>
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
            <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-neutral-400">Your videos will show up here.</p>
          ) : (
            // Masonry columns, so tall 9:16 ads and wide 16:9 VSLs sit together without gaps.
            <div className="columns-2 gap-3 sm:columns-3">
              {projects.map((p, i) => (
                <ProjectCard key={p.id} p={p} delay={Math.min(0.4, 0.2 + i * 0.03)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioCanvas>
  );
}

/** Meta Ad Copy, shown on the studio home so it's easy to find (lime, like the nexli.net Meta chip). */
function AdCopyFeature({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="lp-card group relative mt-8 block overflow-hidden rounded-3xl border border-lime-300/20 bg-gradient-to-br from-lime-400/[0.10] via-[#0b1220] to-emerald-500/[0.06] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-lime-300/50 hover:shadow-2xl hover:shadow-lime-500/15 sm:mt-12 sm:p-7"
      style={{ animationDelay: "0.2s" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-lime-400/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <MetaChip>Meta Ad Copy</MetaChip>
          <h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:mt-4 sm:text-3xl" style={SYNE}>
            Drop in your creatives.{" "}
            <span className="bg-gradient-to-r from-lime-200 via-lime-300 to-lime-400 bg-clip-text text-transparent">Get the copy.</span>
          </h3>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-neutral-400 sm:text-sm">
            One creative or <b className="text-white">up to 20 at once</b>. I listen to each video (or read each image) and write{" "}
            <b className="text-white">4 primary texts</b> and <b className="text-white">4 headlines</b> for Meta, in your style.
          </p>
          <span
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 sm:mt-5 sm:inline-flex sm:w-auto text-sm font-bold text-[#0a0f1c] shadow-lg shadow-lime-500/30 transition-shadow group-hover:shadow-lime-400/50"
            style={{ background: META_LIME }}
          >
            Open Meta Ad Copy <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>
        <AdCopyArt />
      </div>
    </Link>
  );
}

/** Two mini feed posts and the four versions, drawn with divs. */
function AdCopyArt() {
  return (
    <div aria-hidden="true" className="relative hidden h-48 w-64 sm:block">
      <div className="absolute left-0 top-6 w-36 -rotate-6 rounded-xl border border-white/10 bg-[#0f172a] p-2 shadow-xl" style={{ animation: "lp-float 6s ease-in-out infinite" }}>
        <MiniPost tone="from-blue-600/50 to-cyan-500/30" />
      </div>
      <div
        className="absolute right-0 top-0 w-40 rotate-3 rounded-xl border border-lime-300/30 bg-[#111a2e] p-2 shadow-2xl shadow-lime-900/40"
        style={{ animation: "lp-float 5s ease-in-out 0.6s infinite" }}
      >
        <MiniPost tone="from-lime-500/60 to-emerald-600/40" />
      </div>
      {["V1", "V2", "V3", "V4"].map((v, i) => (
        <span
          key={v}
          className="absolute bottom-0 rounded-full border border-lime-300/30 bg-lime-400/15 px-2 py-0.5 text-[10px] font-black text-lime-200 shadow-lg backdrop-blur"
          style={{ left: `${6 + i * 24}%`, animation: `lp-float ${4 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}
        >
          {v}
        </span>
      ))}
      <span className="absolute -top-2 left-24 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0a0f1c] shadow-lg" style={{ animation: "lp-float 4.5s ease-in-out 0.2s infinite" }}>
        <MetaLogo className="h-auto w-[18px]" />
      </span>
    </div>
  );
}

function MiniPost({ tone }: { tone: string }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logos/nexli-avatar.png" alt="" className="h-4 w-4 rounded-full" />
        <span className="h-1.5 w-10 rounded bg-white/40" />
      </div>
      <div className="mt-2 space-y-1">
        <span className="block h-1.5 w-full rounded bg-white/25" />
        <span className="block h-1.5 w-4/5 rounded bg-white/20" />
        <span className="block h-1.5 w-3/5 rounded bg-white/15" />
      </div>
      <div className={`relative mt-2 aspect-[4/3] rounded-md bg-gradient-to-br ${tone}`}>
        <span className="absolute inset-0 m-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/90 pl-0.5 text-[9px] text-black">▶</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="h-1.5 w-14 rounded bg-white/30" />
        <span className="rounded bg-white/15 px-1.5 py-0.5 text-[7px] font-bold text-white">Book Now</span>
      </div>
    </>
  );
}

/**
 * A recent video in its own shape (9:16 ad, 16:9 VSL). Hovering plays a muted
 * preview in place; the video only loads on hover, so the grid stays light.
 * On a phone there's no hover: tap ▶ to preview in place, tap the card to open.
 */
function ProjectCard({ p, delay }: { p: ProjectRow; delay: number }) {
  const touch = useIsTouch();
  const [hover, setHover] = useState(false);
  const [ready, setReady] = useState(false);
  const pill = STATUS_PILL[p.status] ?? STATUS_PILL.draft;
  const vsl = p.format === "vsl_16x9";
  const aspect = vsl ? "aspect-video" : "aspect-[9/16]";
  const playIcon = (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
      {hover ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />}
    </svg>
  );
  return (
    <div className="relative mb-3 break-inside-avoid">
    <Link
      href={`/dashboard/creative-studio/${p.id}`}
      // No mouse handlers on touch: iOS treats a tap that changes the card as a hover and swallows the click.
      onMouseEnter={touch ? undefined : () => setHover(true)}
      onMouseLeave={
        touch
          ? undefined
          : () => {
              setHover(false);
              setReady(false);
            }
      }
      className="lp-card group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-blue-600/10"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`relative bg-black ${aspect}`}>
        {p.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={p.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600">
            <SvgIcon d={SP.image} size={28} />
          </div>
        )}
        {hover && p.previewUrl && (
          <video
            src={p.previewUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            onPlaying={() => setReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />
        {/* One wrapping row, so the two chips stack instead of overlapping on narrow cards. */}
        <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1">
          {p.batchId && <Chip>Batch</Chip>}
          <span className="ml-auto">
            <Chip tone={pill.tone}>{pill.label}</Chip>
          </span>
        </div>
        {p.previewUrl && !touch && (
          <span
            className={`absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-opacity duration-300 ${
              hover ? "opacity-0" : "opacity-80"
            }`}
            aria-hidden="true"
          >
            {playIcon}
          </span>
        )}
        {!touch && hover && p.previewUrl && !ready && (
          <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
        )}
        <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white/85">
          {vsl ? "VSL · 16:9" : "Ad · 9:16"} · {p.clips} clips
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-white">{p.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">{p.direction || "No direction yet"}</p>
      </div>
    </Link>
    {touch && p.previewUrl && (
      // Beside the link (not inside it), over the middle of the video.
      <div className={`pointer-events-none absolute inset-x-px top-px flex items-center justify-center ${aspect}`}>
        <button
          type="button"
          onClick={() => {
            setHover((h) => !h);
            setReady(false);
          }}
          aria-label={hover ? "Stop the preview" : "Play a preview"}
          className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-opacity ${hover && ready ? "opacity-40" : "opacity-90"}`}
        >
          {hover && !ready ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" /> : playIcon}
        </button>
      </div>
    )}
    </div>
  );
}

/**
 * Which studio you're in, as a pill above the tabs. Tapping it goes back to
 * the picker ("What creative studio are we going for?").
 */
export function StudioSwitch({ studio, compact = false }: { studio: Pick<StudioView, "key" | "kind" | "name">; compact?: boolean }) {
  const client = studio.kind === "client";
  return (
    <Link
      href="/dashboard/creative-studio"
      className={`group inline-flex max-w-full items-center gap-2 rounded-full border bg-white/[0.04] text-left transition-colors hover:bg-white/[0.08] ${
        client ? "border-violet-400/30 hover:border-violet-300/60" : "border-cyan-400/30 hover:border-cyan-300/60"
      } ${compact ? "min-h-8 px-2.5 py-1" : "min-h-10 py-1.5 pl-1.5 pr-3.5"}`}
      title="Switch studio"
    >
      {!compact && (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${
            client ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" : "bg-gradient-to-br from-blue-600 to-cyan-500"
          }`}
        >
          {studio.name.trim().charAt(0).toUpperCase() || "S"}
        </span>
      )}
      <span className="min-w-0 truncate text-xs font-bold text-white">
        {client ? studio.name : "Nexli"} <span className="font-semibold text-neutral-400">studio</span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-neutral-500 group-hover:text-white">⇄ Switch</span>
    </Link>
  );
}
