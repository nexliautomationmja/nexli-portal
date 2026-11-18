"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { AssistantCard, Chip, ErrorStrip, GradientText, HOOK_ICON, SP, StudioCanvas, StudioTabs, SvgIcon } from "@/components/creative-studio/canvas";
import { StudioSwitch } from "@/components/creative-studio/home";
import { hookTestHref, inStudioQs, studioHref } from "@/components/creative-studio/client";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { HOOK_UPLOAD_MAX_BYTES, HOOK_UPLOAD_TYPES, type HookTestRow } from "@/lib/creative-studio/hook-shared";
import type { StudioView } from "@/lib/creative-studio/studios";

/**
 * Hook Tester, start page: drop or paste a video, or pick one made in this
 * studio; below, the tests already run. A test opens on its own page.
 */

type StudioProp = Pick<StudioView, "key" | "kind" | "name">;

interface VideoRow {
  id: string;
  title: string;
  format: string;
  status: string;
  clips: number;
  thumbUrl: string | null;
  updatedAt: string;
}

const BASE = "/api/dashboard/creative-studio/hook-tests";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function HookTester({ studio }: { studio: StudioProp }) {
  const router = useRouter();
  const qs = inStudioQs(studio.key);
  const [tests, setTests] = useState<HookTestRow[] | null>(null);
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const working = useRef(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch(`${BASE}${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/dashboard/creative-studio/projects${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([t, v]) => {
      if (!alive) return;
      setTests(t?.tests ?? []);
      setVideos(v?.projects ?? []);
    });
    return () => {
      alive = false;
    };
  }, [qs]);

  const open = useCallback((id: string) => router.push(hookTestHref(studio.key, id)), [router, studio.key]);

  const startFromVideo = useCallback(
    async (v: VideoRow) => {
      if (working.current) return;
      working.current = true;
      setError(null);
      setBusy(`Starting on “${v.title}”…`);
      try {
        const d = await post(`${BASE}${qs}`, { action: "project", projectId: v.id });
        open(d.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the hook test.");
        setBusy(null);
        working.current = false;
      }
    },
    [open, qs]
  );

  const upload = useCallback(
    async (file: File) => {
      if (working.current) return;
      setError(null);
      const mime = file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.mp4$/i.test(file.name) ? "video/mp4" : "");
      if (!HOOK_UPLOAD_TYPES[mime]) return setError("Drop an MP4 or MOV video.");
      if (file.size > HOOK_UPLOAD_MAX_BYTES) return setError(`That file is ${Math.round(file.size / 1e6)} MB. Drop one under ${HOOK_UPLOAD_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).`);
      working.current = true;
      setBusy(`Uploading ${file.name}…`);
      try {
        const target = await post(`${BASE}${qs}`, { action: "sign", mime, size: file.size });
        await uploadToTarget(target, file, mime);
        const d = await post(`${BASE}${qs}`, { action: "upload", path: target.path, mime, filename: file.name, size: file.size });
        open(d.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        setBusy(null);
        working.current = false;
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [open, qs]
  );

  // A video pasted anywhere on the page starts a test.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name));
      if (!file) return;
      e.preventDefault();
      void upload(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  async function remove(id: string) {
    setRemoving(null);
    const r = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!r.ok) return setError("Couldn't remove that test.");
    setTests((t) => (t ?? []).filter((x) => x.id !== id));
  }

  // Videos whose clips are all made: the ones a new hook can be swapped into.
  const ready = (videos ?? []).filter((v) => v.status === "clips_ready" && v.clips > 1);
  const shown = showAll ? ready : ready.slice(0, 12);

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <header className="lp-card flex justify-center pb-2 pt-8 sm:pt-12">
          <div className="flex max-w-full flex-col items-center gap-4">
            <StudioSwitch studio={studio} />
            <StudioTabs active="hooks" studioKey={studio.key} />
          </div>
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl" style={SYNE}>
              Find the hook <GradientText>that wins.</GradientText>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
              Give me a video. I write the three hooks most worth testing against the one it has. For a video made here, Kling makes only the new hook clip, you pick the strongest, and the rest of the video is reused.
            </p>
          </div>

          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          <AssistantCard accent="blue" icon={HOOK_ICON} title="Start with a video">
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void upload(f);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition disabled:opacity-60 ${
                over ? "border-cyan-300 bg-cyan-500/10" : "border-white/15 bg-black/20 hover:border-cyan-400/50 hover:bg-white/[0.04]"
              }`}
            >
              {busy ? (
                <>
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
                  <span className="text-sm font-semibold text-white">{busy}</span>
                </>
              ) : (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/30">
                    <SvgIcon d={SP.upload} size={20} />
                  </span>
                  <span className="text-sm font-bold text-white">Drop or paste a video</span>
                  <span className="text-xs text-neutral-400">Any ad or VSL, yours or not. MP4 or MOV, up to {HOOK_UPLOAD_MAX_BYTES / 1024 / 1024} MB.</span>
                </>
              )}
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
              <span className="h-px flex-1 bg-white/10" />
              or pick a video made in this studio
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {videos === null ? (
              <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
            ) : ready.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-center text-sm text-neutral-400">
                No finished videos here yet. A video shows up once Kling has made all of its clips.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {shown.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void startFromVideo(v)}
                      title={`Test new hooks for “${v.title}”`}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-black text-left transition hover:border-cyan-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:opacity-50"
                    >
                      <div className="aspect-[9/16]">
                        {v.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                          <img src={v.thumbUrl} alt="" className={`h-full w-full ${v.format === "vsl_16x9" ? "object-contain" : "object-cover"}`} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-600">
                            <SvgIcon d={SP.film} size={22} />
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 pt-8">
                        <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">{v.title}</p>
                        <p className="mt-0.5 text-[10px] text-neutral-400" style={NUM_FONT}>
                          {v.clips} clips · {when(v.updatedAt)}
                        </p>
                      </div>
                      <span className="absolute right-1.5 top-1.5 hidden rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-black text-[#04121f] group-hover:block">Test hooks</span>
                    </button>
                  ))}
                </div>
                {ready.length > shown.length && (
                  <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-xs font-bold text-cyan-300 hover:text-white">
                    Show all {ready.length} videos
                  </button>
                )}
              </>
            )}
          </AssistantCard>

          <AssistantCard accent="violet" icon={SP.sparkles} title="Your hook tests" right={tests?.length ? <Chip>{tests.length}</Chip> : null} delay={0.05}>
            {tests === null ? (
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            ) : tests.length === 0 ? (
              <p className="text-sm text-neutral-400">Nothing yet. Your first test shows up here.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {tests.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <Link href={hookTestHref(studio.key, t.id)} className="group flex min-w-0 flex-1 items-center gap-3">
                      <span className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                        {t.thumbUrl && <img src={t.thumbUrl} alt="" className="h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white group-hover:text-cyan-200">{t.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Chip>{t.source === "project" ? "Made here" : "Dropped in"}</Chip>
                          {t.status === "failed" ? (
                            <Chip tone="red">Didn&apos;t finish</Chip>
                          ) : t.status !== "ready" ? (
                            <Chip tone="blue">Writing…</Chip>
                          ) : (
                            <Chip tone="blue">
                              {t.hooks} hook{t.hooks === 1 ? "" : "s"}
                            </Chip>
                          )}
                          {t.made > 0 && (
                            <Chip tone="green">
                              {t.made} video{t.made === 1 ? "" : "s"} made
                            </Chip>
                          )}
                          <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                            {when(t.createdAt)}
                          </span>
                        </span>
                      </span>
                    </Link>
                    {removing === t.id ? (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => void remove(t.id)} className="min-h-9 rounded-full bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500">
                          Remove
                        </button>
                        <button type="button" onClick={() => setRemoving(null)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-bold text-neutral-300 hover:text-white">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemoving(t.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/5 hover:text-rose-300"
                        aria-label={`Remove the hook test for ${t.title}`}
                        title="Remove this test (videos made from it stay)"
                      >
                        <SvgIcon d={SP.trash} size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AssistantCard>

          <p className="text-center text-xs text-neutral-500">
            Nothing is sent to Kling until you say so on the test&apos;s page.{" "}
<Link href={studioHref(studio.key)} className="font-bold text-cyan-300 hover:text-white">
              Make a new video instead
            </Link>
          </p>
        </div>
      </div>
    </StudioCanvas>
  );
}
