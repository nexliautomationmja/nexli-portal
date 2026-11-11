"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { SIZE_MAX, SIZE_MIN, type CaptionStyle, type EditLayout, type EditOverlays, type EditProps, type EditStyle, type MovableSlot, type PipSize, type SizeSlot } from "@/remotion/types";
import { EDIT_STYLES, STYLE_LABEL, suggestedStyle } from "@/lib/creative-studio/edit-styles";
import { sameTarget, setText, setWindow, slotClashes, textLimit, windowOf, type TextTarget } from "@/lib/creative-studio/edit-text";
import { CTA_CLASSES, ProgressRing } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send, videoFileName } from "@/components/creative-studio/client";
import { SaveVideoLink } from "@/components/creative-studio/save-video";
import { AwsLimitNote } from "@/components/creative-studio/aws-limit-note";
import { AssistantCard, Chip, SP, SvgIcon, ThinkingCard, UserBubble } from "@/components/creative-studio/canvas";

const EditPreview = dynamic(() => import("@/components/creative-studio/edit-preview"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
});

type Edit = ProjectDetail["edits"][number];

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** A caption look without its rulebook-default values, so "Nexli" is the same as no look at all. */
function plainLook(l: CaptionStyle): CaptionStyle {
  const out: CaptionStyle = { ...l };
  if (out.perLine === 3) delete out.perLine;
  if (out.scale === 1) delete out.scale;
  if (out.case === "caps") delete out.case;
  if (out.highlight === "gradient") delete out.highlight;
  if (!out.box) delete out.box;
  if (out.font === "outfit") delete out.font;
  return out;
}

function withLook(o: EditOverlays, look: CaptionStyle): EditOverlays {
  const { captionStyle: _old, ...rest } = o;
  void _old;
  const clean = plainLook(look);
  return Object.keys(clean).length ? { ...rest, captionStyle: clean } : rest;
}

const LOOK_PRESETS: { label: string; look: CaptionStyle }[] = [
  { label: "Nexli", look: {} },
  { label: "Bold box", look: { box: true, scale: 1.1 } },
  { label: "One word at a time", look: { perLine: 1, scale: 1.35 } },
  { label: "Minimal", look: { case: "title", highlight: "none", scale: 0.9 } },
];

const LOOK_OPTIONS: { label: string; key: keyof CaptionStyle; values: { v: CaptionStyle[keyof CaptionStyle]; label: string }[] }[] = [
  { label: "Words per line", key: "perLine", values: [1, 2, 3, 4].map((n) => ({ v: n as CaptionStyle["perLine"], label: String(n) })) },
  { label: "Size", key: "scale", values: [{ v: 0.85, label: "S" }, { v: 1, label: "M" }, { v: 1.2, label: "L" }, { v: 1.4, label: "XL" }] },
  { label: "Case", key: "case", values: [{ v: "caps", label: "ABC" }, { v: "title", label: "Abc" }, { v: "lower", label: "abc" }] },
  {
    label: "Highlight",
    key: "highlight",
    values: [{ v: "gradient", label: "Nexli" }, { v: "green", label: "Green" }, { v: "yellow", label: "Yellow" }, { v: "none", label: "Off" }],
  },
  { label: "Background", key: "box", values: [{ v: false, label: "Shade" }, { v: true, label: "Box" }] },
  { label: "Font", key: "font", values: [{ v: "outfit", label: "Outfit" }, { v: "jakarta", label: "Jakarta" }] },
];
const LOOK_DEFAULT: Required<CaptionStyle> = { perLine: 3, scale: 1, case: "caps", highlight: "gradient", box: false, font: "outfit" };

/** The size a text element shares (every sticker one size, every card one size); pills and tags have none. */
function sizeSlotOf(t: TextTarget): SizeSlot | null {
  if (t.slot === "title" || t.slot === "qualifier" || t.slot === "cta") return t.slot;
  if (t.slot === "sticker") return "stickers";
  if (t.slot === "card") return "cards";
  return null;
}

