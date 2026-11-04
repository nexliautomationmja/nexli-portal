"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { RIG_LABEL, lintClip, scriptTotals } from "@/lib/creative-studio/prompts";
import { CTA_CLASSES } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon, UserBubble } from "@/components/creative-studio/canvas";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** "Before: \"make the hook punchier\"" → "make the hook punchier" */
function noteFromReason(reason: string): string | null {
  const m = reason.match(/^Before: "(.*)"$/);
  return m ? m[1] : null;
}

/**
 * The script as a timeline (framework §10 review page): stat tiles, Claude's
 * notes, sectioned rows with timing, line, register, action, edit note and
 * the Kling prompt. Changes are asked for in the chat box; approve to render.
 */
export function ScriptCard({
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
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [kling, setKling] = useState<{ connected: boolean; credits: number | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/kling/status")
      .then((r) => r.json())
      .then((s) => !cancelled && setKling({ connected: Boolean(s?.connected), credits: s?.credits ?? null }))
      .catch(() => !cancelled && setKling({ connected: false, credits: null }));
    return () => {
      cancelled = true;
    };
  }, [locked]);

  const totals = useMemo(() => scriptTotals(detail.clips.map((c) => c.line)), [detail.clips]);
  const rows = useMemo(
    () =>
      detail.clips.map((c, i) => {
        const start = detail.clips.slice(0, i).reduce((s, x) => s + x.durationS, 0);
        return { clip: c, start, end: start + c.durationS, flags: lintClip(c) };
      }),
    [detail.clips]
  );
  const risks = rows.reduce((n, r) => n + r.flags.filter((f) => f.level === "risk").length, 0);
  const revisions = p.history.map((h) => noteFromReason(h.reason)).filter((n): n is string => Boolean(n)).slice(-3);

  async function undo() {
    const r = await send(api(`${p.id}/script/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function approveAndRender() {
    if (!confirm(`Approve and send ${detail.clips.length} clips to Kling? About ${totals.credits.toLocaleString("en-US")} credits from your kling.ai plan.`)) return;
    setApproving(true);
    const a = await send(api(`${p.id}/approve`), "POST");
    if (!a.ok) {
      setApproving(false);
      onError(a.error);
      return;
    }
    onChange(a.data);
    const r = await send(api(`${p.id}/render`), "POST", {});
    setApproving(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function unlock() {
    if (!confirm("Unlock the script to change it? Rendered clips stay until you write or revise the script.")) return;
    const r = await send(api(`${p.id}/approve`), "DELETE");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  function copy(id: string, text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 1400);
      })
      .catch(() => {});
  }

  const tiles = [
    { label: "Clips", value: String(totals.clips) },
    { label: "Length", value: clock(totals.seconds) },
    { label: "After trims", value: `≈ ${totals.minutesAfterTrims}m` },
    { label: "Kling credits", value: `≈ ${totals.credits.toLocaleString("en-US")}` },
  ];

  return (
    <div className="space-y-4">
      {revisions.map((note, i) => (
        <UserBubble key={`${note}-${i}`}>{note}</UserBubble>
      ))}

      <AssistantCard
        id="stage-review"
        accent="violet"
        icon={SP.script}
        title={locked ? "The approved script" : "Here's the script"}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{RIG_LABEL[p.rig]}</Chip>
            <Chip>v{p.scriptVersion}</Chip>
            {locked ? <Chip tone="green">✓ Approved</Chip> : risks > 0 ? <Chip tone="red">{risks} flagged</Chip> : null}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{t.label}</p>
              <p className="mt-0.5 text-lg font-extrabold text-white" style={NUM_FONT}>
                {t.value}
              </p>
            </div>
          ))}
        </div>

        {p.scriptNotes && (
          <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-violet-100/90 whitespace-pre-line">
            {p.scriptNotes}
          </div>
        )}

        <ol className="mt-4 space-y-1">
          {rows.map(({ clip, start, end, flags }, i) => {
            const newSection = i === 0 || rows[i - 1].clip.section !== clip.section;
            return (
              <li key={clip.id}>
                {newSection && (
                  <p className="mb-1 mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80 first:mt-0">
                    <span className="h-px w-4 bg-cyan-300/40" />
                    {clip.section}
                  </p>
                )}
                <div className="group rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]">
                  <div className="flex sm:gap-3">
                    <div className="hidden w-14 shrink-0 pt-0.5 text-right sm:block" style={NUM_FONT}>
                      <p className="text-xs font-bold text-white">#{clip.idx + 1}</p>
                      <p className="text-[10px] text-neutral-500">
                        {clock(start)}–{clock(end)}
                      </p>
                      <p className={`text-[10px] font-semibold ${clip.durationS >= 12 ? "text-rose-300" : "text-neutral-500"}`}>{clip.durationS}s</p>
                    </div>
                    <div className="min-w-0 flex-1 sm:border-l sm:border-white/10 sm:pl-3">
                      {/* Phones: the clip's number, time and length on one line, so the line uses the full width. */}
                      <p className="mb-1 text-[11px] font-bold text-neutral-400 sm:hidden" style={NUM_FONT}>
                        #{clip.idx + 1} · {clock(start)}–{clock(end)} ·{" "}
                        <span className={clip.durationS >= 12 ? "text-rose-300" : ""}>{clip.durationS}s</span>
                      </p>
                      <p className="text-[15px] font-semibold leading-snug text-white">
                        {clip.speaker && <span className="mr-1.5 rounded bg-blue-500/20 px-1.5 py-0.5 align-middle text-[10px] font-bold text-blue-300">{clip.speaker}</span>}
                        {clip.line}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {clip.register && <Chip>🎙 {clip.register}</Chip>}
                        {clip.action && <Chip>✋ {clip.action}</Chip>}
                      </div>
                      {clip.editNote && <p className="mt-1.5 text-[11px] text-neutral-500">✂ {clip.editNote}</p>}
                      {clip.cues && <p className="mt-1 text-[11px] text-neutral-500">🔤 {clip.cues}</p>}
                      {flags.map((f) => (
                        <p key={f.message} className={`mt-1 text-[11px] font-semibold ${f.level === "risk" ? "text-rose-300" : "text-amber-300/90"}`}>
                          {f.level === "risk" ? "⚠ " : "• "}
                          {f.message}
                        </p>
                      ))}
                      <button type="button" onClick={() => setOpenPrompt(openPrompt === clip.id ? null : clip.id)} className="mt-1.5 text-[11px] font-semibold text-neutral-500 hover:text-cyan-300">
                        {openPrompt === clip.id ? "▾ Kling prompt" : "▸ Kling prompt"}
                      </button>
                      {openPrompt === clip.id && (
                        <div className="mt-1.5 rounded-lg border border-white/10 bg-black/30 p-3">
                          <p className="font-mono text-[11px] leading-relaxed text-neutral-400 whitespace-pre-wrap">{clip.prompt}</p>
                          <button type="button" onClick={() => copy(clip.id, clip.prompt)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-white">
                            <SvgIcon d={SP.copy} size={12} /> {copied === clip.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          {locked ? (
            <>
              <span className="text-sm font-semibold text-emerald-300">Approved and sent to Kling.</span>
              <button type="button" onClick={unlock} className="text-xs font-semibold text-neutral-500 hover:text-white">
                Unlock to change
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                {p.history.length > 0 && (
                  <button type="button" onClick={undo} className="inline-flex items-center gap-1 font-semibold hover:text-white">
                    <SvgIcon d={SP.undo} size={14} /> Undo last change
                  </button>
                )}
                <span className="hidden sm:inline">Want changes? Say so in the box below.</span>
              </div>
              {kling && !kling.connected ? (
                <a href={`/api/dashboard/creative-studio/kling/connect?returnTo=${encodeURIComponent(`/dashboard/creative-studio/${p.id}`)}`} className={CTA_CLASSES}>
                  Connect Kling to render
                </a>
              ) : (
                <button type="button" onClick={approveAndRender} disabled={approving || !kling} className={CTA_CLASSES}>
                  <SvgIcon d={SP.film} size={16} />
                  {approving ? "Sending to Kling…" : "Approve and render"}
                </button>
              )}
            </>
          )}
        </div>
        {!locked && kling?.connected && kling.credits !== null && (
          <p className="mt-2 text-right text-[11px] text-neutral-500" style={NUM_FONT}>
            {kling.credits.toLocaleString("en-US")} Kling credits available
          </p>
        )}
      </AssistantCard>
    </div>
  );
}
