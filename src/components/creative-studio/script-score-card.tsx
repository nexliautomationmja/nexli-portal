"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { BAND } from "@/lib/ads/grader-shared";
import { WEAK_BELOW, nextScoreStep, pendingLive } from "@/lib/creative-studio/script-score-shared";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { Chip } from "@/components/creative-studio/canvas";

const BAND_TONE = { run: "green", fix: "amber", skip: "red" } as const;
const BAND_RING = { run: "#34d399", fix: "#fbbf24", skip: "#fb7185" } as const;

/**
 * The script's score out of 100 on the grader's points (Nov 19 2026; videos
 * recreated in Nexli's studio). While the script can still change it runs on
 * its own: scores a new or changed script, and once per video rewrites the
 * points under 7 of 10, then scores the result. The batch board does the
 * same for every video of a batch; a claim on the server keeps two open
 * pages from running it twice.
 */
export function ScriptScoreCard({
  detail,
  locked,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  locked: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const s = p.scriptScore;
  const [open, setOpen] = useState(false);
  const running = useRef<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const step = nextScoreStep({ eligible: p.scoreEligible && !locked, status: p.status, clips: detail.clips.length, score: s });
  const live = pendingLive(s, now);
  // One run per step and script version; a failure waits for the retry button.
  const runKey = step ? `${step}:${s?.key ?? "none"}:${p.scriptVersion}` : null;
  const failed = Boolean(runKey && failedKey === runKey);

  useEffect(() => {
    if (!runKey || !step || failedKey === runKey || running.current === runKey) return;
    running.current = runKey;
    void send(api(`${p.id}/script/score`), "POST", { action: step }).then((r) => {
      running.current = null;
      if (r.ok) onChange(r.data);
      else if (!/already|nothing to improve/i.test(r.error)) {
        setFailedKey(runKey);
        onError(r.error);
      }
    });
  }, [runKey, step, failedKey, p.id, onChange, onError]);

  // Another page (or the batch board) is running it: check back until it's done.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const r = await send(api(p.id), "GET");
      if (r.ok) onChange(r.data);
    }, 8000);
    return () => clearInterval(t);
  }, [live, p.id, onChange]);

  if (!p.scoreEligible || detail.clips.length === 0) return null;

  const pendingKind = s?.pending && live ? s.pending.kind : step;
  const scored = s && !s.stale && s.subs.length > 0 ? s : null;

  if (!scored) {
    const improving = pendingKind === "improve";
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
        {!locked && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" aria-hidden="true" />}
        <p className="text-xs text-neutral-300">
          {improving
            ? "Rewriting the weak points, then scoring it again…"
            : locked
              ? "Not scored (approved before it could be)."
              : "Scoring the script on the grader's 7 points…"}
        </p>
        {failed && (
          <button
            type="button"
            onClick={() => setFailedKey(null)}
            className="ml-auto rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-neutral-200 hover:bg-white/10"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const band = BAND[scored.band];
  const weak = scored.subs.filter((x) => x.score < WEAK_BELOW).length;
  const improving = pendingKind === "improve";
  const pct = Math.max(0, Math.min(100, scored.score));

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${BAND_RING[scored.band]} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
          aria-label={`Score ${scored.score} out of 100`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b1224] text-lg font-extrabold text-white" style={NUM_FONT}>
            {scored.score}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-white">Script score</p>
            <Chip tone={BAND_TONE[scored.band]}>{band.label}</Chip>
            {scored.before !== null && <Chip tone="blue">Improved from {scored.before}</Chip>}
            {scored.caps.map((c) => (
              <Chip key={c.key} tone="red">
                {c.label}
              </Chip>
            ))}
          </div>
          {scored.verdict && <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">{scored.verdict}</p>}
          {scored.oldOffer.length > 0 && <p className="mt-0.5 text-xs text-rose-300">Mentions the old offer: {scored.oldOffer.join(", ")}.</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-neutral-200 hover:bg-white/10"
        >
          {open ? "Hide the points" : weak ? `See the points · ${weak} under ${WEAK_BELOW}` : "See the points"}
        </button>
      </div>
      {improving && <p className="mt-2 text-[11px] text-cyan-200">Rewriting the points under {WEAK_BELOW} of 10, then scoring it again…</p>}
      {open && (
        <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
          {scored.subs.map((x) => (
            <li key={x.key} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs font-bold text-white">
                  {p.format === "vsl_16x9" && x.key === "meta_fit" ? "Built for the page" : x.label}
                </span>
                <span className="text-[10px] text-neutral-500">{x.weight} pts</span>
                <span className={`w-10 text-right text-sm font-extrabold ${x.score < WEAK_BELOW ? "text-amber-300" : "text-emerald-300"}`} style={NUM_FONT}>
                  {x.score}/10
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${x.score < WEAK_BELOW ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${x.score * 10}%` }} />
              </div>
              {x.why && <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">{x.why}</p>}
              {x.fix && x.score < 10 && <p className="mt-0.5 text-[11px] leading-relaxed text-cyan-200/90">Fix: {x.fix}</p>}
            </li>
          ))}
        </ul>
      )}
      {scored.improved && weak > 0 && !improving && (
        <p className="mt-2 text-[11px] text-neutral-400">
          The one automatic rewrite is used. To push a point higher, ask for it in the chat box (e.g. &ldquo;make the hook a hard number&rdquo;); it&apos;s scored again after.
        </p>
      )}
    </div>
  );
}
