"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CREDITS_PER_SECOND, clipDuration } from "@/lib/creative-studio/prompts";
import { INPUT, LABEL } from "@/components/creative-studio/brief-fields";
import { api, send } from "@/components/creative-studio/client";

type Clip = ProjectDetail["clips"][number];

interface KlingStatus {
  connected: boolean;
  credits: number | null;
  error?: string;
}

const CLIP_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Not sent", cls: "bg-[var(--input-bg)] text-[var(--text-muted)]" },
  queued: { label: "Queued", cls: "bg-blue-500/15 text-blue-400" },
  rendering: { label: "Rendering", cls: "bg-blue-500/15 text-blue-400" },
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-500" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-500" },
  blocked: { label: "Blocked by Kling", cls: "bg-rose-500/15 text-rose-500" },
};

const RENDER_LOCKED = ["approved", "rendering", "clips_ready"];

/**
 * Step 3 — Kling clips through the Kling MCP (your kling.ai plan credits).
 * One clip per line, native audio, the framework's batch rules, redo with
 * the previous take kept, and the §12 QA checklist.
 */
export function ClipsStep({
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
  const [kling, setKling] = useState<KlingStatus | null>(null);
  const [rendering, setRendering] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const polling = useRef(false);

  const loadKling = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/creative-studio/kling/status");
      setKling(await r.json());
    } catch {
      setKling({ connected: false, credits: null, error: "Couldn't check the Kling connection" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/kling/status")
      .then((r) => r.json())
      .then((s) => !cancelled && setKling(s))
      .catch(() => !cancelled && setKling({ connected: false, credits: null, error: "Couldn't check the Kling connection" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const anyRendering = detail.clips.some((c) => c.status === "rendering");

  // Poll while clips are rendering (Kling has no push notifications).
  useEffect(() => {
    if (!anyRendering) return;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      const r = await send(api(`${p.id}/render/poll`), "POST");
      polling.current = false;
      if (r.ok) onChange(r.data);
    };
    const t = setInterval(tick, 20_000);
    const first = setTimeout(tick, 4_000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [anyRendering, p.id, onChange]);

  const unsent = detail.clips.filter((c) => c.status === "draft");
  const unsentCredits = unsent.reduce((s, c) => s + c.durationS * CREDITS_PER_SECOND, 0);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of detail.clips) out[c.status] = (out[c.status] ?? 0) + 1;
    return out;
  }, [detail.clips]);
  const approved = RENDER_LOCKED.includes(p.status);
  const returnTo = `/dashboard/creative-studio/${p.id}?step=clips`;

  async function renderAll() {
    if (!confirm(`Send ${unsent.length} clip${unsent.length === 1 ? "" : "s"} to Kling? About ${unsentCredits.toLocaleString("en-US")} credits from your kling.ai plan.`)) return;
    setRendering(true);
    setReport(null);
    const r = await send(api(`${p.id}/render`), "POST", {});
    setRendering(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onChange(r.data);
    const rep = (r.data as unknown as { report?: { submitted: number; failed: number; queued: number; message: string | null } }).report;
    if (rep) {
      setReport(
        [`Sent ${rep.submitted} to Kling.`, rep.failed ? `${rep.failed} failed.` : "", rep.queued ? `${rep.queued} still queued.` : "", rep.message ?? ""]
          .filter(Boolean)
          .join(" ")
      );
    }
    loadKling();
  }

  async function disconnect() {
    if (!confirm("Disconnect Kling from the portal? You can reconnect any time.")) return;
    await fetch("/api/dashboard/creative-studio/kling/status", { method: "DELETE" });
    loadKling();
  }

  if (detail.clips.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Write and approve the script in step 2 first.
      </div>
    );
  }

  const numberClips = detail.clips.filter((c) => /\$|\d/.test(c.line)).map((c) => c.idx + 1);

  return (
    <div className="space-y-4">
      {klingNotice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            klingNotice === "connected"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-rose-500/30 bg-rose-500/10 text-rose-500"
          }`}
        >
          {klingNotice === "connected"
            ? "Kling is connected. Renders use your kling.ai plan credits."
            : klingNotice === "denied"
              ? "Kling access wasn't approved, so nothing was connected."
              : "Connecting Kling didn't finish. Please try again."}
        </div>
      )}

      <section className="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Kling</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {kling === null
              ? "Checking the connection…"
              : kling.connected
                ? `Connected to your kling.ai account${kling.credits !== null ? ` · ${kling.credits.toLocaleString("en-US")} credits left` : ""}${kling.error ? ` · ${kling.error}` : ""}`
                : kling.error ?? "Connect your kling.ai account once. Renders spend the same plan credits you use in Claude."}
          </p>
        </div>
        {kling?.connected ? (
          <button type="button" onClick={disconnect} className="text-xs font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
            Disconnect
          </button>
        ) : (
          <a href={`/api/dashboard/creative-studio/kling/connect?returnTo=${encodeURIComponent(returnTo)}`} className="btn-primary px-5 py-2 text-sm">
            {kling?.error?.includes("expired") ? "Reconnect Kling" : "Connect Kling"}
          </a>
        )}
      </section>

      <section className="glass-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(counts).map(([status, n]) => (
              <span key={status} className={`rounded-full px-2.5 py-0.5 font-bold ${CLIP_STATUS[status]?.cls ?? ""}`}>
                {n} {CLIP_STATUS[status]?.label ?? status}
              </span>
            ))}
          </div>
          {approved && unsent.length > 0 && (
            <button
              type="button"
              onClick={renderAll}
              disabled={rendering || !kling?.connected}
              className="btn-primary px-5 py-2 text-sm"
              title={kling?.connected ? undefined : "Connect Kling first"}
            >
              {rendering
                ? "Sending to Kling…"
                : `Render ${unsent.length === detail.clips.length ? "all" : "remaining"} ${unsent.length} · ≈${unsentCredits.toLocaleString("en-US")} credits`}
            </button>
          )}
        </div>
        {!approved && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            Approve the script in step 2 before rendering. Nothing is sent to Kling until then.
          </p>
        )}
        {rendering && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sending in batches of about 6. If Kling rate-limits, the portal waits 60 seconds and resends once, so this can take a few minutes.
          </p>
        )}
        {report && (
          <p className="rounded-xl border px-4 py-2.5 text-xs" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
            {report}
          </p>
        )}
        {anyRendering && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Kling usually takes a few minutes per clip. This page checks every 20 seconds and saves each finished clip to your storage, so the links don&apos;t expire.
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {detail.clips.map((c) => (
          <ClipTile key={`${c.id}-${c.version}`} clip={c} detail={detail} kling={kling} onChange={onChange} onError={onError} />
        ))}
      </div>

      <section className="glass-card p-5">
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-main)" }}>QA checklist after the render</p>
        <ul className="space-y-1.5 text-xs list-disc pl-5" style={{ color: "var(--text-main)" }}>
          <li>C-P-A said as letters in the hooks.</li>
          <li>
            Every number said once and correctly
            {numberClips.length > 0 ? ` (clips ${numberClips.join(", ")}).` : "."}
          </li>
          {(p.rig === "duo" || p.rig === "trio") && <li>Only the named speaker&apos;s lips move, and listeners react naturally.</li>}
          <li>The longest lines aren&apos;t rushed or cut off.</li>
          <li>Finished clips are saved to your storage, so they don&apos;t expire like Kling&apos;s 24-hour links.</li>
        </ul>
      </section>
    </div>
  );
}

function ClipTile({
  clip,
  detail,
  kling,
  onChange,
  onError,
}: {
  clip: Clip;
  detail: ProjectDetail;
  kling: KlingStatus | null;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [redoOpen, setRedoOpen] = useState(false);
  const [line, setLine] = useState(clip.line);
  const [cues, setCues] = useState(clip.cues);
  const [busy, setBusy] = useState(false);
  const status = CLIP_STATUS[clip.status] ?? CLIP_STATUS.draft;
  const canRedo = ["done", "failed", "blocked"].includes(clip.status);
  const aspect = p.format === "ad_9x16" ? "9 / 16" : "16 / 9";

  async function redo() {
    const cost = clipDuration(line) * CREDITS_PER_SECOND;
    if (!confirm(`Redo clip ${clip.idx + 1}? About ${cost} credits. The current take is kept as v${clip.version}.`)) return;
    setBusy(true);
    const r = await send(api(`${p.id}/render`), "POST", { redo: { clipId: clip.id, line, cues } });
    setBusy(false);
    if (r.ok) {
      onChange(r.data);
      setRedoOpen(false);
    } else onError(r.error);
  }

  return (
    <article className="glass-card overflow-hidden !p-0 flex flex-col">
      <div className="relative bg-black" style={{ aspectRatio: aspect }}>
        {clip.videoUrl ? (
          <video src={clip.videoUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            {clip.status === "rendering" || clip.status === "queued" ? (
              <>
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                <span className="text-[11px] font-semibold text-white/60">Kling is rendering…</span>
              </>
            ) : (
              <span className="text-[11px] font-semibold text-white/40">{clip.durationS}s · not rendered yet</span>
            )}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
          #{clip.idx + 1} · {clip.durationS}s{clip.version > 1 ? ` · v${clip.version}` : ""}
        </span>
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{clip.line}</p>
        {clip.editNote && (
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Edit: {clip.editNote}
          </p>
        )}
        {clip.error && <p className="text-[11px] font-semibold text-rose-500">{clip.error}</p>}
        <div className="mt-auto flex flex-wrap gap-3 pt-1 text-[11px] font-semibold">
          {clip.videoUrl && (
            <a href={clip.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Download
            </a>
          )}
          {canRedo && kling?.connected && (
            <button type="button" onClick={() => setRedoOpen((v) => !v)} className="hover:underline" style={{ color: "var(--text-main)" }}>
              Redo this clip
            </button>
          )}
          {clip.previousTakes > 0 && <span style={{ color: "var(--text-muted)" }}>{clip.previousTakes} earlier take{clip.previousTakes === 1 ? "" : "s"} kept</span>}
        </div>
        {redoOpen && (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            <label className="block">
              <span className={LABEL} style={{ color: "var(--text-muted)" }}>Line</span>
              <textarea rows={2} value={line} onChange={(e) => setLine(e.target.value)} className={`${INPUT} resize-y`} style={{ color: "var(--text-main)" }} />
            </label>
            <label className="block">
              <span className={LABEL} style={{ color: "var(--text-muted)" }}>Targeted cue (e.g. how to say a word or number)</span>
              <textarea rows={2} value={cues} onChange={(e) => setCues(e.target.value)} className={`${INPUT} resize-y`} style={{ color: "var(--text-main)" }} />
            </label>
            <button type="button" onClick={redo} disabled={busy} className="btn-primary w-full px-4 py-2 text-xs">
              {busy ? "Sending to Kling…" : "Redo with these changes"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
