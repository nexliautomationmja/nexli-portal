"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { EditProps, EditStyle } from "@/remotion/types";
import { EDIT_STYLES, STYLE_LABEL, suggestedStyle } from "@/lib/creative-studio/edit-styles";
import { CTA_CLASSES, ProgressRing } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon, ThinkingCard, UserBubble } from "@/components/creative-studio/canvas";

const EditPreview = dynamic(() => import("@/components/creative-studio/edit-preview"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
});

type Edit = ProjectDetail["edits"][number];

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

// Signed URLs are re-issued on every refresh; keep the first one per file so
// the preview doesn't reload its video each time the project refetches.
const stableUrls = new Map<string, { url: string; at: number }>();
function stable(key: string, url: string | null): string | null {
  if (!url) return null;
  const hit = stableUrls.get(key);
  if (hit && Date.now() - hit.at < 4 * 3600_000) return hit.url;
  stableUrls.set(key, { url, at: Date.now() });
  return url;
}

/** The cut's length as the browser reads it (uploaded cuts have no stored duration). */
function measure(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    let settled = false;
    const done = (d: number | null) => {
      if (settled) return;
      settled = true;
      v.removeAttribute("src");
      v.load();
      resolve(d);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 15_000);
    v.src = url;
  });
}

/**
 * Step 6 · Edit: pick one of the four rulebook styles, Claude lays out the
 * graphics, the live preview plays the real cut with them (the same Remotion
 * composition Lambda renders), change it in plain words, then render.
 */
