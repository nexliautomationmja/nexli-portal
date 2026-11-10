"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CREDITS_PER_SECOND } from "@/lib/creative-studio/prompts";
import { CTA_CLASSES, ConfettiBurst, ProgressRing, SYNE, ShimmerCard } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send, videoFileName } from "@/components/creative-studio/client";
import { SaveVideoLink } from "@/components/creative-studio/save-video";
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
  // Re-making clips: the open picker (null = closed) and the step running.
  const [picker, setPicker] = useState<"any" | null>(null);
  const [remaking, setRemaking] = useState<string | null>(null);
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

  /**
   * Re-make clips that already have a take: a new frame is described for
   * Kling first (its own request, lines kept), then the clips go to Kling.
   */
  async function remake(ids: string[]) {
    const chosen = detail.clips.filter((c) => ids.includes(c.id));
    if (chosen.length === 0) return;
    const credits = chosen.reduce((s, c) => s + c.durationS * CREDITS_PER_SECOND, 0);
    const n = chosen.length;
    if (!confirm(`Re-make ${n} clip${n === 1 ? "" : "s"} on Kling? About ${credits.toLocaleString("en-US")} credits. The current takes are kept.`)) return;
    setReport(null);
    const frames = [...new Set(chosen.filter((c) => c.outdated && c.frameId).map((c) => c.frameId as string))].filter((f) => detail.redescribe.includes(f));
    let notes = "";
    if (frames.length) {
      setRemaking("Claude is describing the new frame for Kling (your lines stay as written)…");
      const d = await send(api(`${p.id}/frame/describe`), "POST", { frameIds: frames });
      if (!d.ok) {
        setRemaking(null);
        return onError(d.error);
      }
      onChange(d.data);
      notes = (d.data as unknown as { describeNotes?: string }).describeNotes ?? "";
    }
    setRemaking(`Sending ${n} clip${n === 1 ? "" : "s"} to Kling…`);
    const r = await send(api(`${p.id}/clips/remake`), "POST", { clipIds: ids });
    setRemaking(null);
    if (!r.ok) return onError(r.error);
    onChange(r.data);
    setPicker(null);
    const rep = (r.data as unknown as { report?: { submitted: number; failed: number; queued: number; message: string | null } }).report;
    setReport(
      [
        rep ? `Sent ${rep.submitted}.` : "",
        rep?.failed ? `${rep.failed} failed.` : "",
        rep?.queued ? `${rep.queued} still queued.` : "",
        rep?.message ?? "",
        notes,
        cutsExist ? "When they're done, a new auto-cut starts by itself." : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
    loadKling();
  }

  const outdated = detail.clips.filter((c) => c.outdated && !["rendering", "queued"].includes(c.status));
  const remakeable = detail.clips.filter((c) => ["done", "failed", "blocked"].includes(c.status));
  const cutsExist = detail.cuts.length > 0;
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
            {kling?.connected && remakeable.length > 0 && outdated.length === 0 && !picker && !remaking && (
              <button
                type="button"
                onClick={() => setPicker("any")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                <SvgIcon d={SP.undo} size={13} /> Re-make clips…
              </button>
            )}
            {report && <p className="text-xs text-neutral-300">{report}</p>}
          </div>
        </div>

        {remaking ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-neutral-200">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
            {remaking}
          </div>
        ) : outdated.length > 0 && kling?.connected ? (
          <RemakePicker
            key={outdated.map((c) => c.id).join()}
            tone="amber"
            title="New frame"
            sub={`${outdated.length === 1 ? "Clip " + (outdated[0].idx + 1) + " was" : `${outdated.length} clips were`} made from the old frame. Re-make ${outdated.length === 1 ? "it" : "them"} from the new one: Claude first updates how the frame is described for Kling, keeping every line exactly as written. The old takes are kept.`}
            clips={detail.clips.filter((c) => remakeable.includes(c) || outdated.includes(c))}
            initial={outdated.map((c) => c.id)}
            onRemake={(ids) => void remake(ids)}
          />
        ) : outdated.length > 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-3.5 py-3 text-xs text-amber-100">
            New frame: {outdated.length} clip{outdated.length === 1 ? " was" : "s were"} made from the old one. Connect Kling to re-make {outdated.length === 1 ? "it" : "them"}.
          </p>
        ) : picker ? (
          <RemakePicker
            tone="neutral"
            title="Re-make clips"
            sub="Tick the clips to make again, with the same script. The old takes are kept."
            clips={remakeable}
            initial={[]}
            onRemake={(ids) => void remake(ids)}
            onCancel={() => setPicker(null)}
          />
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {detail.clips.map((c) => (
            <ClipTile key={`${c.id}-${c.version}`} clip={c} aspect={aspect} projectId={p.id} title={p.title} canRedo={Boolean(kling?.connected)} onChange={onChange} onError={onError} />
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">QA checklist</p>
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
        <span className="absolute left-2 top-9 flex flex-col items-start gap-1 sm:left-auto sm:right-2 sm:top-2 sm:items-end">
          <Chip tone={pill.tone}>{pill.label}</Chip>
          {clip.outdated && <Chip tone="amber">Old frame</Chip>}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-3 text-xs font-medium leading-relaxed text-white" title={clip.line || clip.action}>
          {clip.kind === "silent" ? <span className="text-neutral-300">🎬 {clip.action}</span> : clip.line}
        </p>
        {clip.error && <p className="text-[11px] font-semibold text-rose-300">{clip.error}</p>}
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          {clip.videoUrl && (
            <SaveVideoLink
              url={clip.videoUrl}
              filename={videoFileName(title, `clip-${clip.idx + 1}`, `take-${clip.version}`)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-cyan-500/10 px-3 text-cyan-300 hover:text-white"
            >
              <SvgIcon d={SP.download} size={12} /> Download
            </SaveVideoLink>
          )}
          {canRedo && ["done", "failed", "blocked"].includes(clip.status) && (
            <button type="button" onClick={() => setFixing((v) => !v)} className="inline-flex min-h-9 items-center rounded-full bg-white/5 px-3 text-neutral-300 hover:text-white">
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
              className="lp-input resize-none text-xs"
            />
            <button type="button" onClick={redo} disabled={busy} className="min-h-10 w-full rounded-full bg-blue-600 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy ? "Sending…" : note.trim() ? "Fix and redo" : "Redo as-is"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Pick clips to re-make: each with its length, and the Kling credits for the ticked ones. */
function RemakePicker({
  tone,
  title,
  sub,
  clips,
  initial,
  onRemake,
  onCancel,
}: {
  tone: "amber" | "neutral";
  title: string;
  sub: string;
  clips: Clip[];
  initial: string[];
  onRemake: (ids: string[]) => void;
  onCancel?: () => void;
}) {
  const [ticked, setTicked] = useState(() => new Set(initial));
  const chosen = clips.filter((c) => ticked.has(c.id));
  const credits = chosen.reduce((s, c) => s + c.durationS * CREDITS_PER_SECOND, 0);
  const toggle = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className={`mt-4 rounded-2xl border p-3.5 ${tone === "amber" ? "border-amber-400/30 bg-amber-500/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className={`mt-0.5 text-xs leading-relaxed ${tone === "amber" ? "text-amber-100/90" : "text-neutral-400"}`}>{sub}</p>
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
        {clips.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <input type="checkbox" checked={ticked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-cyan-500" />
              <span className="w-8 shrink-0 text-xs font-bold text-neutral-400" style={NUM_FONT}>
                #{c.idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{c.kind === "silent" ? `🎬 ${c.action}` : c.line}</span>
              {c.outdated && <Chip tone="amber">Old frame</Chip>}
              <span className="shrink-0 text-[11px] text-neutral-500" style={NUM_FONT}>
                {c.durationS}s
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onRemake(chosen.map((c) => c.id))} disabled={chosen.length === 0} className={`${CTA_CLASSES} !inline-flex disabled:opacity-50`}>
          Re-make {chosen.length || ""} clip{chosen.length === 1 ? "" : "s"}
          {tone === "amber" ? " from the new frame" : ""}
        </button>
        <span className="text-xs text-neutral-400" style={NUM_FONT}>
          {chosen.length ? `≈ ${credits.toLocaleString("en-US")} credits` : "Tick at least one"}
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-9 px-2 text-xs font-semibold text-neutral-500 hover:text-white">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