/** "2.4", "0:02.4" or "1:05" → seconds (NaN if unreadable). */
function parseClock(v: string): number {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : NaN;
}

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
export function measureDuration(url: string): Promise<number | null> {
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
  const [seek, setSeek] = useState<{ t: number; n: number; still?: boolean } | null>(null);
  // Move mode: tap or drag on the preview to place the picked element (a reaction video's corner video also has a size and captions).
  const [moving, setMoving] = useState<{ slot: MovableSlot; layout: EditLayout; pip?: { size: PipSize; captions: boolean } } | null>(null);
  const dragging = useRef(false);
  const [showWords, setShowWords] = useState(false);
  const [view, setView] = useState<"auto" | "preview" | "render">("auto");
  const [cutChoice, setCutChoice] = useState<string | null>(null);
  const [describe, setDescribe] = useState("");
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

  // A reaction video: the corner video plays the light copy of the video she reacts to.
  const sourceUrl = detail.reaction?.source?.proxyUrl ?? null;
  const props: EditProps | null = useMemo(() => {
    if (!latest?.props) return null;
    const cut = finalCuts.find((f) => f.id === latest.finalCutId);
    const videoUrl = cut ? stable(`cut:${cut.id}`, cut.url) : null;
    if (!videoUrl) return null;
    const { pip: stored, ...rest } = latest.props;
    if (!stored) return { style: latest.style, videoUrl, ...rest };
    const { sourceId, summary: _summary, ...track } = stored;
    void _summary;
    return { style: latest.style, videoUrl, ...rest, pip: { ...track, src: stable(`pip:${sourceId}`, sourceUrl) ?? "" } };
  }, [latest, finalCuts, sourceUrl]);

  const elements = useMemo(() => {
    const o = latest?.props?.overlays;
    if (!o) return [];
    const rows: { label: string; text: string; start: number; end: number; target?: TextTarget }[] = [];
    if (o.title) rows.push({ label: "Title", ...o.title, target: { slot: "title" } });
    o.rungs.forEach((r, i) => {
      const where = r.position.toLowerCase();
      rows.push({ label: `Pill · ${where}`, text: r.pill, start: r.start, end: r.end, target: { slot: "rung", index: i, field: "pill" } });
      rows.push({ label: `Tag · ${where}`, text: r.tag, start: r.start, end: r.end, target: { slot: "rung", index: i, field: "tag" } });
    });
    if (o.qualifier) rows.push({ label: "Qualifier", ...o.qualifier, target: { slot: "qualifier" } });
    if (o.cta) rows.push({ label: "CTA", ...o.cta, target: { slot: "cta" } });
    (o.zooms ?? []).forEach((z) => rows.push({ label: "Zoom", text: `Punch in to ${z.scale}×`, start: z.start, end: z.end }));
    o.stickers.forEach((s, i) => rows.push({ label: `Sticker ${i + 1}`, ...s, target: { slot: "sticker", index: i } }));
    o.cards.forEach((c, i) => {
      rows.push({ label: `Card ${i + 1} · ${c.kind}`, text: c.text, start: c.start, end: c.end, target: { slot: "card", index: i, field: "text" } });
      if (c.sub) rows.push({ label: `Card ${i + 1} · line 2`, text: c.sub, start: c.start, end: c.end, target: { slot: "card", index: i, field: "sub" } });
    });
    return rows.sort((a, b) => a.start - b.start);
  }, [latest]);

  // What can be placed by hand in this edit, and a moment when each one is on screen.
  const movable = useMemo(() => {
    const o = latest?.props?.overlays;
    const words = latest?.props?.words ?? [];
    if (!latest || !o) return [];
    const at = (x: { start: number; end: number }) => Math.min(x.start + 0.6, x.end);
    const list: { slot: MovableSlot; label: string; t: number }[] = [];
    if (o.title) list.push({ slot: "title", label: "Title", t: at(o.title) });
    if (o.qualifier) list.push({ slot: "qualifier", label: "Qualifier", t: at(o.qualifier) });
    if (o.cta) list.push({ slot: "cta", label: "CTA", t: at(o.cta) });
    if (latest.style !== "pov" && o.captions !== false && words.length) list.push({ slot: "captions", label: "Captions", t: words[0].start + 0.15 });
    if (o.stickers.length) list.push({ slot: "stickers", label: "Stickers", t: at(o.stickers[0]) });
    if (o.cards.length) list.push({ slot: "cards", label: "Cards", t: at(o.cards[0]) });
    const pip = latest.props?.pip;
    if (pip) list.push({ slot: "pip", label: "Corner video", t: (pip.windows[0]?.start ?? 0) + 0.5 });
    return list;
  }, [latest]);

  // Captions by hand: the look (draft while the panel is open) and retyping one line.
  const [captionDraft, setCaptionDraft] = useState<CaptionStyle | null>(null);
  const [lineEdit, setLineEdit] = useState<{ from: number; to: number; text: string } | null>(null);
  const savedLook = latest?.props?.overlays.captionStyle;
  const perLine = (captionDraft ?? savedLook)?.perLine ?? 3;

  const chunks = useMemo(() => {
    const words = latest?.props?.words ?? [];
    const out: { start: number; from: number; to: number; text: string }[] = [];
    for (let i = 0; i < words.length; i += perLine) {
      const to = Math.min(words.length, i + perLine) - 1;
      out.push({ start: words[i].start, from: i, to, text: words.slice(i, to + 1).map((w) => w.word).join(" ") });
    }
    return out;
  }, [latest, perLine]);

  async function start(style: EditStyle, instruction?: string) {
    if (!chosenCut) return;
    setPicking(false);
    setView("auto");
    setBusy(
      instruction
        ? { label: "Claude is building your edit…", detail: `“${instruction}”` }
        : {
            label: `Claude is laying out the ${STYLE_LABEL[style]} edit…`,
            detail: "Captions on the cut's timeline, then the title, cards and their timing from your editing rulebook. About a minute.",
          }
    );
    const durationS = chosenCut.url ? await measureDuration(chosenCut.url) : null;
    const r = await send(api(`${p.id}/edit/start`), "POST", { style, instruction, finalCutId: chosenCut.id, durationS });
    setBusy(null);
    if (r.ok) {
      setDescribe("");
      onChange(r.data);
    } else onError(r.error);
  }
  // The clips changed after this edit was made (re-made clips → a newer final cut).
  const newestCut = finalCuts[finalCuts.length - 1];
  const onOldCut = Boolean(latest && newestCut && latest.finalCutId !== newestCut.id);
  /** The same edit on the newest cut: same style and instruction, hand placements and caption look kept. */
  async function moveToNewCut() {
    if (!latest || !newestCut) return;
    setView("auto");
    setBusy({ label: "Claude is putting your edit on the new cut…", detail: `${STYLE_LABEL[latest.style]}, with your placements and caption look. About a minute.` });
    const durationS = newestCut.url ? await measureDuration(newestCut.url) : null;
    const instruction = latest.props?.instruction ?? (latest.style === "custom" ? latest.note ?? undefined : undefined);
    const r = await send(api(`${p.id}/edit/start`), "POST", { style: latest.style, instruction, finalCutId: newestCut.id, durationS, keepLook: true });
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
  async function leaveLine() {
    setBusy({ label: "Taking it out of line…" });
    const r = await send(api(`${p.id}/edit/render`), "DELETE");
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function undo() {
    const r = await send(api(`${p.id}/edit/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  const jump = (t: number) => setSeek((s) => ({ t, n: (s?.n ?? 0) + 1 }));
  const still = (t: number) => setSeek((s) => ({ t, n: (s?.n ?? 0) + 1, still: true }));

  function startMoving() {
    setEditing(null);
    const first = movable[0];
    if (!first || !latest?.props) return;
    setView("preview");
    const pip = latest.props.pip;
    setMoving({
      slot: first.slot,
      layout: { ...(latest.props.overlays.layout ?? {}) },
      ...(pip ? { pip: { size: pip.size ?? "m", captions: pip.captions !== false } } : {}),
    });
    still(first.t);
  }
  function pick(slot: MovableSlot) {
    setMoving((m) => (m ? { ...m, slot } : m));
    const item = movable.find((x) => x.slot === slot);
    if (item) still(item.t);
  }
  function place(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    let x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (Math.abs(x - 0.5) < 0.03) x = 0.5; // snap to centre
    const spot = { x: Math.round(x * 10_000) / 10_000, y: Math.round(y * 10_000) / 10_000 };
    setMoving((m) => (m ? { ...m, layout: { ...m.layout, [m.slot]: spot } } : m));
  }
  function resetSlot() {
    setMoving((m) => {
      if (!m) return m;
      const layout = { ...m.layout };
      delete layout[m.slot];
      return { ...m, layout };
    });
  }
  async function saveLayout() {
    if (!moving) return;
    setBusy({ label: "Saving where everything sits…" });
    const r = await send(api(`${p.id}/edit/layout`), "POST", { layout: moving.layout, ...(moving.pip ? { pip: moving.pip } : {}) });
    setBusy(null);
    if (r.ok) {
      setMoving(null);
      onChange(r.data);
    } else onError(r.error);
  }
  // Hand-editing one piece of text: live in the preview, then yours or one of Claude's versions.
  const [editing, setEditing] = useState<{
    target: TextTarget;
    text: string;
    preview: string | null;
    options: string[] | null;
    aboutYours: string;
    loading: boolean;
    /** When it shows — the whole video, or a From/To typed (or taken from the playhead). */
    timing: { mode: "whole" | "custom"; start: string; end: string };
    /** Its size (1 = the rulebook size), dragged live on the preview. */
    size: number;
  } | null>(null);
  const playhead = useRef<() => number>(() => 0);
  const onPlayer = useCallback((now: () => number) => {
    playhead.current = now;
  }, []);

  function openEditor(target: TextTarget, text: string, start: number, end: number) {
    setMoving(null);
    setView("preview");
    const D = latest?.durationS ?? end;
    const whole = start <= 0.05 && end >= D - 0.05;
    setEditing({
      target,
      text,
      preview: null,
      options: null,
      aboutYours: "",
      loading: false,
      timing: { mode: whole ? "whole" : "custom", start: clock(start), end: clock(end) },
      size: (sizeSlotOf(target) && latest?.props?.overlays.sizes?.[sizeSlotOf(target)!]) || 1,
    });
    still(Math.min(start + 0.6, D));
  }
  async function saveSize() {
    const slot = editing ? sizeSlotOf(editing.target) : null;
    if (!editing || !slot) return;
    setBusy({ label: "Saving the size…" });
    const r = await send(api(`${p.id}/edit/size`), "POST", { slot, scale: editing.size });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function saveTiming() {
    if (!editing || !draftWindow) return;
    setBusy({ label: "Saving when it shows…" });
    const r = await send(
      api(`${p.id}/edit/timing`),
      "POST",
      editing.timing.mode === "whole" ? { target: editing.target, whole: true } : { target: editing.target, start: draftWindow.start, end: draftWindow.end }
    );
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  function setTiming(patch: Partial<{ mode: "whole" | "custom"; start: string; end: string }>) {
    setEditing((e) => (e ? { ...e, timing: { ...e.timing, ...patch } } : e));
  }
  async function getVersions() {
    if (!editing?.text.trim()) return;
    const ask = editing;
    setEditing({ ...ask, loading: true, options: null, preview: null });
    try {
      const r = await fetch(api(`${p.id}/edit/suggest`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: ask.target, text: ask.text }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
      setEditing((e) => (e && sameTarget(e.target, ask.target) ? { ...e, loading: false, options: data.options ?? [], aboutYours: data.aboutYours ?? "" } : e));
    } catch (err) {
      setEditing((e) => (e ? { ...e, loading: false } : e));
      onError(err instanceof Error ? err.message : "Getting versions failed");
    }
  }
  async function applyText(text: string) {
    if (!editing) return;
    setBusy({ label: "Saving the new text…" });
    const r = await send(api(`${p.id}/edit/text`), "POST", { target: editing.target, text });
    setBusy(null);
    if (r.ok) {
      setEditing(null);
      onChange(r.data);
    } else onError(r.error);
  }

  const withLayout =
    props && moving
      ? { ...props, overlays: { ...props.overlays, layout: moving.layout }, ...(props.pip && moving.pip ? { pip: { ...props.pip, ...moving.pip } } : {}) }
      : props;
  const D = latest?.durationS ?? 0;
  // The draft window: whole video, or the typed From/To when it's readable and at least 0.5 s.
  const draftWindow = (() => {
    if (!editing) return null;
    if (editing.timing.mode === "whole") return { start: 0, end: D };
    const start = parseClock(editing.timing.start);
    const end = parseClock(editing.timing.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > D + 0.05 || end - start < 0.5) return null;
    return { start: Math.round(start * 100) / 100, end: Math.round(Math.min(end, D) * 100) / 100 };
  })();
  const draftText = editing ? (editing.preview ?? editing.text) : null;
  const withText = withLayout && editing && draftText !== null ? setText(withLayout.overlays, editing.target, draftText) : null;
  const withTime = withText && editing && draftWindow ? setWindow(withText, editing.target, draftWindow.start, draftWindow.end) : withText;
  const baseOverlays = withTime ?? withLayout?.overlays ?? null;
  // The size being dragged, live on the preview.
  const draftSlot = editing ? sizeSlotOf(editing.target) : null;
  const sizedOverlays =
    baseOverlays && editing && draftSlot && editing.size !== (baseOverlays.sizes?.[draftSlot] ?? 1)
      ? { ...baseOverlays, sizes: { ...baseOverlays.sizes, [draftSlot]: editing.size } }
      : baseOverlays;
  const lookOverlays = sizedOverlays && captionDraft ? withLook(sizedOverlays, captionDraft) : sizedOverlays;
  const previewProps = withLayout && lookOverlays ? { ...withLayout, overlays: lookOverlays } : withLayout;
  const lookChanged = captionDraft !== null && JSON.stringify(plainLook(captionDraft)) !== JSON.stringify(plainLook(savedLook ?? {}));

  function openLook() {
    setMoving(null);
    setEditing(null);
    setView("preview");
    setShowWords(false);
    setCaptionDraft({ ...(savedLook ?? {}) });
    const first = latest?.props?.words[0];
    if (first) still(first.start + 0.2);
  }
  async function saveLook() {
    if (!captionDraft) return;
    const clean = plainLook(captionDraft);
    setBusy({ label: "Saving the caption look…" });
    const r = await send(api(`${p.id}/edit/captions`), "POST", { style: Object.keys(clean).length ? clean : null });
    setBusy(null);
    if (r.ok) {
      setCaptionDraft(null);
      onChange(r.data);
    } else onError(r.error);
  }
  async function saveLine() {
    if (!lineEdit) return;
    setBusy({ label: "Saving the caption…" });
    const r = await send(api(`${p.id}/edit/captions`), "POST", { words: lineEdit });
    setBusy(null);
    if (r.ok) {
      setLineEdit(null);
      onChange(r.data);
    } else onError(r.error);
  }
  const savedWindow = editing && latest?.props ? windowOf(latest.props.overlays, editing.target) : null;
  const timingChanged = Boolean(
    draftWindow && savedWindow && (Math.abs(draftWindow.start - savedWindow.start) > 0.01 || Math.abs(draftWindow.end - savedWindow.end) > 0.01)
  );
  const clashes = editing && draftWindow && latest?.props ? slotClashes(latest.props.overlays, editing.target, draftWindow.start, draftWindow.end) : [];
  const spot = moving ? moving.layout[moving.slot] : undefined;
  // Vertical Feed-safe band (rulebook): 285–1248 of 1920.
  const BAND_TOP = 285 / 1920;
  const BAND_BOTTOM = 1248 / 1920;
  const outsideBand = Boolean(vertical && spot && (spot.y < BAND_TOP || spot.y > BAND_BOTTOM));

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
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">{s.slots}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className={`rounded-2xl border p-3 ${latest?.style === "custom" ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-bold text-white">Describe it yourself</p>
                <Chip>Your way</Chip>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                Type how you want it edited and Remotion builds exactly that: captions or none, a title, zooms on certain words, cards, a CTA at the end. You can also just type it in the chat box below.
              </p>
              <textarea
                value={describe}
                onChange={(e) => setDescribe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && describe.trim()) void start("custom", describe.trim());
                }}
                rows={3}
                placeholder="e.g. Captions on. Big title “Stop doing returns” for the first 3 seconds. Zoom in when she says $15,000. CTA “Book a call” at the end."
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <span className="text-[10px] text-neutral-500 [@media(hover:none)]:hidden">⌘ Enter</span>
                <button
                  type="button"
                  onClick={() => void start("custom", describe.trim())}
                  disabled={!describe.trim() || Boolean(busy) || rendering || !chosenCut}
                  className={`${CTA_CLASSES} disabled:opacity-50`}
                >
                  Edit it this way
                </button>
              </div>
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
            {onOldCut && !rendering && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-3.5 py-3">
                <p className="min-w-0 flex-1 text-sm text-amber-50">
                  <b className="text-white">Your clips changed.</b> This edit is on the old cut. Put it on the new one, with the same style, placements and caption look?
                </p>
                <button type="button" onClick={() => void moveToNewCut()} disabled={Boolean(busy)} className="min-h-10 rounded-full bg-amber-500 px-4 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50">
                  Put this edit on the new cut
                </button>
              </div>
            )}
            <div
              className={
                vertical ? `grid gap-4 ${moving ? "sm:grid-cols-[minmax(0,340px)_1fr]" : "sm:grid-cols-[minmax(0,260px)_1fr]"}` : "space-y-4"
              }
            >
              <div className="space-y-2">
                <div
                  className={`relative overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-cyan-500/10 ${moving ? "border-cyan-400/60" : "border-white/15"} ${
                    vertical ? `mx-auto w-full ${moving ? "max-w-[340px]" : "max-w-[280px]"}` : "w-full"
                  }`}
                  style={{ aspectRatio: aspect }}
                >
                  {showRender && latestOutput && !moving ? (
                    <video key={latestOutput} src={latestOutput} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                  ) : previewProps ? (
                    <EditPreview props={previewProps} seek={seek} interactive={!moving} onPlayer={onPlayer} />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-neutral-500">The preview appears once the layout is ready.</div>
                  )}
                  {moving && (
                    <div
                      className="absolute inset-0 z-10 cursor-crosshair touch-none select-none"
                      onPointerDown={(e) => {
                        dragging.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        place(e);
                      }}
                      onPointerMove={(e) => {
                        if (dragging.current) place(e);
                      }}
                      onPointerUp={() => {
                        dragging.current = false;
                      }}
                      onPointerCancel={() => {
                        dragging.current = false;
                      }}
                    >
                      {vertical && (
                        <>
                          <div className="absolute inset-x-0 top-0 bg-black/30" style={{ height: `${BAND_TOP * 100}%` }} />
                          <div className="absolute inset-x-0 bottom-0 bg-black/30" style={{ height: `${(1 - BAND_BOTTOM) * 100}%` }} />
                          <div className="absolute inset-x-0 border-t border-dashed border-amber-300/80" style={{ top: `${BAND_TOP * 100}%` }}>
                            <span className="absolute left-1.5 top-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200/90">Feed crop above</span>
                          </div>
                          <div className="absolute inset-x-0 border-t border-dashed border-amber-300/80" style={{ top: `${BAND_BOTTOM * 100}%` }}>
                            <span className="absolute left-1.5 top-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200/90">Reels buttons below</span>
                          </div>
                        </>
                      )}
                      {spot?.x === 0.5 && <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-cyan-300/60" />}
                      {movable
                        .filter((m) => moving.layout[m.slot])
                        .map((m) => {
                          const at = moving.layout[m.slot]!;
                          const active = m.slot === moving.slot;
                          return (
                            <div
                              key={m.slot}
                              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                              style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
                            >
                              <span className={`h-3 w-3 rounded-full border-2 ${active ? "border-white bg-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.35)]" : "border-white/70 bg-white/30"}`} />
                              <span className={`mt-1 rounded px-1 text-[9px] font-bold ${active ? "bg-cyan-500 text-white" : "bg-black/60 text-white/80"}`}>{m.label}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                {latestOutput && !moving && (
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

              {moving && (
                // Phones: the picker and Done sit above the preview, so they're in reach while you drag.
                <div className="space-y-3 max-sm:order-first">
                  <p className="text-sm text-neutral-200">
                    Pick what to move, then <b className="text-white">tap or drag</b> on the video where it should sit.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {movable.map((m) => (
                      <button
                        key={m.slot}
                        type="button"
                        onClick={() => pick(m.slot)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          m.slot === moving.slot ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"
                        }`}
                      >
                        {m.label}
                        {moving.layout[m.slot] ? <span className="ml-1 text-cyan-300">•</span> : null}
                      </button>
                    ))}
                  </div>
                  {moving.slot === "pip" && moving.pip && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-400">Size</span>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-bold">
                          {(["s", "m", "l"] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              aria-pressed={moving.pip?.size === sz}
                              onClick={() => setMoving((m) => (m?.pip ? { ...m, pip: { ...m.pip, size: sz } } : m))}
                              className={`min-h-9 min-w-9 rounded-full px-3 ${moving.pip?.size === sz ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
                            >
                              {sz.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-300">
                        <input
                          type="checkbox"
                          checked={moving.pip.captions}
                          onChange={(e) => setMoving((m) => (m?.pip ? { ...m, pip: { ...m.pip, captions: e.target.checked } } : m))}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        Caption its words while it plays
                      </label>
                    </div>
                  )}
                  {outsideBand && (
                    <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      That spot is outside the Feed-safe band: the 4:5 Feed crop or the Reels caption and buttons will cover it. It&apos;ll still go where you put it.
                    </p>
                  )}
                  <p className="text-[11px] leading-relaxed text-neutral-400">
                    {vertical ? "Stay between the dashed lines so nothing gets cropped in the Feed or covered by Reels buttons. " : ""}
                    It snaps to the centre line. Anything you don&apos;t move keeps its rulebook spot.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void saveLayout()} disabled={Boolean(busy)} className={`${CTA_CLASSES} disabled:opacity-50`}>
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoving(null)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      Cancel
                    </button>
                    {spot && (
                      <button type="button" onClick={resetSlot} className="px-2 text-xs font-semibold text-neutral-500 hover:text-white">
                        Put the {movable.find((m) => m.slot === moving.slot)?.label.toLowerCase()} back
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className={moving ? "hidden" : "space-y-3"}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Style", value: STYLE_LABEL[latest.style] },
                    { label: "Length", value: clock(latest.durationS) },
                    { label: "Graphics", value: String(elements.length) },
                    {
                      label: "Caption words",
                      value: latest.style === "pov" || latest.props?.overlays.captions === false ? "Off" : String(latest.props?.words.length ?? "—"),
                    },
                  ].map((t) => (
                    <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{t.label}</p>
                      <p className="truncate text-lg font-extrabold text-white" style={NUM_FONT}>
                        {t.value}
                      </p>
                    </div>
                  ))}
                </div>

                {latest.notes && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-300">{latest.notes}</p>
                )}

                {rendering && latest.waiting && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">In line for AWS…</p>
                      <p className="text-xs text-neutral-400">
                        {latest.renderCrashes > 0
                          ? "A Lambda machine ran out of memory, so it's trying once more with lighter settings in a moment — keep this page or the batch open."
                          : latest.renderAttempts > 0
                            ? "AWS was busy, so it'll try again with fewer machines in a moment."
                            : "Another video is rendering. This one starts by itself as soon as there's room — keep this page or the batch open."}
                      </p>
                    </div>
                    <button type="button" onClick={leaveLine} disabled={Boolean(busy)} className="min-h-9 self-start text-xs font-semibold text-neutral-400 hover:text-white sm:self-center">
                      Take out of line
                    </button>
                  </div>
                )}

                {rendering && !latest.waiting && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3 text-center sm:flex-row sm:gap-4 sm:text-left">
                    <div className="sm:-my-6 sm:-mr-10 sm:origin-left sm:scale-[0.62] max-sm:scale-75">
                      <ProgressRing percent={latest.progress} />
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-white">{latest.renderCrashes > 0 ? "Rendering again, with lighter settings…" : "Rendering on Remotion Lambda…"}</p>
                      <p className="text-xs text-neutral-400">Split across several machines. An ad takes a minute or two; a VSL a few more. You can leave this page.</p>
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

                {latest.status !== "done" && <AwsLimitNote />}

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
                    <SaveVideoLink url={latestOutput} filename={videoFileName(p.title, latest.style, `v${latest.version}`)} className={CTA_CLASSES}>
                      <SvgIcon d={SP.download} size={15} /> Download
                    </SaveVideoLink>
                  )}
                  {!rendering && movable.length > 0 && props && (
                    <button
                      type="button"
                      onClick={startMoving}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 hover:text-white"
                    >
                      ✥ Move things
                    </button>
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
                  <p className="text-xs text-neutral-400">
                    Last render: v{lastDone.version} · {STYLE_LABEL[lastDone.style]} ·{" "}
                    <SaveVideoLink
                      url={lastDone.outputUrl}
                      filename={videoFileName(p.title, lastDone.style, `v${lastDone.version}`)}
                      className="inline-flex min-h-8 items-center font-semibold text-neutral-300 hover:text-white"
                    >
                      Download
                    </SaveVideoLink>
                  </p>
                )}
                {latest.status === "draft" && (
                  <p className="text-xs text-neutral-400">
                    Watch it. To put the title, captions{latest.props?.pip ? ", the corner video" : " or qualifier"} somewhere else, use <span className="text-neutral-200">✥ Move things</span> and tap
                    where they should sit. For anything else, tell me in the box below, e.g. <span className="text-neutral-200">“shorter title”</span> or{" "}
                    <span className="text-neutral-200">“qualifier at 0:03”</span>.
                  </p>
                )}
              </div>
            </div>

            {elements.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  On screen <span className="normal-case tracking-normal text-neutral-600">· ✎ to change the words or when it shows</span>
                </p>
                {elements.map((el, i) => {
                  const open = Boolean(editing && el.target && sameTarget(editing.target, el.target));
                  return (
                    <div key={i} className={`rounded-lg border ${open ? "border-cyan-400/40 bg-cyan-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => jump(el.start)}
                          disabled={showRender || Boolean(moving)}
                          className="grid min-w-0 flex-1 grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-left hover:bg-white/[0.03] sm:flex sm:gap-3 sm:py-1.5"
                        >
                          <span className="shrink-0 text-[10px] font-bold text-cyan-300 sm:w-[86px]" style={NUM_FONT}>
                            {clock(el.start)}–{clock(el.end)}
                          </span>
                          <span className="shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-neutral-500 sm:w-[92px]">{el.label}</span>
                          <span className="col-span-2 min-w-0 flex-1 break-words text-[13px] text-neutral-200 sm:col-span-1">{el.text}</span>
                        </button>
                        {el.target && !rendering && (
                          <button
                            type="button"
                            onClick={() => (open ? setEditing(null) : openEditor(el.target!, el.text, el.start, el.end))}
                            className={`mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm sm:mr-1.5 sm:h-7 sm:w-7 sm:rounded-md ${open ? "bg-cyan-500/20 text-white" : "text-neutral-500 hover:bg-white/10 hover:text-white"}`}
                            aria-label={`Change the ${el.label.toLowerCase()} text`}
                            title="Change the words or when it shows"
                          >
                            ✎
                          </button>
                        )}
                      </div>

                      {open && editing && (
                        <div className="space-y-2.5 border-t border-white/5 p-3">
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editing.text}
                              maxLength={textLimit(editing.target)}
                              onChange={(e) => setEditing({ ...editing, text: e.target.value, preview: null })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void getVersions();
                                }
                                if (e.key === "Escape") setEditing(null);
                              }}
                              placeholder="Type what it should say…"
                              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none"
                            />
                            <span className="shrink-0 text-[10px] text-neutral-500" style={NUM_FONT}>
                              {editing.text.length}/{textLimit(editing.target)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void applyText(editing.text)}
                              disabled={(!editing.text.trim() && !(editing.target.slot === "card" && editing.target.field === "sub")) || Boolean(busy)}
                              className="min-h-9 rounded-full bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                            >
                              Use mine
                            </button>
                            <button
                              type="button"
                              onClick={() => void getVersions()}
                              disabled={!editing.text.trim() || editing.loading}
                              className="min-h-9 rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1.5 text-xs font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
                            >
                              ✨ {editing.options ? "New AI versions" : "AI versions of mine"}
                            </button>
                            <button type="button" onClick={() => setEditing(null)} className="px-1 text-xs font-semibold text-neutral-500 hover:text-white">
                              Cancel
                            </button>
                            <span className="text-[10px] text-neutral-600 [@media(hover:none)]:hidden">Enter = AI versions</span>
                          </div>

                          {editing.loading && (
                            <p className="flex items-center gap-2 text-xs text-violet-200">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-300" />
                              Claude is writing versions of yours…
                            </p>
                          )}

                          {editing.options && (
                            <div className="space-y-1.5">
                              {[{ text: editing.text, mine: true }, ...editing.options.map((o) => ({ text: o, mine: false }))].map((opt, k) => {
                                const previewing = (editing.preview ?? editing.text) === opt.text;
                                return (
                                  <div
                                    key={k}
                                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${previewing ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}
                                  >
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${opt.mine ? "bg-white/10 text-neutral-300" : "bg-violet-500/20 text-violet-200"}`}>
                                      {opt.mine ? "Yours" : "✨ AI"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditing({ ...editing, preview: opt.mine ? null : opt.text })}
                                      className="min-w-0 flex-1 text-left text-[13px] text-white"
                                      title="Show it in the preview"
                                    >
                                      {opt.text || <span className="text-neutral-500">(empty)</span>}
                                      {opt.mine && editing.aboutYours && <span className="mt-0.5 block text-[11px] text-amber-200/90">{editing.aboutYours}</span>}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void applyText(opt.text)}
                                      disabled={Boolean(busy)}
                                      className="min-h-8 shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white hover:bg-cyan-600 disabled:opacity-40"
                                    >
                                      Use
                                    </button>
                                  </div>
                                );
                              })}
                              <p className="text-[10px] text-neutral-400">Tap a version to see it on the video, then Use the one you want.</p>
                            </div>
                          )}

                          {/* Size, like Instagram's text size: the whole box scales */}
                          {sizeSlotOf(editing.target) && (() => {
                            const slot = sizeSlotOf(editing.target)!;
                            const saved = latest.props?.overlays.sizes?.[slot] ?? 1;
                            const pct = Math.round(editing.size * 100);
                            return (
                              <div className="space-y-2 border-t border-white/5 pt-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                                    Size{slot === "stickers" ? " · every sticker" : slot === "cards" ? " · every card" : ""}
                                  </span>
                                  <span className="text-xs font-bold text-white" style={NUM_FONT}>
                                    {pct}%
                                  </span>
                                  {editing.size !== 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setEditing((e) => (e ? { ...e, size: 1 } : e))}
                                      className="min-h-8 px-1 text-[11px] font-semibold text-neutral-500 hover:text-white"
                                    >
                                      Back to 100%
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-black text-neutral-400" aria-hidden="true">A</span>
                                  <input
                                    type="range"
                                    min={SIZE_MIN}
                                    max={SIZE_MAX}
                                    step={0.05}
                                    value={editing.size}
                                    onChange={(e) => setEditing((x) => (x ? { ...x, size: Number(e.target.value) } : x))}
                                    className="h-9 min-w-0 flex-1 accent-cyan-500"
                                    aria-label="Text size"
                                    aria-valuetext={`${pct}%`}
                                  />
                                  <span className="text-lg font-black text-neutral-300" aria-hidden="true">A</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void saveSize()}
                                  disabled={Math.abs(editing.size - saved) < 0.005 || Boolean(busy)}
                                  className="min-h-9 rounded-full bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                                >
                                  Save size
                                </button>
                              </div>
                            );
                          })()}

                          {/* When it shows */}
                          <div className="space-y-2 border-t border-white/5 pt-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">When it shows</span>
                              <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold">
                                {(["whole", "custom"] as const).map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => setTiming({ mode: m })}
                                    className={`min-h-8 rounded-full px-3 py-1 ${editing.timing.mode === m ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
                                  >
                                    {m === "whole" ? "Whole video" : "Custom"}
                                  </button>
                                ))}
                              </div>
                              {draftWindow && (
                                <span className="text-[10px] text-neutral-500" style={NUM_FONT}>
                                  {clock(draftWindow.start)}–{clock(draftWindow.end)} · {(draftWindow.end - draftWindow.start).toFixed(1)}s
                                </span>
                              )}
                            </div>
                            {editing.timing.mode === "custom" && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-neutral-400">
                                {(["start", "end"] as const).map((k) => (
                                  <label key={k} className="flex items-center gap-1.5">
                                    {k === "start" ? "From" : "To"}
                                    <input
                                      value={editing.timing[k]}
                                      onChange={(e) => setTiming({ [k]: e.target.value })}
                                      className="w-[76px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-center text-xs text-white focus:border-cyan-400/50 focus:outline-none"
                                      style={NUM_FONT}
                                      aria-label={k === "start" ? "Starts at" : "Ends at"}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setTiming({ [k]: clock(Math.min(D, Math.max(0, playhead.current()))) })}
                                      className="min-h-9 rounded-md border border-white/10 px-2 text-[11px] font-bold text-neutral-300 hover:bg-white/10 hover:text-white"
                                      title="Use where the video is paused"
                                    >
                                      ⟵ now
                                    </button>
                                  </label>
                                ))}
                                <span className="text-[10px] text-neutral-600">Pause the video where it should start or end, then ⟵ now.</span>
                              </div>
                            )}
                            {editing.timing.mode === "custom" && !draftWindow && (
                              <p className="text-[11px] text-rose-300">Use times like 0:02.5 or 2.5, with the end at least half a second after the start (the video is {clock(D)}).</p>
                            )}
                            {clashes.length > 0 && (
                              <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100">
                                {clashes.map((c) => `${c.label} (${clock(c.start)}–${clock(c.end)})`).join(", ")} {clashes.length > 1 ? "show" : "shows"} in the same spot
                                then, so they&apos;ll stack. Move one with ✥ Move things or shorten this. It&apos;ll still save what you chose.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => void saveTiming()}
                              disabled={!draftWindow || !timingChanged || Boolean(busy)}
                              className="min-h-9 rounded-full bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                            >
                              Save timing
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {chunks.length > 0 && latest.style !== "pov" && latest.props?.overlays.captions !== false && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                    Captions{" "}
                    <span className="normal-case tracking-normal text-neutral-600">
                      · {chunks.length} lines{savedLook ? " · your look" : " · Nexli look"}
                    </span>
                  </p>
                  {!rendering && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => (captionDraft ? setCaptionDraft(null) : openLook())}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold ${captionDraft ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"}`}
                      >
                        🎨 Change the look
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWords((v) => !v);
                          setLineEdit(null);
                        }}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold ${showWords ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"}`}
                      >
                        ✎ Edit the words
                      </button>
                    </div>
                  )}
                </div>

                {captionDraft && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {LOOK_PRESETS.map((pr) => {
                        const on = JSON.stringify(plainLook(captionDraft)) === JSON.stringify(plainLook(pr.look));
                        return (
                          <button
                            key={pr.label}
                            type="button"
                            onClick={() => setCaptionDraft({ ...pr.look })}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${on ? "border-cyan-400 bg-cyan-500/15 text-white" : "border-white/10 bg-white/[0.04] text-neutral-300 hover:text-white"}`}
                          >
                            {pr.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {LOOK_OPTIONS.map((opt) => {
                        const current = captionDraft[opt.key] ?? LOOK_DEFAULT[opt.key];
                        return (
                          <div key={opt.key} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <span className="text-[11px] text-neutral-400">{opt.label}</span>
                            <div className="flex flex-wrap rounded-2xl border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold sm:rounded-full">
                              {opt.values.map((val) => (
                                <button
                                  key={String(val.v)}
                                  type="button"
                                  onClick={() => setCaptionDraft({ ...captionDraft, [opt.key]: val.v })}
                                  className={`min-h-8 rounded-full px-3 py-0.5 sm:min-h-0 sm:px-2.5 ${current === val.v ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
                                >
                                  {val.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-neutral-400">The preview shows it as you click. Nexli is the rulebook look (3 words, ALL CAPS, brand gradient).</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveLook()}
                        disabled={!lookChanged || Boolean(busy)}
                        className="min-h-9 rounded-full bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                      >
                        Save look
                      </button>
                      <button type="button" onClick={() => setCaptionDraft(null)} className="px-1 text-xs font-semibold text-neutral-500 hover:text-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {showWords && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {chunks.map((c, i) => {
                        const open = lineEdit?.from === c.from;
                        return (
                          <button
                            key={`${c.from}-${i}`}
                            type="button"
                            onClick={() => {
                              setView("preview");
                              still(c.start + 0.1);
                              setLineEdit(open ? null : { from: c.from, to: c.to, text: c.text });
                            }}
                            className={`rounded-md px-2 py-1 text-left text-[11px] font-bold ${open ? "bg-cyan-500/25 text-white ring-1 ring-cyan-400" : "bg-white/[0.04] text-neutral-200 hover:bg-cyan-500/15 hover:text-white"}`}
                            style={NUM_FONT}
                          >
                            <span className="mr-1 text-neutral-500">{clock(c.start)}</span>
                            {c.text}
                          </button>
                        );
                      })}
                    </div>
                    {lineEdit && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/[0.05] p-2">
                        <input
                          autoFocus
                          value={lineEdit.text}
                          onChange={(e) => setLineEdit({ ...lineEdit, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveLine();
                            }
                            if (e.key === "Escape") setLineEdit(null);
                          }}
                          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm uppercase text-white focus:border-cyan-400/50 focus:outline-none"
                          aria-label="Caption words"
                        />
                        <button
                          type="button"
                          onClick={() => void saveLine()}
                          disabled={Boolean(busy)}
                          className="rounded-full bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setLineEdit(null)} className="px-1 text-xs font-semibold text-neutral-500 hover:text-white">
                          Cancel
                        </button>
                        <p className="w-full text-[10px] text-neutral-400">
                          The new words keep this line&apos;s timing. Leave it empty to take these words out of the captions (the audio stays).
                        </p>
                      </div>
                    )}
                    {!lineEdit && <p className="text-[10px] text-neutral-400">Click a line to jump there and retype it.</p>}
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