export function EditCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const edits = detail.edits;
  const latest: Edit | undefined = edits[edits.length - 1];
  const lastDone = [...edits].reverse().find((e) => e.status === "done" && e.outputUrl);
  const finalCuts = detail.finalCuts;
  const suggested = suggestedStyle(p.format, p.rig);
  const vertical = p.format !== "vsl_16x9";
  const aspect = vertical ? "9 / 16" : "16 / 9";

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<{ label: string; detail?: string } | null>(null);
  const [seek, setSeek] = useState<{ t: number; n: number } | null>(null);
  const [showWords, setShowWords] = useState(false);
  const [view, setView] = useState<"auto" | "preview" | "render">("auto");
  const [cutChoice, setCutChoice] = useState<string | null>(null);
  const polling = useRef(false);

  const chosenCut = finalCuts.find((f) => f.id === cutChoice) ?? finalCuts[finalCuts.length - 1];
  const rendering = latest?.status === "rendering";
  const showPicker = !latest || picking;

  // Drive a running render: Lambda progress every few seconds until it's saved.
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      const r = await send(api(`${p.id}/edit/poll`), "POST");
      polling.current = false;
      if (r.ok) onChange(r.data);
      else onError(r.error);
    }, 5000);
    return () => clearInterval(t);
  }, [rendering, p.id, onChange, onError]);

  const props: EditProps | null = useMemo(() => {
    if (!latest?.props) return null;
    const cut = finalCuts.find((f) => f.id === latest.finalCutId);
    const videoUrl = cut ? stable(`cut:${cut.id}`, cut.url) : null;
    return videoUrl ? { style: latest.style, videoUrl, ...latest.props } : null;
  }, [latest, finalCuts]);

  const elements = useMemo(() => {
    const o = latest?.props?.overlays;
    if (!o) return [];
    const rows: { label: string; text: string; start: number; end: number }[] = [];
    if (o.title) rows.push({ label: "Title", ...o.title });
    o.rungs.forEach((r) => rows.push({ label: `Rung · ${r.position.toLowerCase()}`, text: [r.pill, r.tag].filter(Boolean).join(" · "), start: r.start, end: r.end }));
    if (o.qualifier) rows.push({ label: "Qualifier", ...o.qualifier });
    if (o.cta) rows.push({ label: "CTA", ...o.cta });
    o.stickers.forEach((s, i) => rows.push({ label: `Sticker ${i + 1}`, ...s }));
    o.cards.forEach((c, i) => rows.push({ label: `Card ${i + 1} · ${c.kind}`, text: c.sub ? `${c.text} — ${c.sub}` : c.text, start: c.start, end: c.end }));
    return rows.sort((a, b) => a.start - b.start);
  }, [latest]);

  const chunks = useMemo(() => {
    const words = latest?.props?.words ?? [];
    const out: { start: number; text: string }[] = [];
    for (let i = 0; i < words.length; i += 3) {
      out.push({ start: words[i].start, text: words.slice(i, i + 3).map((w) => w.word).join(" ") });
    }
    return out;
  }, [latest]);

  async function start(style: EditStyle) {
    if (!chosenCut) return;
    setPicking(false);
    setView("auto");
    setBusy({
      label: `Claude is laying out the ${STYLE_LABEL[style]} edit…`,
      detail: "Captions on the cut's timeline, then the title, cards and their timing from your editing rulebook. About a minute.",
    });
    const durationS = chosenCut.url ? await measure(chosenCut.url) : null;
    const r = await send(api(`${p.id}/edit/start`), "POST", { style, finalCutId: chosenCut.id, durationS });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function render() {
    setBusy({ label: "Sending the edit to Remotion Lambda…" });
    const r = await send(api(`${p.id}/edit/render`), "POST");
    setBusy(null);
    setView("auto");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function undo() {
    const r = await send(api(`${p.id}/edit/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  const jump = (t: number) => setSeek((s) => ({ t, n: (s?.n ?? 0) + 1 }));

  const latestOutput = latest?.status === "done" ? stable(`render:${latest.id}`, latest.outputUrl) : null;
  const showRender = Boolean(latestOutput) && view !== "preview";
  const notes = edits.filter((e) => e.note);

  return (
    <div className="space-y-4">
      {notes.slice(-3).map((e) => (
        <UserBubble key={e.id}>{e.note}</UserBubble>
      ))}

      <AssistantCard
        id="stage-edit"
        accent="cyan"
        icon={SP.film}
        title={latest && !picking ? "Your edit" : "How would you like it edited?"}
        right={
          latest ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="blue">{STYLE_LABEL[latest.style]}</Chip>
              <Chip>v{latest.version}</Chip>
              {latest.status === "done" && <Chip tone="green">✓ Rendered</Chip>}
              {rendering && <Chip tone="blue">Rendering…</Chip>}
            </div>
          ) : null
        }
      >
        {showPicker && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-300">
              Pick a style. Claude lays it out from your editing rulebook and you watch it with the graphics on before anything renders.
            </p>
            {finalCuts.length > 1 && (
              <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                Edit this cut:
                <select
                  value={chosenCut?.id ?? ""}
                  onChange={(e) => setCutChoice(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
                >
                  {finalCuts.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900">
                      {f.filename}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {EDIT_STYLES.map((s) => {
                const current = latest?.style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void start(s.id)}
                    disabled={Boolean(busy) || rendering || !chosenCut}
                    className={`flex gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                      current ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-white/[0.03] hover:border-cyan-400/40 hover:bg-white/[0.06]"
                    }`}
                  >
                    <StyleMock style={s.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold text-white">{s.label}</p>
                        {s.id === suggested && <Chip tone="blue">Suggested</Chip>}
                        {current && <Chip>Current</Chip>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">{s.blurb}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{s.slots}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {latest && (
              <button type="button" onClick={() => setPicking(false)} className="text-xs font-semibold text-neutral-500 hover:text-white">
                Keep the {STYLE_LABEL[latest.style]} edit
              </button>
            )}
          </div>
        )}

        {latest && !picking && (
          <>
            <div className={vertical ? "grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]" : "space-y-4"}>
              <div className="space-y-2">
                <div
                  className={`overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shadow-cyan-500/10 ${vertical ? "mx-auto w-full max-w-[280px]" : "w-full"}`}
                  style={{ aspectRatio: aspect }}
                >
                  {showRender && latestOutput ? (
                    <video key={latestOutput} src={latestOutput} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                  ) : props ? (
                    <EditPreview props={props} seek={seek} />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-neutral-500">The preview appears once the layout is ready.</div>
                  )}
                </div>
                {latestOutput && (
                  <div className="mx-auto flex w-fit rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold">
                    {(["render", "preview"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setView(v)}
                        className={`rounded-full px-3 py-1 ${(v === "render") === showRender ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
                      >
                        {v === "render" ? "Final render" : "Live preview"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Style", value: STYLE_LABEL[latest.style] },
                    { label: "Length", value: clock(latest.durationS) },
                    { label: "Graphics", value: String(elements.length) },
                    { label: "Caption words", value: latest.style === "pov" ? "Off" : String(latest.props?.words.length ?? "—") },
                  ].map((t) => (
                    <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{t.label}</p>
                      <p className="truncate text-lg font-extrabold text-white" style={NUM_FONT}>
                        {t.value}
                      </p>
                    </div>
                  ))}
                </div>

                {latest.notes && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-300">{latest.notes}</p>
                )}

                {rendering && (
                  <div className="flex items-center gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3">
                    <div className="origin-left scale-[0.62] -my-6 -mr-10">
                      <ProgressRing percent={latest.progress} />
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-white">Rendering on Remotion Lambda…</p>
                      <p className="text-xs text-neutral-400">Up to 8 machines in parallel. An ad takes a minute or two; a VSL a few more. You can leave this page.</p>
                    </div>
                  </div>
                )}

                {latest.status === "failed" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    <span className="min-w-0 break-words">{latest.error ?? "The render didn't finish."}</span>
                    <button type="button" onClick={render} className="text-xs font-bold text-white hover:underline">
                      Try again
                    </button>
                  </div>
                )}

                {latest.status === "done" && latest.specs && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={NUM_FONT}>
                    <Chip tone={latest.specs.ok ? "green" : "amber"}>{latest.specs.ok ? "✓ Specs pass" : "Check specs"}</Chip>
                    <Chip>
                      {latest.specs.width}×{latest.specs.height}
                    </Chip>
                    <Chip>{latest.specs.fps ?? "?"} fps</Chip>
                    <Chip>
                      {latest.specs.durationS?.toFixed(2) ?? "?"}s / {latest.specs.expectedS.toFixed(2)}s
                    </Chip>
                    {!latest.specs.hasAudio && <Chip tone="red">No audio</Chip>}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(latest.status === "draft" || latest.status === "failed") && (
                    <button type="button" onClick={render} disabled={Boolean(busy)} className={CTA_CLASSES}>
                      Render final video
                    </button>
                  )}
                  {latestOutput && (
                    <a href={latestOutput} target="_blank" rel="noopener noreferrer" className={CTA_CLASSES}>
                      <SvgIcon d={SP.download} size={15} /> Download
                    </a>
                  )}
                  {!rendering && (
                    <button
                      type="button"
                      onClick={() => setPicking(true)}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      Change style
                    </button>
                  )}
                  {edits.length > 1 && !rendering && (
                    <button type="button" onClick={undo} className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-neutral-500 hover:text-white">
                      <SvgIcon d={SP.undo} size={14} /> Undo last change
                    </button>
                  )}
                </div>
                {lastDone && lastDone.id !== latest.id && lastDone.outputUrl && (
                  <p className="text-xs text-neutral-500">
                    Last render: v{lastDone.version} · {STYLE_LABEL[lastDone.style]} ·{" "}
                    <a href={lastDone.outputUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-neutral-300 hover:text-white">
                      Download
                    </a>
                  </p>
                )}
                {latest.status === "draft" && (
                  <p className="text-xs text-neutral-400">
                    Watch it, then tell me in the box below what to change, e.g. <span className="text-neutral-200">“shorter title”</span> or{" "}
                    <span className="text-neutral-200">“qualifier at 0:03”</span>.
                  </p>
                )}
              </div>
            </div>

            {elements.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">On screen</p>
                {elements.map((el, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => jump(el.start)}
                    disabled={showRender}
                    className="flex w-full items-baseline gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-left hover:border-cyan-400/30 hover:bg-white/[0.05] disabled:hover:border-white/5"
                  >
                    <span className="w-[86px] shrink-0 text-[10px] font-bold text-cyan-300" style={NUM_FONT}>
                      {clock(el.start)}–{clock(el.end)}
                    </span>
                    <span className="w-[92px] shrink-0 text-[10px] font-bold uppercase tracking-wide text-neutral-500">{el.label}</span>
                    <span className="min-w-0 flex-1 text-[13px] text-neutral-200">{el.text}</span>
                  </button>
                ))}
              </div>
            )}

            {chunks.length > 0 && latest.style !== "pov" && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowWords((v) => !v)} className="text-[11px] font-semibold text-neutral-500 hover:text-white">
                  {showWords ? "▾" : "▸"} Captions ({chunks.length} lines) · read them before rendering
                </button>
                {showWords && (
                  <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/20 p-3">
                    {chunks.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => jump(c.start)}
                        disabled={showRender}
                        className="rounded-md bg-white/[0.04] px-2 py-1 text-left text-[11px] font-bold text-neutral-200 hover:bg-cyan-500/15 hover:text-white"
                        style={NUM_FONT}
                      >
                        <span className="mr-1 text-neutral-500">{clock(c.start)}</span>
                        {c.text}
                      </button>
                    ))}
                    <p className="w-full pt-1 text-[10px] text-neutral-500">Wrong word? Say it in the box below, e.g. “the caption says CALCULATING, it should be CALENDAR”.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </AssistantCard>

      {busy && <ThinkingCard accent="cyan" label={busy.label} detail={busy.detail} />}
    </div>
  );
}

