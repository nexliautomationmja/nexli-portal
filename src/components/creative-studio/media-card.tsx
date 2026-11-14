"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { uploadMedia } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { presenterName, stableUrl } from "@/components/creative-studio/source-card";
import { clock } from "@/lib/creative-studio/reaction-shared";

type Media = NonNullable<ProjectDetail["media"]>;
type Item = Media["items"][number];
type Step = "analyze" | "proxy";

/** Requests preparing clips at once (each can run for minutes). */
const PARALLEL = 3;
const ONSCREEN_MAX = 10;

const stepsFor = (mode: Media["mode"]): Step[] => (mode === "recreate" ? ["analyze"] : ["analyze", "proxy"]);
const stepDone = (it: Item, step: Step) => (step === "analyze" ? it.analyzed : Boolean(it.proxyUrl));
const stepError = (it: Item, step: Step) => (step === "analyze" ? it.analyzeError : it.proxyError);

/**
 * Videos uploaded to show on screen (clip 1…10) or one video to recreate. It
 * gets each ready — the stills and words Claude reads, plus the light copy
 * the edit plays for clips shown on screen — a few requests at a time, and
 * picks them up again after a reload. For a video to recreate it also starts
 * Manus on its look once it's read (tap another still to try that one).
 */
export function MediaCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const media = detail.media;
  const changeable = ["draft", "scripted"].includes(p.status);
  const [busy, setBusy] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const inFlight = useRef(new Set<string>());
  const lookStarted = useRef<string | null>(null);

  // Start the steps that aren't done, failed or running elsewhere (a few at a time); check back while any run.
  useEffect(() => {
    if (!media) return;
    const pending = media.items.flatMap((it) => stepsFor(media.mode).filter((step) => !stepDone(it, step) && !stepError(it, step)).map((step) => ({ it, step })));
    for (const { it, step } of pending) {
      const key = `${it.id}:${step}`;
      if (it.running[step] || inFlight.current.has(key) || inFlight.current.size >= PARALLEL) continue;
      inFlight.current.add(key);
      void send(api(`${p.id}/source/prepare`), "POST", { step, assetId: it.id }).then((r) => {
        inFlight.current.delete(key);
        if (r.ok) onChange(r.data);
        else onError(r.error);
      });
    }
    if (pending.length === 0) return;
    const t = setInterval(async () => {
      const r = await send(api(p.id), "GET");
      if (r.ok) onChange(r.data);
    }, 8000);
    return () => clearInterval(t);
  }, [media, p.id, onChange, onError]);

  // A video to recreate, once read: Manus makes its look with this video's presenter (once, while there's no frame yet).
  const reference = media?.mode === "recreate" ? media.items[0] : undefined;
  useEffect(() => {
    if (!reference?.analyzed || reference.stills.length === 0 || !changeable) return;
    if (detail.frames.length > 0 || detail.manus.length > 0 || lookStarted.current === reference.id) return;
    lookStarted.current = reference.id;
    void send(api(`${p.id}/frame/generate`), "POST", { referenceStill: 0 }).then((r) => {
      if (r.ok) onChange(r.data);
      else onError(r.error);
    });
  }, [reference, changeable, detail.frames.length, detail.manus.length, p.id, onChange, onError]);

  async function retry(it: Item, step: Step) {
    setBusy(step === "analyze" ? "Reading the video again…" : "Making the light copy again…");
    const r = await send(api(`${p.id}/source/prepare`), "POST", { step, assetId: it.id });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function add(files: File[]) {
    if (!media || files.length === 0) return;
    const recreate = media.mode === "recreate";
    const room = recreate ? 1 : ONSCREEN_MAX - media.items.length;
    if (room <= 0) return onError(`A video can show up to ${ONSCREEN_MAX} clips on screen.`);
    if (detail.clips.length > 0 && !confirm(recreate ? "Replace the video to recreate? The script was written for this one, so you'll rewrite it afterwards." : "Add these clips? The script was written for the old set, so you'll rewrite it afterwards.")) return;
    setBusy(recreate ? "Uploading the video…" : files.length > 1 ? `Uploading ${Math.min(room, files.length)} clips…` : "Uploading the clip…");
    try {
      onChange(await uploadMedia(p.id, files.slice(0, room), media.mode, recreate));
      if (recreate) lookStarted.current = null;
    } catch (err) {
      onError(err instanceof Error ? err.message : "The upload failed");
    }
    setBusy(null);
  }

  async function remove(it: Item, n: number) {
    const last = media?.items.length === 1;
    if (!confirm(last ? "Remove this video? It becomes a normal video." : `Remove clip ${n}? The clips after it move up a number.`)) return;
    setBusy("Removing…");
    const r = await send(`${api(`${p.id}/media`)}?assetId=${encodeURIComponent(it.id)}`, "DELETE");
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function makeLook(i: number) {
    setBusy("Starting Manus…");
    const r = await send(api(`${p.id}/frame/generate`), "POST", { referenceStill: i });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setTimeout(() => document.getElementById("stage-frame")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else onError(r.error);
  }

  if (!media) return null;
  const recreate = media.mode === "recreate";
  const ready = media.items.length > 0 && media.items.every((it) => it.ready);
  const failed = media.items.some((it) => it.analyzeError || it.proxyError);
  const outdated = detail.clips.length > 0 && media.scriptFor !== media.items.map((it) => it.id).join();
  const manusBusy = detail.manus.some((t) => t.status === "running" || t.status === "waiting");

  return (
    <AssistantCard
      id="stage-source"
      accent={recreate ? "violet" : "cyan"}
      icon={SP.film}
      title={recreate ? "The video to recreate" : `Clips on screen · ${media.items.length}`}
      right={<Chip tone={failed ? "red" : ready ? "green" : "blue"}>{failed ? "Needs a look" : ready ? "Ready" : "Getting them ready"}</Chip>}
    >
      <p className="mb-3 text-xs leading-relaxed text-neutral-400">
        {recreate
          ? `Claude copies its structure, hook and pacing for your offer (never its words), and Manus recreates its look with ${presenterName(p)}.`
          : `Claude watches every clip and writes the script around them; the edit shows each one on its line, the way your prompt describes (full screen, split, or ${presenterName(p)} in the corner).`}
      </p>
      {outdated && (
        <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {recreate ? "The video changed since the script was written." : "The clips changed since the script was written."} Rewrite the script for {recreate ? "it" : "them"} before approving.
        </p>
      )}

      <div className={recreate ? "" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
        {media.items.map((it, i) => {
          const playUrl = stableUrl(`media:${it.id}:${it.proxyUrl ? "proxy" : "file"}`, it.proxyUrl ?? it.url);
          const aspect = it.width && it.height ? `${it.width} / ${it.height}` : "9 / 16";
          const itemFailed = Boolean(it.analyzeError || it.proxyError);
          return (
            <div key={it.id} className={recreate ? "flex flex-col gap-4 sm:flex-row" : "min-w-0"}>
              <div className={`relative overflow-hidden rounded-2xl border border-white/15 bg-black ${recreate ? "mx-auto w-40 shrink-0 sm:mx-0" : ""}`} style={{ aspectRatio: aspect }}>
                {playUrl ? (
                  <video key={playUrl} src={playUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-neutral-600">
                    <SvgIcon d={SP.film} size={22} />
                  </div>
                )}
                {!recreate && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Clip {i + 1}</span>
                )}
                {changeable && (
                  <button
                    type="button"
                    onClick={() => void remove(it, i + 1)}
                    disabled={Boolean(busy)}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white/80 hover:text-white disabled:opacity-50"
                    aria-label={recreate ? "Remove the video" : `Remove clip ${i + 1}`}
                  >
                    <SvgIcon d={SP.x} size={12} />
                  </button>
                )}
              </div>
              <div className={recreate ? "min-w-0 flex-1 space-y-3" : "mt-1.5 space-y-1"}>
                <p className="truncate text-[11px] text-neutral-300" style={NUM_FONT}>
                  {recreate && <b className="mr-1 text-sm text-white">{it.filename}</b>}
                  {!recreate && <span className="text-neutral-400">{it.filename} · </span>}
                  {it.durationS ? clock(it.durationS, true) : "—"}
                </p>
                {itemFailed ? (
                  <div className="space-y-1 text-[11px]">
                    <p className="text-rose-200">{it.analyzeError ?? it.proxyError}</p>
                    <button
                      type="button"
                      onClick={() => void retry(it, it.analyzeError ? "analyze" : "proxy")}
                      disabled={Boolean(busy)}
                      className="inline-flex min-h-8 items-center font-bold text-white underline underline-offset-2 disabled:opacity-50"
                    >
                      Try again
                    </button>
                  </div>
                ) : it.ready ? (
                  <p className="text-[11px] text-emerald-300">
                    ✓ Ready · {it.stills.length} stills · {it.words ? `${it.words} words` : it.hasAudio === false ? "no sound" : "no speech"}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
                    {it.analyzed ? "Making the light copy…" : "Claude is getting ready to watch it…"}
                  </p>
                )}
                {recreate && it.stills.length > 0 && changeable && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-neutral-400">
                      {manusBusy ? "Manus is recreating its look…" : "Tap a still to have Manus recreate that look with your presenter:"}
                    </p>
                    <div className="cs-scroll flex gap-2 overflow-x-auto pb-1">
                      {it.stills.map((st, si) =>
                        st.url ? (
                          <button
                            key={si}
                            type="button"
                            onClick={() => void makeLook(si)}
                            disabled={Boolean(busy) || manusBusy}
                            className="group relative w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 hover:border-violet-300/60 disabled:opacity-50"
                            style={{ aspectRatio: aspect }}
                            title={`Recreate the look at ${st.t.toFixed(1)} s`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                            <img src={st.url} alt="" className="h-full w-full object-cover" />
                            <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[9px] font-bold text-white" style={NUM_FONT}>
                              {st.t.toFixed(0)}s
                            </span>
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">Use videos you have the rights to use in an ad.</p>
      {changeable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(recreate || media.items.length < ONSCREEN_MAX) && (
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={Boolean(busy)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <SvgIcon d={SP.upload} size={14} /> {recreate ? "Replace video" : "Add clips"}
            </button>
          )}
          {busy && <span className="text-xs text-neutral-400">{busy}</span>}
        </div>
      )}
      <input
        ref={picker}
        type="file"
        hidden
        multiple={!recreate}
        accept="video/mp4,video/quicktime"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void add(files);
        }}
      />
    </AssistantCard>
  );
}
