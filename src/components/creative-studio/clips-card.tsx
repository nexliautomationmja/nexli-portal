"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CREDITS_PER_SECOND } from "@/lib/creative-studio/prompts";
import { CTA_CLASSES, ConfettiBurst, ProgressRing, SYNE, ShimmerCard } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, downloadHref, send, videoFileName } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";

type Clip = ProjectDetail["clips"][number];

const CLIP_PILL: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  draft: { label: "Not sent", tone: "neutral" },
  queued: { label: "Queued", tone: "blue" },
  rendering: { label: "Rendering", tone: "blue" },
  done: { label: "Done", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  blocked: { label: "Blocked", tone: "red" },
};

/**
 * Kling clips: progress ring, connection + credits, a gallery of players with
 * download and "Fix this clip". Polls every 20 s while clips render and saves
 * each finished clip to storage (Kling's links expire in ~24 h).
 */
export function ClipsCard({
  detail,
  klingNotice,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  klingNotice: string | null;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [kling, setKling] = useState<{ connected: boolean; credits: number | null; error?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const polling = useRef(false);
  // Confetti once, when the last clip lands while you're on the page.
  const [doneOnLoad] = useState(() => p.status === "clips_ready");

  const loadKling = useCallback(() => {
    fetch("/api/dashboard/creative-studio/kling/status")
      .then((r) => r.json())
      .then(setKling)
      .catch(() => setKling({ connected: false, credits: null }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/kling/status")
      .then((r) => r.json())
      .then((s) => !cancelled && setKling(s))
      .catch(() => !cancelled && setKling({ connected: false, credits: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = detail.clips.length;
  const done = detail.clips.filter((c) => c.status === "done").length;
  const rendering = detail.clips.some((c) => c.status === "rendering");
  const unsent = detail.clips.filter((c) => c.status === "draft");
  const allDone = p.status === "clips_ready" || (total > 0 && done === total);

  const burst = allDone && !doneOnLoad ? 1 : 0;

  useEffect(() => {
    if (!rendering) return;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      const r = await send(api(`${p.id}/render/poll`), "POST");
      polling.current = false;
      if (r.ok) onChange(r.data);
    };
    const first = setTimeout(tick, 4_000);
    const t = setInterval(tick, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [rendering, p.id, onChange]);

  async function sendRemaining() {
    const credits = unsent.reduce((s, c) => s + c.durationS * CREDITS_PER_SECOND, 0);
    if (!confirm(`Send ${unsent.length} clip${unsent.length === 1 ? "" : "s"} to Kling? About ${credits.toLocaleString("en-US")} credits.`)) return;
    setSending(true);
    const r = await send(api(`${p.id}/render`), "POST", {});
    setSending(false);
    if (!r.ok) return onError(r.error);
    onChange(r.data);
    const rep = (r.data as unknown as { report?: { submitted: number; failed: number; queued: number; message: string | null } }).report;
    if (rep) setReport([`Sent ${rep.submitted}.`, rep.failed ? `${rep.failed} failed.` : "", rep.queued ? `${rep.queued} still queued.` : "", rep.message ?? ""].filter(Boolean).join(" "));
    loadKling();
  }

  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";
  const numberClips = detail.clips.filter((c) => /\$|\d/.test(c.line)).map((c) => c.idx + 1);

  return (
    <div className="space-y-4">
      <ConfettiBurst burst={burst} />
      {klingNotice && (
        <div className={`lp-card rounded-xl border px-4 py-3 text-sm ${klingNotice === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
          {klingNotice === "connected" ? "Kling is connected. Renders use your kling.ai plan credits." : klingNotice === "denied" ? "Kling access wasn't approved." : "Connecting Kling didn't finish. Please try again."}
        </div>
      )}

      {allDone && (
        <ShimmerCard className="lp-card">
          <p className="text-lg font-bold text-white" style={SYNE}>
            Your clips are ready
          </p>
          <p className="mt-1 text-sm text-neutral-300">All {total} clips are rendered and saved. Download them below, edit your cut, then upload it.</p>
        </ShimmerCard>
      )}

      <AssistantCard
        id="stage-clips"
        accent="cyan"
        icon={SP.film}
        title="Kling clips"
        right={
          kling?.connected ? (
            <Chip tone="green">Kling connected{kling.credits !== null ? ` · ${kling.credits.toLocaleString("en-US")} credits` : ""}</Chip>
          ) : kling ? (
            <a href={`/api/dashboard/creative-studio/kling/connect?returnTo=${encodeURIComponent(`/dashboard/creative-studio/${p.id}`)}`} className="text-xs font-bold text-cyan-300 hover:text-white">
              {kling.error?.includes("expired") ? "Reconnect Kling" : "Connect Kling"} →
            </a>
          ) : null
        }
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="scale-90">
            <ProgressRing percent={total ? Math.round((done / total) * 100) : 0} />
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <p className="text-2xl font-extrabold text-white" style={NUM_FONT}>
              {done} of {total} clips done
            </p>
            <p className="text-sm text-neutral-400">
              {rendering
                ? "Kling usually takes a few minutes per clip. This page checks every 20 seconds and saves each finished clip, so nothing expires."
                : allDone
                  ? "Everything is saved to your storage."
                  : unsent.length > 0
                    ? `${unsent.length} clip${unsent.length === 1 ? " hasn't" : "s haven't"} been sent yet.`
                    : "Some clips need a fix — see below."}
            </p>
            {unsent.length > 0 && !rendering && (
              <button type="button" onClick={sendRemaining} disabled={sending || !kling?.connected} className={`${CTA_CLASSES} !inline-flex`}>
                {sending ? "Sending to Kling…" : `Send ${unsent.length} to Kling`}
              </button>
            )}
            {report && <p className="text-xs text-neutral-300">{report}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {detail.clips.map((c) => (
            <ClipTile key={`${c.id}-${c.version}`} clip={c} aspect={aspect} projectId={p.id} title={p.title} canRedo={Boolean(kling?.connected)} onChange={onChange} onError={onError} />
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">QA checklist</p>
          <ul className="mt-2 space-y-1 text-xs text-neutral-300">
            <li>☐ C-P-A said as letters in the hooks</li>
            <li>☐ Every number said once and correctly{numberClips.length ? ` (clips ${numberClips.join(", ")})` : ""}</li>
            {(p.rig === "duo" || p.rig === "trio") && <li>☐ Only the named speaker&apos;s lips move; listeners react naturally</li>}
            <li>☐ Longest lines aren&apos;t rushed or cut off</li>
          </ul>
        </div>
      </AssistantCard>
    </div>
  );
}

function ClipTile({
  clip,
  aspect,
  projectId,
  title,
  canRedo,
  onChange,
  onError,
}: {
  clip: Clip;
  aspect: string;
  projectId: string;
  title: string;
  canRedo: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pill = CLIP_PILL[clip.status] ?? CLIP_PILL.draft;

  async function redo() {
    if (!confirm(`Redo clip ${clip.idx + 1}? About ${clip.durationS * CREDITS_PER_SECOND} credits. The current take is kept.`)) return;
    setBusy(true);
    const r = await send(api(`${projectId}/render`), "POST", { redo: { clipId: clip.id, note } });
    setBusy(false);
    if (r.ok) {
      onChange(r.data);
      setFixing(false);
    } else onError(r.error);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="relative bg-black" style={{ aspectRatio: aspect }}>
        {clip.videoUrl ? (
          <video src={clip.videoUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            {clip.status === "rendering" || clip.status === "queued" ? (
              <>
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />
                <span className="text-[11px] font-semibold text-neutral-400">Rendering…</span>
              </>
            ) : (
              <span className="text-[11px] text-neutral-500">{clip.durationS}s</span>
            )}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white" style={NUM_FONT}>
          #{clip.idx + 1} · {clip.durationS}s{clip.version > 1 ? ` · v${clip.version}` : ""}
        </span>
        <span className="absolute right-2 top-2">
          <Chip tone={pill.tone}>{pill.label}</Chip>
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-3 text-xs font-medium leading-relaxed text-white" title={clip.line}>
          {clip.line}
        </p>
        {clip.error && <p className="text-[11px] font-semibold text-rose-300">{clip.error}</p>}
        <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
          {clip.videoUrl && (
            <a
              href={downloadHref(clip.videoUrl, videoFileName(title, `clip-${clip.idx + 1}`, `take-${clip.version}`))}
              download
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-white"
            >
              <SvgIcon d={SP.download} size={12} /> Download
            </a>
          )}
          {canRedo && ["done", "failed", "blocked"].includes(clip.status) && (
            <button type="button" onClick={() => setFixing((v) => !v)} className="text-neutral-400 hover:text-white">
              Fix this clip
            </button>
          )}
        </div>
        {fixing && (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's wrong? Leave empty to redo as-is."
              className="lp-input resize-none !text-xs"
            />
            <button type="button" onClick={redo} disabled={busy} className="w-full rounded-full bg-blue-600 py-1.5 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy ? "Sending…" : note.trim() ? "Fix and redo" : "Redo as-is"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
