"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CREDITS_PER_SECOND, KIND_LABEL, RIG_LABEL, lintClip, scriptTotals } from "@/lib/creative-studio/prompts";
import type { ClipKind } from "@/lib/creative-studio/tables";
import { CTA_CLASSES } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon, UserBubble } from "@/components/creative-studio/canvas";
import { WatchPart } from "@/components/creative-studio/source-card";
import { ShowPart } from "@/components/creative-studio/show-part";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const KIND_ICON: Record<ClipKind, string> = { to_camera: "🎥", in_scene: "💬", voiceover: "🔊", silent: "🎬" };

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
  // Story videos: the clip whose scene picker is open.
  const [moving, setMoving] = useState<string | null>(null);
  // A reaction video is written as a one-scene story, but reads as hook → watch → react (no scenes to pick).
  const reaction = detail.reaction;
  // Clips on screen: also one scene (the presenter talking), with a clip shown on some lines.
  const onscreen = detail.media?.mode === "onscreen" ? detail.media : null;
  const story = detail.story && !reaction && !onscreen;
  const sceneOf = useMemo(() => new Map(detail.scenes.filter((sc) => sc.frameId).map((sc) => [sc.frameId as string, sc])), [detail.scenes]);
  const specOf = useMemo(() => new Map((p.frameSpec?.scenes ?? []).map((sc) => [sc.frameId, sc])), [p.frameSpec]);

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

  const totals = useMemo(() => {
    if (!reaction) return scriptTotals(detail.clips.map((c) => (c.kind === "silent" ? "" : c.line)));
    // A watch clip's length follows the part of the video watched, so count what's stored.
    const seconds = detail.clips.reduce((s, c) => s + c.durationS, 0);
    return { clips: detail.clips.length, seconds, minutesAfterTrims: Math.round(((seconds * 0.85) / 60) * 10) / 10, credits: seconds * CREDITS_PER_SECOND };
  }, [detail.clips, reaction]);

  async function moveToScene(clipId: string, frameId: string) {
    setMoving(null);
    const r = await send(api(`${p.id}/clips/${clipId}`), "PATCH", { frameId });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
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
            <Chip>{reaction ? "Reaction" : story ? `Story · ${detail.scenes.filter((sc) => sc.frameId).length} scenes` : RIG_LABEL[p.rig]}</Chip>
            <Chip>v{p.scriptVersion}</Chip>
            {locked ? <Chip tone="green">✓ Approved</Chip> : risks > 0 ? <Chip tone="red">{risks} flagged</Chip> : null}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{t.label}</p>
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
            const scene = story && clip.frameId ? sceneOf.get(clip.frameId) : undefined;
            const newScene = story && (i === 0 || rows[i - 1].clip.frameId !== clip.frameId);
            const kind = (clip.kind ?? "to_camera") as ClipKind;
            // Someone other than the presenter talking: their short name from the scene description.
            const speakerName =
              story && clip.speaker
                ? specOf.get(clip.frameId ?? "")?.people.find((x) => x.position === clip.speaker && !x.presenter)?.shortName ?? null
                : null;
            return (
              <li key={clip.id}>
                {newScene && scene && (
                  <div className="mb-1 mt-5 flex items-center gap-2 first:mt-0">
                    {scene.url && (
                      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                      <img src={scene.url} alt="" className="h-9 w-auto rounded-md border border-white/15 object-cover" style={{ aspectRatio: p.format === "vsl_16x9" ? "16 / 9" : "9 / 16" }} />
                    )}
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-300">
                      Scene {scene.number}
                      {scene.label && <span className="font-semibold normal-case tracking-normal text-neutral-300"> · {scene.label}</span>}
                    </p>
                  </div>
                )}
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
                      <p className="text-[10px] text-neutral-400">
                        {clock(start)}–{clock(end)}
                      </p>
                      <p className={`text-[10px] font-semibold ${clip.durationS >= 12 ? "text-rose-300" : "text-neutral-400"}`}>{clip.durationS}s</p>
                    </div>
                    <div className="min-w-0 flex-1 sm:border-l sm:border-white/10 sm:pl-3">
                      {/* Phones: the clip's number, time and length on one line, so the line uses the full width. */}
                      <p className="mb-1 text-[11px] font-bold text-neutral-400 sm:hidden" style={NUM_FONT}>
                        #{clip.idx + 1} · {clock(start)}–{clock(end)} ·{" "}
                        <span className={clip.durationS >= 12 ? "text-rose-300" : ""}>{clip.durationS}s</span>
                      </p>
                      {kind === "silent" ? (
                        <p className="text-[15px] font-semibold leading-snug text-neutral-200">
                          <span
                            className={`mr-1.5 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold ${reaction && clip.watch ? "bg-violet-500/25 text-violet-200" : "bg-white/10 text-neutral-300"}`}
                          >
                            {reaction && clip.watch ? "WATCHING" : "NO TALKING"}
                          </span>
                          {clip.action}
                        </p>
                      ) : (
                        <p className="text-[15px] font-semibold leading-snug text-white">
                          {(speakerName || (!story && clip.speaker)) && (
                            <span className="mr-1.5 rounded bg-blue-500/20 px-1.5 py-0.5 align-middle text-[10px] font-bold text-blue-300">{speakerName ?? clip.speaker}</span>
                          )}
                          {clip.line}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {story && (
                          <span className="relative">
                            <button
                              type="button"
                              onClick={() => !locked && setMoving(moving === clip.id ? null : clip.id)}
                              disabled={locked}
                              aria-expanded={moving === clip.id}
                              aria-label={`Clip ${clip.idx + 1} plays in scene ${scene?.number ?? 1}${locked ? "" : ". Move it to another scene"}`}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-blue-200 enabled:hover:border-blue-300/60"
                            >
                              {scene?.url && (
                                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                                <img src={scene.url} alt="" className="h-5 w-5 rounded-full object-cover" />
                              )}
                              Scene {scene?.number ?? 1}
                              {!locked && <span aria-hidden="true">▾</span>}
                            </button>
                            {moving === clip.id && (
                              <span className="absolute left-0 top-full z-30 mt-1 flex w-max max-w-[80vw] gap-1.5 overflow-x-auto rounded-xl border border-white/15 bg-[#0b1220] p-2 shadow-2xl shadow-black/50">
                                {detail.scenes
                                  .filter((sc) => sc.frameId)
                                  .map((sc) => (
                                    <button
                                      key={sc.id}
                                      type="button"
                                      // A scene the script hasn't described yet can't take clips (its prompt would describe another scene).
                                      disabled={!specOf.has(sc.frameId as string)}
                                      onClick={() => void moveToScene(clip.id, sc.frameId as string)}
                                      className={`w-14 shrink-0 overflow-hidden rounded-lg border text-center disabled:opacity-35 ${sc.frameId === clip.frameId ? "border-blue-400" : "border-white/10 enabled:hover:border-white/30"}`}
                                      aria-label={specOf.has(sc.frameId as string) ? `Move clip ${clip.idx + 1} to scene ${sc.number}` : `Scene ${sc.number} isn't in the script yet`}
                                    >
                                      {sc.url && (
                                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                                        <img src={sc.url} alt="" className="w-full object-cover" style={{ aspectRatio: p.format === "vsl_16x9" ? "16 / 9" : "9 / 16" }} />
                                      )}
                                      <span className="block py-0.5 text-[10px] font-bold text-white">{sc.number}</span>
                                    </button>
                                  ))}
                              </span>
                            )}
                          </span>
                        )}
                        {story && kind !== "silent" && <Chip tone={kind === "to_camera" ? "neutral" : "blue"}>{KIND_ICON[kind]} {KIND_LABEL[kind]}</Chip>}
                        {clip.register && kind !== "silent" && <Chip>🎙 {clip.register}</Chip>}
                        {clip.action && kind !== "silent" && <Chip>✋ {clip.action}</Chip>}
                      </div>
                      {reaction && clip.watch && (
                        <WatchPart
                          projectId={p.id}
                          clipId={clip.id}
                          watch={clip.watch}
                          source={reaction.source}
                          locked={locked}
                          onChange={onChange}
                          onError={onError}
                        />
                      )}
                      {onscreen && kind !== "silent" && (
                        <ShowPart
                          key={`${clip.id}:${JSON.stringify(clip.show ?? null)}`}
                          projectId={p.id}
                          clipId={clip.id}
                          show={clip.show ?? null}
                          media={onscreen}
                          locked={locked}
                          onChange={onChange}
                          onError={onError}
                        />
                      )}
                      {clip.editNote && <p className="mt-1.5 text-[11px] text-neutral-400">✂ {clip.editNote}</p>}
                      {clip.cues && <p className="mt-1 text-[11px] text-neutral-400">🔤 {clip.cues}</p>}
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
              {reaction && (!reaction.source?.proxyUrl || reaction.scriptFor !== reaction.source.id) ? (
                <p className="max-w-xs text-right text-xs text-amber-200">
                  {!reaction.source
                    ? "Upload the video to react to before approving."
                    : reaction.scriptFor !== reaction.source.id
                      ? "Rewrite the script for this video before approving."
                      : reaction.source.proxyError
                        ? "Fix the video above before approving: it can't change after that."
                        : "Approve once the video's light copy is ready (it can't change after that)."}
                </p>
              ) : kling && !kling.connected ? (
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
          <p className="mt-2 text-right text-[11px] text-neutral-400" style={NUM_FONT}>
            {kling.credits.toLocaleString("en-US")} Kling credits available
          </p>
        )}
      </AssistantCard>
    </div>
  );
}
