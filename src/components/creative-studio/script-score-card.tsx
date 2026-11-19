"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { BAND } from "@/lib/ads/grader-shared";
import { TARGETS, nextScoreStep, offerCheck, pathTo, pendingLive, type ScorePath } from "@/lib/creative-studio/script-score-shared";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { Chip } from "@/components/creative-studio/canvas";

const BAND_TONE = { run: "green", fix: "amber", skip: "red" } as const;
const BAND_RING = { run: "#34d399", fix: "#fbbf24", skip: "#fb7185" } as const;

/**
 * The script's score out of 100 on the grader's seven points, as a fixed
 * checklist (script-score-shared.ts): 12 checks measured from the words, 7
 * yes/no answers that only count with a quote from the script. The same
 * script always gets the same score. Shows how to reach 80 and 90 (exact
 * points per change) with a rewrite button for each. While the script can
 * still change it runs on its own: scores a new or changed script, and once
 * per video rewrites it along the path to 90 when it's under 80. The batch
 * board does the same; a claim on the server keeps two pages from running it twice.
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
    const improving = pendingKind === "improve" || pendingKind === "apply";
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
        {!locked && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" aria-hidden="true" />}
        <p className="text-xs text-neutral-300">
          {improving
            ? "Rewriting it with the recommended changes and the current offer, then scoring it again…"
            : locked
              ? "Not scored (approved before it could be)."
              : "Scoring the script on 19 fixed checks…"}
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
  const improving = pendingKind === "improve" || pendingKind === "apply";
  const pct = Math.max(0, Math.min(100, scored.score));
  const offer = offerCheck(scored);
  const checks = scored.checks ?? [];
  const passed = checks.filter((c) => c.pass).length;
  // How to get to 80 and 90: the fewest failed checks, biggest first. Every check is worth fixed points, so the projection is exact.
  const paths = TARGETS.filter((t) => t > scored.score).map((t) => pathTo(scored, t));
  const canRewrite = !locked && !improving && !live && p.status === "scripted";
  const pointLabel = (key: string, label: string) => (p.format === "vsl_16x9" && key === "meta_fit" ? "Built for the page" : label);

  async function rewrite(path: ScorePath) {
    if (!confirm(`Rewrite the script with ${path.steps.length === 1 ? "this change" : `these ${path.steps.length} changes`} (→ ${path.reaches}/100 if every one lands)? The current version is kept in the script history, and the new one is scored again.`)) return;
    const r = await send(api(`${p.id}/script/score`), "POST", { action: "apply", target: path.target });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

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
            {scored.before !== null && <Chip tone="blue">Was {scored.before}</Chip>}
            {scored.caps.map((c) => (
              <Chip key={c.key} tone="red">
                {c.label} · max {c.max}
              </Chip>
            ))}
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            {passed} of {checks.length} checks pass · fixed checklist: the same script always gets the same score
          </p>
          {scored.verdict && <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">{scored.verdict}</p>}
          <p className={`mt-0.5 text-[11px] ${offer.ok ? "text-emerald-300/90" : "text-rose-300"}`}>
            {offer.ok ? "✓" : "✕"} Offer check: {offer.text}.
          </p>
          {scored.caps.map((c) => (
            <p key={c.key} className="mt-0.5 text-[11px] text-rose-300">
              ✕ {c.label}: {c.why}. The score can&apos;t pass {c.max} until it&apos;s gone.
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-neutral-200 hover:bg-white/10"
        >
          {open ? "Hide the checks" : `See all ${checks.length} checks`}
        </button>
      </div>

      {improving && <p className="mt-2 text-[11px] text-cyan-200">Rewriting it with the recommended changes and the current offer, then scoring it again…</p>}

      {paths.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {paths.map((path) => (
            <div key={path.target} className="flex flex-col rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-white">To reach {path.target}</p>
                <span className={`text-[11px] font-bold ${path.enough ? "text-cyan-200" : "text-amber-200"}`} style={NUM_FONT}>
                  {scored.score} → {path.reaches}
                </span>
              </div>
              <ol className="mt-2 flex-1 space-y-1.5">
                {path.steps.map((st) => (
                  <li key={st.id} className="flex gap-2 text-[11px] leading-relaxed">
                    <span className="mt-px shrink-0 self-start rounded-md bg-emerald-500/15 px-1.5 font-bold text-emerald-300" style={NUM_FONT}>
                      +{st.gain}
                    </span>
                    <span className="min-w-0 text-neutral-300">
                      <b className="text-white">{st.label}.</b> {st.fix}
                    </span>
                  </li>
                ))}
              </ol>
              {!path.enough && (
                <p className="mt-2 text-[11px] text-neutral-400">
                  Every failed check together reaches {path.reaches}
                  {scored.caps.length ? ` (the risky claim holds it at ${scored.caps[0].max} until it's removed)` : ""}.
                </p>
              )}
              {canRewrite && path.steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => void rewrite(path)}
                  className="mt-3 w-full rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 sm:w-auto sm:self-start"
                >
                  Rewrite for {path.target}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {paths.length === 0 && <p className="mt-2 text-[11px] text-emerald-300/90">At {scored.score}, it&apos;s past 90. Nothing on the path left.</p>}

      {open && (
        <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
          {scored.subs.map((x) => (
            <li key={x.key} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs font-bold text-white">{pointLabel(x.key, x.label)}</span>
                <span className={`text-sm font-extrabold ${x.points < x.weight ? "text-amber-300" : "text-emerald-300"}`} style={NUM_FONT}>
                  {x.points}/{x.weight}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {checks
                  .filter((c) => c.point === x.key)
                  .map((c) => (
                    <li key={c.id} className="flex gap-2 text-[11px] leading-relaxed">
                      <span className={`shrink-0 font-bold ${c.pass ? "text-emerald-300" : "text-rose-300"}`}>{c.pass ? "✓" : "✕"}</span>
                      <span className="min-w-0 text-neutral-300">
                        {c.label} <span className="text-neutral-500">({c.points} pts · {c.source === "measured" ? "measured" : "Claude, with a quote"})</span>
                        <span className="block text-neutral-400">{c.evidence}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