/** A tiny drawing of each style's layout, for the picker. */
function StyleMock({ style }: { style: EditStyle }) {
  const wide = style === "vsl";
  const people = style === "ladder" ? [22, 50, 78] : [50];
  const captions = (
    <div className="absolute bottom-[14%] left-1/2 flex -translate-x-1/2 gap-[2px]">
      <span className="h-[3px] w-2 rounded bg-white" />
      <span className="h-[3px] w-2.5 rounded bg-gradient-to-r from-blue-500 to-cyan-400" />
      <span className="h-[3px] w-2 rounded bg-white/50" />
    </div>
  );
  return (
    <div
      className={`relative shrink-0 self-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-slate-600 to-slate-900 ${wide ? "h-[56px] w-[100px]" : "h-[100px] w-[56px]"}`}
      aria-hidden="true"
    >
      {people.map((x) => (
        <div key={x}>
          <div className="absolute bottom-0 h-[42%] -translate-x-1/2 rounded-t-full bg-slate-400/50" style={{ left: `${x}%`, width: style === "ladder" ? "24%" : wide ? "26%" : "52%" }} />
          <div className="absolute -translate-x-1/2 rounded-full bg-slate-300/60" style={{ left: `${x}%`, bottom: "40%", width: style === "ladder" ? "13%" : wide ? "12%" : "26%", aspectRatio: "1" }} />
        </div>
      ))}
      {style === "solo" && (
        <>
          <div className="absolute left-[12%] right-[12%] top-[16%] h-[8%] rounded-sm bg-white" />
          {captions}
        </>
      )}
      {style === "pov" && (
        <>
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute left-[14%] right-[14%] top-[24%] space-y-[2px] rounded-[3px] bg-white px-1 py-[3px]">
            <div className="h-[2px] w-full rounded bg-black/80" />
            <div className="h-[2px] w-2/3 rounded bg-black/80" />
          </div>
        </>
      )}
      {style === "vsl" && (
        <>
          <div className="absolute left-[5%] top-[26%] w-[30%] space-y-[3px] rounded-[3px] bg-[#0a0e1e]/95 p-[4px]">
            <div className="h-[2px] w-full rounded bg-cyan-400" />
            <div className="h-[2px] w-2/3 rounded bg-white/70" />
          </div>
          {captions}
        </>
      )}
      {style === "ladder" && (
        <>
          <div className="absolute left-[12%] right-[12%] top-[12%] h-[7%] rounded-sm bg-white" />
          {people.map((x) => (
            <div key={x} className="absolute top-[24%] h-[6%] w-[18%] -translate-x-1/2 rounded-full bg-emerald-500" style={{ left: `${x}%` }} />
          ))}
          <div className="absolute left-[10%] right-[10%] top-[50%] h-[6%] rounded-sm bg-gradient-to-r from-red-600 to-red-800" />
          {captions}
        </>
      )}
    </div>
  );
}
