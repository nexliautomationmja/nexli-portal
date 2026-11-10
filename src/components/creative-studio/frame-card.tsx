"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { MAX_SCENES } from "@/lib/creative-studio/prompts";
import { CTA_CLASSES, labelCls } from "@/components/launch-pad";
import { inStudioQs, api, send } from "@/components/creative-studio/client";
import { prepareFrame, uploadFrameFile, uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { ManusActivity } from "@/components/creative-studio/manus-activity";
import { PresenterPicker, defaultPresenterName } from "@/components/creative-studio/presenter-picker";
import { useIsTouch } from "@/lib/use-media";
import { reactionShot } from "@/lib/creative-studio/reaction-shared";

interface Reference {
  id: string;
  url: string | null;
}

type Scene = ProjectDetail["scenes"][number];

/** Where a picked image goes: the one opening frame (classic), a scene's frame, or a new scene. */
type Target = { kind: "classic" } | { kind: "scene"; id: string; number: number } | { kind: "new" };

const sceneParam = (t: Target) => (t.kind === "scene" ? t.id : t.kind === "new" ? "new" : undefined);

/**
 * The frame — or, for a story, the scenes in order. Paste an image into the
 * chat box to use it as the frame (several at once become scenes). Or pick
 * one of your references, or have Manus create two options (using the
 * ticked references as the baseline) and choose where it goes.
 */
export function FrameCard({
  detail,
  onChange,
  onError,
  onFrameChosen,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
  onFrameChosen: () => void;
}) {
  const p = detail.project;
  const frame = detail.frames[0];
  const scenes = detail.scenes;
  // References belong to this video's studio and presenter (Daniela's in Nexli's by default; a client firm's own; a saved presenter's).
  const presenter = p.presenter;
  const qs = `${inStudioQs(p.studio.key)}${presenter?.id ? `&presenter=${encodeURIComponent(presenter.id)}` : ""}`;
  const client = p.studio.kind === "client";
  const who = presenter?.name || defaultPresenterName(p.studio);
  // Approved or rendering: the presenter is part of what Kling renders.
  const locked = !["draft", "scripted"].includes(p.status);
  const touch = useIsTouch();
  const [storyOpen, setStoryOpen] = useState(false);
  const story = scenes.length > 1 || storyOpen;
  const [target, setTarget] = useState<Target | null>(frame ? null : { kind: "classic" });
  const [refs, setRefs] = useState<Reference[] | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  // A reaction video starts with the shot it needs: the presenter holding the phone, the top right left clear.
  const [shot, setShot] = useState(() =>
    detail.reaction && !frame ? reactionShot(presenter?.name || (client ? "The presenter" : "Daniela"), presenter?.pronoun ?? "she", p.format !== "vsl_16x9") : ""
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [zoneActive, setZoneActive] = useState(false);
  const [tileZone, setTileZone] = useState<Target | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Target>({ kind: "classic" });
  const polling = useRef(false);

  const active = detail.manus.filter((t) => t.status === "running" || (t.status === "waiting" && t.waiting));
  const newest = detail.manus[detail.manus.length - 1];
  const lastFailed = newest?.status === "failed" && newest.error !== "Cancelled" ? newest : undefined;
  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";
  const vertical = p.format === "ad_9x16";
  // Planned scenes (no frame yet) count toward the limit too.
  const full = scenes.length >= MAX_SCENES;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/creative-studio/references${qs}`)
      .then((r) => r.json())
      .then((b) => !cancelled && setRefs(b?.references ?? []))
      .catch(() => !cancelled && setRefs([]));
    return () => {
      cancelled = true;
    };
  }, [qs]);

  // Watch Manus live: check every 6 s while a task runs or waits.
  useEffect(() => {
    if (active.length === 0) return;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      const r = await send(api(`${p.id}/frame/poll`), "POST");
      polling.current = false;
      if (r.ok) onChange(r.data);
    };
    const first = setTimeout(tick, 2_000);
    const t = setInterval(tick, 6_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active.length, p.id, onChange]);

  const addReferences = useCallback(
    async (list: File[]) => {
      const images = list.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
      if (images.length === 0) return;
      setBusy(images.length > 1 ? `Saving ${images.length} references…` : "Saving reference…");
      for (const file of images) {
        try {
          const prepared = await prepareFrame(file, false);
          const sign = await fetch(`/api/dashboard/creative-studio/references${qs}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sign", mime: prepared.mime }),
          });
          const target = await sign.json().catch(() => null);
          if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
          await uploadToTarget(target, prepared.blob, prepared.mime);
          const reg = await fetch(`/api/dashboard/creative-studio/references${qs}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "register", path: target.path, mime: prepared.mime, width: prepared.width, height: prepared.height }),
          });
          const b = await reg.json().catch(() => null);
          if (!reg.ok) throw new Error(b?.error || "Couldn't save the reference");
          setRefs(b.references);
        } catch (err) {
          onError(err instanceof Error ? err.message : "Upload failed");
        }
      }
      setBusy(null);
    },
    [onError, qs]
  );

  /** Upload image files to a target (several files → several new scenes). */
  const uploadFiles = useCallback(
    async (list: File[], to: Target) => {
      const images = list.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
      if (images.length === 0) return;
      const room = MAX_SCENES - scenes.length;
      const files = to.kind === "new" ? images.slice(0, Math.max(0, room)) : images.slice(0, 1);
      if (files.length === 0) {
        onError(`A video can have up to ${MAX_SCENES} scenes.`);
        return;
      }
      try {
        for (let i = 0; i < files.length; i++) {
          setBusy(
            to.kind === "scene"
              ? `Swapping scene ${to.number}'s frame…`
              : to.kind === "new"
                ? files.length > 1
                  ? `Adding scene ${i + 1} of ${files.length}…`
                  : "Adding the scene…"
                : "Setting the frame…"
          );
          onChange(await uploadFrameFile(p.id, files[i], vertical, sceneParam(to)));
        }
        setTarget(null);
        if (to.kind === "classic") onFrameChosen();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(null);
      }
    },
    [onChange, onError, onFrameChosen, p.id, scenes, vertical]
  );

  const addRef = useRef(addReferences);
  const uploadRef = useRef(uploadFiles);
  useEffect(() => {
    addRef.current = addReferences;
    uploadRef.current = uploadFiles;
  });

  // While the pointer/focus is on the references strip, pastes save references.
  useEffect(() => {
    if (!zoneActive) return;
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void addRef.current(images);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [zoneActive]);

  // While the pointer/focus is on a scene tile, a paste swaps that scene's frame (or adds a scene on "+").
  useEffect(() => {
    if (!tileZone) return;
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void uploadRef.current(images, tileZone);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [tileZone]);

  async function choosePresenter(id: string | null) {
    setBusy("Changing the presenter…");
    const r = await send(api(p.id), "PATCH", { presenterId: id });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  /** Keep a frame (e.g. a scene Manus made) as a photo of this video's presenter. */
  async function saveToPhotos(frameId: string) {
    setBusy(`Saving to ${who}'s photos…`);
    const r = await fetch(`/api/dashboard/creative-studio/references${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fromFrame", assetId: frameId }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setBusy(null);
    if (r?.ok && b?.references) {
      setRefs(b.references);
      setSaved(frameId);
    } else onError(b?.error || "Couldn't save the photo");
  }

  async function removeReference(id: string) {
    if (!confirm(presenter || client ? "Remove this reference picture?" : "Remove this image from your Daniela references?")) return;
    const r = await fetch(`/api/dashboard/creative-studio/references${qs}&assetId=${encodeURIComponent(id)}`, { method: "DELETE" });
    const b = await r.json().catch(() => null);
    if (r.ok && b?.references) setRefs(b.references);
  }

  async function pick(assetId: string) {
    const to = target ?? { kind: "classic" };
    setBusy(to.kind === "scene" ? `Swapping scene ${to.number}'s frame…` : to.kind === "new" ? "Adding the scene…" : "Setting the frame…");
    const r = await send(api(`${p.id}/frame/pick`), "POST", { assetId, ...(sceneParam(to) ? { scene: sceneParam(to) } : {}) });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setTarget(null);
      if (to.kind === "classic") onFrameChosen();
    } else onError(r.error);
  }

  async function generate(shotText: string = shot) {
    setBusy("Starting Manus…");
    const referenceIds = (refs ?? []).filter((r) => !unticked.has(r.id)).map((r) => r.id);
    const scene = target?.kind === "scene" ? scenes.find((sc) => sc.id === target.id) : undefined;
    // A scene's own shot line follows what you asked Manus for.
    if (scene && shotText.trim() !== scene.shot) {
      await send(api(`${p.id}/frames`), "PATCH", {
        scenes: scenes.map((sc) => ({ id: sc.id, label: sc.label, shot: sc.id === scene.id ? shotText.trim() : sc.shot })),
      });
    }
    const r = await send(api(`${p.id}/frame/generate`), "POST", { shot: shotText, referenceIds, ...(scene ? { scene: scene.id } : {}) });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setShot(scene ? shotText : "");
    } else onError(r.error);
  }

  /** Claude splits the story into scenes (or re-plans the ones still waiting for a frame). */
  async function plan(note = "") {
    setBusy("Claude is planning the scenes… (about half a minute)");
    const r = await send(api(`${p.id}/scenes/plan`), "POST", note ? { note } : {});
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setStoryOpen(true);
      setTarget(null);
    } else onError(r.error);
  }

  /** Manus makes every scene still waiting for a frame, in one go. */
  async function makeScenes() {
    const n = scenes.filter((sc) => !sc.frameId).length;
    if (!confirm(`Have Manus make ${n} scene${n === 1 ? "" : "s"} in one go? It uses ${who}'s ${refs && refs.length ? "photos" : "look"} and takes a few minutes.`)) return;
    setBusy("Starting Manus…");
    const referenceIds = (refs ?? []).filter((r) => !unticked.has(r.id)).map((r) => r.id);
    const r = await send(api(`${p.id}/frame/generate`), "POST", { storyboard: true, referenceIds });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  /** A Manus option made for one scene goes to that scene; any other follows the picker. */
  async function pickOption(o: { id: string; sceneId: string | null }) {
    const scene = o.sceneId ? scenes.find((sc) => sc.id === o.sceneId) : undefined;
    if (!scene) return pick(o.id);
    setBusy(`Using it for scene ${scene.number}…`);
    const r = await send(api(`${p.id}/frame/pick`), "POST", { assetId: o.id, scene: scene.id });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setTarget(null);
    } else onError(r.error);
  }

  async function saveOrder(next: Scene[]) {
    setBusy("Saving the order…");
    const r = await send(api(`${p.id}/frames`), "PATCH", { scenes: next.map((s) => ({ id: s.id, label: s.label })) });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  function move(at: number, by: -1 | 1) {
    const to = at + by;
    if (to < 0 || to >= scenes.length) return;
    const next = [...scenes];
    [next[at], next[to]] = [next[to], next[at]];
    void saveOrder(next);
  }

  async function rename(scene: Scene, label: string) {
    const clean = label.trim().slice(0, 80);
    if (clean === scene.label) return;
    await saveOrder(scenes.map((s) => (s.id === scene.id ? { ...s, label: clean } : s)));
  }

  async function removeScene(scene: Scene) {
    const using = detail.clips.filter((c) => c.frameId && c.frameId === scene.frameId).length;
    const moveTo = Math.max(1, scene.number - 1);
    const msg = using
      ? `Remove scene ${scene.number}? Its ${using} clip${using === 1 ? "" : "s"} move to scene ${moveTo === scene.number ? scene.number + 1 : moveTo}.`
      : `Remove scene ${scene.number}?`;
    if (!confirm(msg)) return;
    setBusy("Removing the scene…");
    const r = await send(`${api(`${p.id}/frames`)}?sceneId=${encodeURIComponent(scene.id)}`, "DELETE");
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setTarget(null);
    } else onError(r.error);
  }

  function openScene(to: Target | null) {
    setTarget(to);
    if (to?.kind === "scene") setShot(scenes.find((sc) => sc.id === to.id)?.shot ?? "");
  }

  function openUpload(to: Target) {
    uploadTarget.current = to;
    fileInput.current?.click();
  }

  const stale = new Set((p.frameSpec?.scenes ?? []).filter((s) => s.stale).map((s) => s.frameId));
  const making = new Set(active.flatMap((t) => t.scenes ?? []));
  const waitingScenes = scenes.filter((sc) => !sc.frameId);
  const boardRunning = active.some((t) => (t.scenes?.length ?? 0) > 1);
  const hasDirection = Boolean(p.direction.trim());
  const clipsIn = (frameId: string | null) => (frameId ? detail.clips.filter((c) => c.frameId === frameId).length : 0);
  const pickLabel =
    target?.kind === "scene" ? `Use for scene ${target.number}` : target?.kind === "new" ? "Add as a scene" : "Use as frame";

  // ── The picker: paste / upload, references, Manus — for the current target ──
  const picker = target && (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-300">
          {target.kind === "scene" ? (
            <>
              <b className="text-white">{scenes.find((sc) => sc.id === target.id)?.frameId ? `New frame for scene ${target.number}.` : `Make scene ${target.number}.`}</b> Upload one, use a reference, or let Manus make it from the shot below.
            </>
          ) : target.kind === "new" ? (
            <>
              <b className="text-white">Add a scene.</b> Upload frames (several at once is fine), use a reference, or let Manus make one.
            </>
          ) : (
            <>
              <b className="text-white">Paste the frame into the box below</b> and it&apos;s used as-is. Several images at once become the scenes of a story. Or use one of your references, or let Manus make one.
            </>
          )}
        </p>
        {target.kind === "scene" && (() => {
          const frameId = scenes.find((sc) => sc.id === target.id)?.frameId;
          return frameId ? (
            <button
              type="button"
              onClick={() => void saveToPhotos(frameId)}
              disabled={!!busy || saved === frameId}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-neutral-300 hover:border-cyan-400/50 hover:text-white disabled:opacity-60"
            >
              {saved === frameId ? `✓ Saved to ${who}'s photos` : `Save scene ${target.number} to ${who}'s photos`}
            </button>
          ) : null;
        })()}
        {target.kind !== "classic" && (
          <button
            type="button"
            onClick={() => openUpload(target)}
            disabled={!!busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-white hover:border-blue-400/50"
          >
            <SvgIcon d={SP.upload} size={14} /> Upload
          </button>
        )}
      </div>

      {/* References (paste zone): Daniela's in Nexli's studio, the studio's own in a client's */}
      <div
        data-paste-zone="references"
        data-active={zoneActive ? "true" : "false"}
        tabIndex={0}
        onMouseEnter={() => setZoneActive(true)}
        onMouseLeave={() => setZoneActive(false)}
        onFocus={() => setZoneActive(true)}
        onBlur={() => setZoneActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void addReferences(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-2xl border p-3 outline-none transition-colors ${
          zoneActive ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`${labelCls} !mb-0`}>{presenter ? `${presenter.name}'s photos` : client ? "Reference pictures" : "Daniela references"}</span>
          <span className="text-[11px] text-neutral-500">
            {zoneActive ? "Paste or drop to save a reference" : <><span className="[@media(hover:none)]:hidden">Hover here and paste to add</span><span className="hidden [@media(hover:none)]:inline">Tap + to add a reference</span></>}
          </span>
        </div>
        <div className="cs-scroll flex gap-2.5 overflow-x-auto pb-1">
          {(refs ?? []).map((r) => {
            const ticked = !unticked.has(r.id);
            return (
              <div key={r.id} className="group relative w-28 shrink-0 overflow-hidden rounded-xl border bg-black sm:w-24" style={{ aspectRatio: "3 / 4", borderColor: ticked ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)" }}>
                {r.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={r.url} alt={presenter ? `${presenter.name} photo` : client ? "Reference picture" : "Daniela reference"} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() =>
                    setUnticked((prev) => {
                      const next = new Set(prev);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      return next;
                    })
                  }
                  className={`absolute left-1.5 top-1.5 rounded-md px-2 py-1 text-[10px] font-bold ${ticked ? "bg-blue-600 text-white" : "bg-black/60 text-white/70"}`}
                  title="Use this reference as Manus's baseline"
                >
                  {ticked ? "✓ Manus" : "Manus"}
                </button>
                <button type="button" onClick={() => removeReference(r.id)} className="touch-show absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white/80" aria-label="Remove reference">
                  <SvgIcon d={SP.x} size={12} />
                </button>
                <button type="button" onClick={() => pick(r.id)} disabled={!!busy} className="touch-show absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-black/40 py-2 text-[11px] font-bold text-white hover:text-cyan-300">
                  {pickLabel}
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => refInput.current?.click()}
            className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 text-neutral-400 transition-colors hover:border-blue-400/50 hover:text-white"
            style={{ aspectRatio: "3 / 4" }}
          >
            <SvgIcon d={SP.upload} />
            <span className="text-[10px] font-bold">Add</span>
          </button>
          <input
            ref={refInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void addReferences(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
        {refs && refs.length === 0 && (
          <p className="mt-1 text-[11px] text-neutral-400">
            {presenter
              ? `Add 3–6 photos of ${presenter.name} (face close-up, outfits, settings) and Manus copies that look.${presenter.look ? " Until then Manus works from how they look in their presenter card." : ""}`
              : client
                ? `This is ${p.studio.name}'s own library (Daniela's pictures stay in Nexli's studio). Once you've decided who presents for the firm, add 3–6 photos of them and Manus copies that look.`
                : "Add 3–6 photos of Daniela (face close-up, outfits, your office setups). Manus copies her look from them."}
          </p>
        )}
      </div>

      {/* Manus — needs photos (or, for a saved presenter, a description) of who presents */}
      {refs !== null && refs.length === 0 && (presenter ? !presenter.look : client) ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
          <b className="text-white">Manus</b> makes frames from {presenter ? `${presenter.name}'s photos or how they look` : "this studio's reference pictures"}, so it&apos;s off until you add {presenter ? "either" : "some"}. For now, paste or upload the frame.
        </p>
      ) : (
        <div className="space-y-2">
          <span className={labelCls}>{target.kind === "scene" ? `Or have Manus make scene ${target.number}` : "Or have Manus create it"}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={shot}
              onChange={(e) => setShot(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && shot.trim() && !busy && active.length === 0 && generate()}
              placeholder={
                presenter
                  ? `${presenter.name} at a light wooden desk in a navy blazer, warm office light`
                  : client
                    ? "At a light wooden desk in a navy blazer, warm office light"
                    : "Daniela at a light wooden desk in a navy blazer, warm office light"
              }
              className="lp-input !rounded-full !px-4"
            />
            <button type="button" onClick={() => generate()} disabled={!shot.trim() || !!busy || active.length > 0} className={`${CTA_CLASSES} shrink-0 !py-2`}>
              <SvgIcon d={SP.wand} size={16} /> Create 2 options
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            {p.format === "vsl_16x9" ? "Made 16:9 for a VSL." : "Made 9:16 for an ad."}{" "}
            {refs && refs.length > 0 ? "Uses the photos marked ✓ Manus." : presenter?.look ? `Works from how ${presenter.name} looks.` : "Uses the references marked ✓ Manus."}
          </p>
        </div>
      )}

      {detail.frameOptions.length > 0 && (
        <div className="space-y-2">
          <span className={labelCls}>Manus options · {target.kind === "scene" ? `use one for scene ${target.number}?` : target.kind === "new" ? "add one as a scene?" : "use one as the frame?"}</span>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {detail.frameOptions.map((o) => (
              <div key={o.id} className="group relative overflow-hidden rounded-2xl border border-white/15 bg-black sm:w-40" style={{ aspectRatio: aspect }}>
                {o.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={o.url} alt="Frame option" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                )}
                <button type="button" onClick={() => void pickOption(o)} disabled={!!busy} className="absolute inset-x-2 bottom-2 rounded-full bg-blue-600 py-2 text-[11px] font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500">
                  {o.sceneId && scenes.some((sc) => sc.id === o.sceneId) ? `Use for scene ${scenes.find((sc) => sc.id === o.sceneId)!.number}` : pickLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <AssistantCard
        id="stage-frame"
        accent="blue"
        icon={SP.image}
        title={story ? "The scenes" : presenter ? `${presenter.name}'s frame` : client ? "The frame" : "Daniela's frame"}
        right={
          story ? (
            <div className="flex items-center gap-2">
              <Chip tone="blue">{scenes.length} scene{scenes.length === 1 ? "" : "s"}</Chip>
              {target && (
                <button type="button" onClick={() => setTarget(null)} className="text-xs font-semibold text-neutral-400 hover:text-white">
                  Done
                </button>
              )}
            </div>
          ) : frame && !target ? (
            <button type="button" onClick={() => setTarget({ kind: "classic" })} className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 text-xs font-semibold text-neutral-300 hover:text-white">
              Change frame
            </button>
          ) : frame ? (
            <button type="button" onClick={() => setTarget(null)} className="text-xs font-semibold text-neutral-400 hover:text-white">
              Keep current frame
            </button>
          ) : null
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <PresenterPicker studio={p.studio} value={presenter} onPick={choosePresenter} disabled={locked || !!busy} />
          {locked && <span className="text-[11px] text-neutral-500">Unlock the script to change who presents.</span>}
        </div>
        {story ? (
          <div className="space-y-4">
            {p.brief?.plan && waitingScenes.length > 0 && (
              <p className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-violet-100/90">{p.brief.plan}</p>
            )}
            <p className="text-xs text-neutral-400">
              The story plays in this order.{" "}
              {touch ? "Tap a scene to swap its frame." : "Hover a scene and paste to swap its frame, or hover + and paste to add one."}
            </p>
            {(waitingScenes.length > 0 || hasDirection) && (
              <div className="flex flex-wrap items-center gap-2">
                {waitingScenes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void makeScenes()}
                    disabled={!!busy || boardRunning || making.size > 0 || locked}
                    className={`${CTA_CLASSES} !py-2`}
                  >
                    <SvgIcon d={SP.wand} size={16} />
                    {boardRunning ? "Manus is making the scenes…" : `Make ${waitingScenes.length === scenes.length ? "the" : "the other"} ${waitingScenes.length} scene${waitingScenes.length === 1 ? "" : "s"} with Manus`}
                  </button>
                )}
                {hasDirection && !locked && (
                  <button
                    type="button"
                    onClick={() => void plan()}
                    disabled={!!busy || boardRunning}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-semibold text-neutral-200 hover:border-violet-400/50 hover:text-white disabled:opacity-50"
                  >
                    <SvgIcon d={SP.sparkles} size={14} /> {waitingScenes.length > 0 ? "Re-plan the scenes" : "Plan more scenes"}
                  </button>
                )}
              </div>
            )}
            <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3" aria-label="Scenes in story order">
              {scenes.map((sc, i) => {
                const zone: Target = { kind: "scene", id: sc.id, number: sc.number };
                const activeZone = tileZone?.kind === "scene" && tileZone.id === sc.id;
                const chosen = target?.kind === "scene" && target.id === sc.id;
                const n = clipsIn(sc.frameId);
                return (
                  <li key={sc.id} className="min-w-0">
                    <div
                      data-paste-zone="scene"
                      data-active={activeZone ? "true" : "false"}
                      tabIndex={0}
                      onMouseEnter={() => setTileZone(zone)}
                      onMouseLeave={() => setTileZone(null)}
                      onFocus={() => setTileZone(zone)}
                      onBlur={() => setTileZone(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void uploadFiles(Array.from(e.dataTransfer.files), zone);
                      }}
                      className={`group relative overflow-hidden rounded-xl border bg-black outline-none transition-colors ${
                        chosen || activeZone ? "border-blue-400 ring-2 ring-blue-500/30" : sc.frameId || making.has(sc.id) ? "border-white/15" : "border-transparent"
                      }`}
                      style={{ aspectRatio: aspect }}
                    >
                      {sc.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img src={sc.url} alt={`Scene ${sc.number}${sc.label ? `: ${sc.label}` : ""}`} className="h-full w-full object-cover" />
                      ) : making.has(sc.id) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-blue-500/15 to-cyan-400/5 px-2 text-center">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300 motion-reduce:animate-none" aria-hidden="true" />
                          <span className="text-[10px] font-bold text-cyan-200">Manus is making it</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openScene(zone)}
                          className="flex h-full w-full flex-col items-start justify-end gap-1 border-2 border-dashed border-white/15 bg-white/[0.02] p-2 text-left"
                          aria-label={`Scene ${sc.number} isn't made yet. Make it`}
                        >
                          <span className="line-clamp-5 text-[10px] leading-snug text-neutral-300">{sc.shot || "No shot yet"}</span>
                          <span className="text-[10px] font-bold text-cyan-300">Not made yet</span>
                        </button>
                      )}
                      <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-black/75 px-1.5 text-[11px] font-black text-white">{sc.number}</span>
                      {sc.frameId && stale.has(sc.frameId) && (
                        <span className="absolute right-1.5 top-1.5 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-black">New</span>
                      )}
                      {activeZone && !touch && (
                        <span className="absolute inset-x-1 bottom-9 rounded-md bg-blue-600/90 py-1 text-center text-[10px] font-bold text-white">Paste to swap</span>
                      )}
                      <div className="touch-show absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-black/30 px-1 py-1">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !!busy} className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label={`Move scene ${sc.number} earlier`}>
                          ‹
                        </button>
                        <button type="button" onClick={() => openScene(chosen ? null : zone)} className="min-h-7 flex-1 rounded-md text-[10px] font-bold text-white hover:bg-white/10" aria-label={sc.frameId ? `Swap scene ${sc.number}'s frame` : `Make scene ${sc.number}`}>
                          {sc.frameId ? "Swap" : "Make"}
                        </button>
                        <button type="button" onClick={() => removeScene(sc)} disabled={!!busy} className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:bg-rose-500/30" aria-label={`Remove scene ${sc.number}`}>
                          <SvgIcon d={SP.x} size={12} />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === scenes.length - 1 || !!busy} className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label={`Move scene ${sc.number} later`}>
                          ›
                        </button>
                      </div>
                    </div>
                    <input
                      key={`${sc.id}-${sc.label}`}
                      defaultValue={sc.label}
                      placeholder={`Scene ${sc.number}`}
                      aria-label={`Name scene ${sc.number}`}
                      maxLength={80}
                      onBlur={(e) => void rename(sc, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="mt-1.5 w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[16px] font-semibold text-white outline-none placeholder:text-neutral-500 hover:border-white/10 focus:border-blue-400/50 sm:text-xs"
                    />
                    {n > 0 && <p className="px-1 text-[10px] text-neutral-400">{n} clip{n === 1 ? "" : "s"}</p>}
                  </li>
                );
              })}
              {!full && (
                <li className="min-w-0">
                  <button
                    type="button"
                    data-paste-zone="scene"
                    data-active={tileZone?.kind === "new" ? "true" : "false"}
                    onMouseEnter={() => setTileZone({ kind: "new" })}
                    onMouseLeave={() => setTileZone(null)}
                    onFocus={() => setTileZone({ kind: "new" })}
                    onBlur={() => setTileZone(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void uploadFiles(Array.from(e.dataTransfer.files), { kind: "new" });
                    }}
                    onClick={() => setTarget(target?.kind === "new" ? null : { kind: "new" })}
                    className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-neutral-400 transition-colors hover:border-blue-400/50 hover:text-white ${
                      tileZone?.kind === "new" || target?.kind === "new" ? "border-blue-400/60 text-white" : "border-white/15"
                    }`}
                    style={{ aspectRatio: aspect }}
                  >
                    <span className="text-2xl leading-none">+</span>
                    <span className="text-[11px] font-bold">{tileZone?.kind === "new" && !touch ? "Paste to add" : "Add scene"}</span>
                  </button>
                </li>
              )}
            </ol>
            {picker}
            {busy && <p className="text-xs text-neutral-400">{busy}</p>}
          </div>
        ) : frame && !target ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32 overflow-hidden rounded-xl border border-white/15 bg-black shadow-xl shadow-blue-500/10" style={{ aspectRatio: aspect }}>
              {frame.url && (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img src={frame.url} alt="Opening frame" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pb-1">
              <Chip tone="green">✓ Opening frame</Chip>
              <p className="text-xs text-neutral-400">
                Every clip starts from this frame{frame.width && frame.height ? ` (${frame.width}×${frame.height})` : ""}.
              </p>
              <div className="flex flex-wrap items-center gap-x-4">
                {/* A reaction video is one scene: the presenter holding the phone. */}
                {!detail.reaction && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoryOpen(true);
                      setTarget({ kind: "new" });
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-white"
                  >
                    + Add a scene <span className="font-normal text-neutral-400">· tell a story across several frames</span>
                  </button>
                )}
                {hasDirection && !locked && !detail.reaction && (
                  <button
                    type="button"
                    onClick={() => void plan()}
                    disabled={!!busy}
                    className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-white disabled:opacity-50"
                  >
                    <SvgIcon d={SP.sparkles} size={13} /> Plan it as a story
                  </button>
                )}
                {presenter && (
                  <button
                    type="button"
                    onClick={() => void saveToPhotos(frame.id)}
                    disabled={!!busy || saved === frame.id}
                    className="inline-flex min-h-9 items-center text-xs font-semibold text-neutral-400 hover:text-white disabled:opacity-60"
                  >
                    {saved === frame.id ? `✓ Saved to ${presenter.name}'s photos` : `Save to ${presenter.name}'s photos`}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {!frame && !detail.reaction && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/[0.06] px-3.5 py-3">
                <p className="min-w-0 flex-1 text-sm text-neutral-300">
                  <b className="text-white">Telling a story?</b>{" "}
                  {hasDirection ? `Claude splits it into scenes and Manus makes each one with ${who}.` : "Tell me the story in the box below first, then Claude splits it into scenes."}
                </p>
                <button
                  type="button"
                  onClick={() => void plan()}
                  disabled={!hasDirection || !!busy}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  <SvgIcon d={SP.sparkles} size={14} /> Plan it as a story
                </button>
              </div>
            )}
            {picker}
            {busy && <p className="text-xs text-neutral-400">{busy}</p>}
          </div>
        )}
        {busy && !story && frame && !target && <p className="mt-3 text-xs text-neutral-400">{busy}</p>}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files ?? []), uploadTarget.current);
            e.target.value = "";
          }}
        />
      </AssistantCard>

      {active.map((t) => (
        <ManusActivity key={t.id} projectId={p.id} task={t} aspect={aspect} onChange={onChange} onError={onError} onRetry={(s) => void generate(s)} />
      ))}
      {active.length === 0 && lastFailed && (
        <ManusActivity projectId={p.id} task={lastFailed} aspect={aspect} onChange={onChange} onError={onError} onRetry={(s) => void generate(s)} />
      )}
    </div>
  );
}
