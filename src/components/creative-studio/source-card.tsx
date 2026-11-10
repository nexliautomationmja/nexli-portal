"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { uploadSource } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { clock, parseClock, watchProblem } from "@/lib/creative-studio/reaction-shared";

export type ReactionSource = NonNullable<NonNullable<ProjectDetail["reaction"]>["source"]>;
type Step = "analyze" | "proxy";

// Signed URLs are re-issued on every refresh; keep the first one per file so a
// player doesn't reload its video each time the project refetches.
const stableUrls = new Map<string, { url: string; at: number }>();
export function stableUrl(key: string, url: string | null): string | null {
  if (!url) return null;
  const hit = stableUrls.get(key);
  if (hit && Date.now() - hit.at < 4 * 3600_000) return hit.url;
  stableUrls.set(key, { url, at: Date.now() });
  return url;
}

/** The presenter's name for this video's copy (a client firm's studio has no Daniela). */
export function presenterName(p: ProjectDetail["project"]): string {
  return p.presenter?.name || (p.studio.kind === "client" ? "The presenter" : "Daniela");
}

const stepDone = (s: ReactionSource, step: Step) => (step === "analyze" ? s.analyzed : Boolean(s.proxyUrl));
const stepError = (s: ReactionSource, step: Step) => (step === "analyze" ? s.analyzeError : s.proxyError);

/**
 * A reaction video's first card: the video the presenter reacts to. It gets
 * the video ready — the stills and words Claude reads, and the light copy the
 * edit plays in the corner — one request per step, side by side, and picks
 * them up again after a reload. The video can be replaced until the script
 * is approved.
 */
export function SourceCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const source = detail.reaction?.source ?? null;
  const who = presenterName(p);
  const changeable = ["draft", "scripted"].includes(p.status);
  const [busy, setBusy] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const inFlight = useRef(new Set<string>());

  // Start every step that isn't done, failed or running elsewhere; check back on ones another request is running.
  useEffect(() => {
    if (!source) return;
    const pending = (["analyze", "proxy"] as const).filter((step) => !stepDone(source, step) && !stepError(source, step));
    for (const step of pending) {
      const key = `${source.id}:${step}`;
      if (source.running[step] || inFlight.current.has(key)) continue;
      inFlight.current.add(key);
      void send(api(`${p.id}/source/prepare`), "POST", { step }).then((r) => {
        inFlight.current.delete(key);
        if (r.ok) onChange(r.data);
        else onError(r.error);
      });
    }
    if (!pending.some((step) => source.running[step])) return;
    const t = setInterval(async () => {
      const r = await send(api(p.id), "GET");
      if (r.ok) onChange(r.data);
    }, 8000);
    return () => clearInterval(t);
  }, [source, p.id, onChange, onError]);

  async function retry(step: Step) {
    setBusy(step === "analyze" ? "Reading the video again…" : "Making the light copy again…");
    const r = await send(api(`${p.id}/source/prepare`), "POST", { step });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function replace(file: File) {
    if (detail.clips.length > 0 && !confirm(`Replace the video ${who} reacts to? The script was written for this one, so you'll rewrite it afterwards.`)) return;
    setBusy("Uploading the video…");
    try {
      onChange(await uploadSource(p.id, file));
    } catch (err) {
      onError(err instanceof Error ? err.message : "The upload failed");
    }
    setBusy(null);
  }

  async function remove() {
    if (!confirm(`Make this a normal video? The video ${who} reacts to is removed.`)) return;
    setBusy("Removing the video…");
    const r = await send(api(`${p.id}/source`), "DELETE");
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  if (!detail.reaction) return null;
  const ready = source?.status === "ready";
  const failed = Boolean(source && (source.analyzeError || source.proxyError));
  const playUrl = source ? stableUrl(`source:${source.id}:${source.proxyUrl ? "proxy" : "file"}`, source.proxyUrl ?? source.url) : null;
  const aspect = source?.width && source.height ? `${source.width} / ${source.height}` : "9 / 16";
  const steps: { step: Step; label: string; done: string }[] = source
    ? [
        {
          step: "analyze",
          label: "Claude can watch it: stills and every word",
          done: `${source.stills.length} stills · ${source.words ? `${source.words} words` : source.hasAudio === false ? "no sound" : "no speech"}`,
        },
        { step: "proxy", label: "A light copy for the corner of the edit", done: "Ready" },
      ]
    : [];

  return (
    <AssistantCard
      id="stage-source"
      accent="violet"
      icon={SP.film}
      title={`The video ${who} reacts to`}
      right={source ? <Chip tone={failed ? "red" : ready ? "green" : "blue"}>{failed ? "Needs a look" : ready ? "Ready" : "Getting it ready"}</Chip> : null}
    >
      {source ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black sm:mx-0" style={{ aspectRatio: aspect }}>
            {playUrl ? (
              <video key={playUrl} src={playUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-600">
                <SvgIcon d={SP.film} size={22} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="truncate text-sm font-semibold text-white">{source.filename}</p>
              <p className="text-[11px] text-neutral-400" style={NUM_FONT}>
                {source.durationS ? clock(source.durationS, true) : "—"}
                {source.width && source.height ? ` · ${source.width}×${source.height}` : ""}
              </p>
            </div>
            <ul className="space-y-1.5">
              {steps.map(({ step, label, done }) => {
                const error = stepError(source, step);
                const finished = stepDone(source, step);
                return (
                  <li key={step} className="text-xs">
                    <div className="flex items-start gap-2">
                      {finished ? (
                        <span className="mt-0.5 text-emerald-300" aria-hidden="true">✓</span>
                      ) : error ? (
                        <span className="mt-0.5 text-rose-300" aria-hidden="true">!</span>
                      ) : (
                        <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className={finished ? "text-neutral-300" : "text-white"}>{label}</span>
                        {finished && <span className="text-neutral-500"> · {done}</span>}
                        {!finished && !error && <span className="text-neutral-500"> · working on it</span>}
                      </span>
                    </div>
                    {error && (
                      <div className="ml-5 mt-1 space-y-1">
                        <p className="text-rose-200">{error}</p>
                        <button type="button" onClick={() => void retry(step)} disabled={Boolean(busy)} className="inline-flex min-h-8 items-center text-xs font-bold text-white underline underline-offset-2 disabled:opacity-50">
                          Try again
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {source.summary && (
              <p className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2 text-xs leading-relaxed text-violet-100/90">
                <b className="text-white">What Claude saw:</b> {source.summary}
              </p>
            )}
            <p className="text-[11px] text-neutral-500">Use a video you have the rights to use in an ad.</p>
            {changeable && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  disabled={Boolean(busy)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <SvgIcon d={SP.upload} size={14} /> Replace video
                </button>
                {detail.clips.length === 0 && (
                  <button type="button" onClick={() => void remove()} disabled={Boolean(busy)} className="min-h-9 px-2 text-xs font-semibold text-neutral-500 hover:text-white disabled:opacity-50">
                    Make it a normal video
                  </button>
                )}
                {busy && <span className="text-xs text-neutral-400">{busy}</span>}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-neutral-300">The video {who} reacts to is missing. Upload it again to carry on.</p>
          {changeable && (
            <button type="button" onClick={() => picker.current?.click()} disabled={Boolean(busy)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              <SvgIcon d={SP.upload} size={14} /> {busy ?? "Upload the video"}
            </button>
          )}
        </div>
      )}
      <input
        ref={picker}
        type="file"
        hidden
        accept="video/mp4,video/quicktime"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void replace(file);
        }}
      />
    </AssistantCard>
  );
}

/**
 * A watch clip's part of the video, on the script: a player of just that part
 * and, until the script is approved, its start and end to change.
 */
export function WatchPart({
  projectId,
  clipId,
  watch,
  source,
  locked,
  onChange,
  onError,
}: {
  projectId: string;
  clipId: string;
  watch: { from: number; to: number };
  source: ReactionSource | null;
  locked: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const url = source ? stableUrl(`source:${source.id}:${source.proxyUrl ? "proxy" : "file"}`, source.proxyUrl ?? source.url) : null;
  const aspect = source?.width && source.height ? `${source.width} / ${source.height}` : "9 / 16";
  const from = editing ? parseClock(editing.from) : watch.from;
  const to = editing ? parseClock(editing.to) : watch.to;
  const problem = editing ? (from === null || to === null ? "Write the times like 0:12 or 12.5" : watchProblem({ from, to }, source?.durationS ?? null)) : null;

  async function save() {
    if (from === null || to === null || problem) return;
    setSaving(true);
    const r = await send(api(`${projectId}/clips/${clipId}`), "PATCH", { watch: { from, to } });
    setSaving(false);
    if (r.ok) {
      setEditing(null);
      onChange(r.data);
    } else onError(r.error);
  }

  return (
    <div className="mt-2 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!url}
          aria-expanded={open}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-violet-500/20 px-3 text-[11px] font-bold text-violet-100 enabled:hover:bg-violet-500/30 disabled:opacity-60"
          style={NUM_FONT}
        >
          <span aria-hidden="true">{open ? "▾" : "▶"}</span> Watches {clock(watch.from, true)}–{clock(watch.to, true)} of the video
        </button>
        {!locked && !editing && (
          <button
            type="button"
            onClick={() => setEditing({ from: clock(watch.from, true), to: clock(watch.to, true) })}
            className="min-h-8 px-1 text-[11px] font-semibold text-neutral-400 hover:text-white"
          >
            Change the part
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-neutral-400">
              From
              <input
                value={editing.from}
                onChange={(e) => setEditing({ ...editing, from: e.target.value })}
                inputMode="decimal"
                className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-base text-white sm:text-xs"
                style={NUM_FONT}
              />
            </label>
            <label className="flex items-center gap-1.5 text-neutral-400">
              to
              <input
                value={editing.to}
                onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                inputMode="decimal"
                className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-base text-white sm:text-xs"
                style={NUM_FONT}
              />
            </label>
            <button type="button" onClick={() => void save()} disabled={Boolean(problem) || saving} className="min-h-8 rounded-full bg-violet-600 px-3 font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="min-h-8 px-1 font-semibold text-neutral-500 hover:text-white">
              Cancel
            </button>
          </div>
          {problem ? (
            <p className="text-[11px] text-amber-200">{problem}</p>
          ) : (
            <p className="text-[11px] text-neutral-500">The clip&apos;s length follows the part, and the corner video plays exactly this part.</p>
          )}
        </div>
      )}
      {open && url && (
        <div className="mt-2 w-40 overflow-hidden rounded-xl border border-white/15 bg-black" style={{ aspectRatio: aspect }}>
          <video key={`${url}-${watch.from}-${watch.to}`} src={`${url}#t=${watch.from},${watch.to}`} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        </div>
      )}
    </div>
  );
}
