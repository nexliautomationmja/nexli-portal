"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { MAX_SCENES } from "@/lib/creative-studio/prompts";
import { CTA_CLASSES, labelCls } from "@/components/launch-pad";
import { inStudioQs, api, send } from "@/components/creative-studio/client";
import { prepareFrame, uploadFrameFile, uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { ManusActivity } from "@/components/creative-studio/manus-activity";
import { useIsTouch } from "@/lib/use-media";

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
  // References belong to this video's studio (Daniela's in Nexli's; a client firm's own).
  const qs = inStudioQs(p.studio.key);
  const client = p.studio.kind === "client";
  const touch = useIsTouch();
  const [storyOpen, setStoryOpen] = useState(false);
  const story = scenes.length > 1 || storyOpen;
  const [target, setTarget] = useState<Target | null>(frame ? null : { kind: "classic" });
  const [refs, setRefs] = useState<Reference[] | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [zoneActive, setZoneActive] = useState(false);
  const [tileZone, setTileZone] = useState<Target | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Target>({ kind: "classic" });
  const polling = useRef(false);

  const active = detail.manus.filter((t) => t.status === "running" || (t.status === "waiting" && t.waiting));
  const newest = detail.manus[detail.manus.length - 1];
  const lastFailed = newest?.status === "failed" && newest.error !== "Cancelled" ? newest : undefined;
  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";
  const vertical = p.format === "ad_9x16";
  const full = scenes.filter((s) => s.frameId).length >= MAX_SCENES;

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
      const room = MAX_SCENES - scenes.filter((s) => s.frameId).length;
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

  async function removeReference(id: string) {
    if (!confirm(client ? "Remove this reference picture?" : "Remove this image from your Daniela references?")) return;
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
    const r = await send(api(`${p.id}/frame/generate`), "POST", { shot: shotText, referenceIds });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setShot("");
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

  function openUpload(to: Target) {
    uploadTarget.current = to;
    fileInput.current?.click();
  }

  const stale = new Set((p.frameSpec?.scenes ?? []).filter((s) => s.stale).map((s) => s.frameId));
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
              <b className="text-white">New frame for scene {target.number}.</b> Upload one, use a reference, or let Manus make it.
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
          <span className={`${labelCls} !mb-0`}>{client ? "Reference pictures" : "Daniela references"}</span>
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
                  <img src={r.url} alt={client ? "Reference picture" : "Daniela reference"} className="h-full w-full object-cover" />
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
            {client
              ? `This is ${p.studio.name}'s own library (Daniela's pictures stay in Nexli's studio). Once you've decided who presents for the firm, add 3–6 photos of them and Manus copies that look.`
              : "Add 3–6 photos of Daniela (face close-up, outfits, your office setups). Manus copies her look from them."}
          </p>
        )}
      </div>

      {/* Manus — a client studio needs its own reference pictures first (no Daniela there) */}
      {client && refs !== null && refs.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
          <b className="text-white">Manus</b> makes frames from this studio&apos;s reference pictures, so it&apos;s off until you add some. For now, paste or upload the frame.
        </p>
      ) : (
        <div className="space-y-2">
          <span className={labelCls}>Or have Manus create it</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={shot}
              onChange={(e) => setShot(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && shot.trim() && !busy && active.length === 0 && generate()}
              placeholder={client ? "At a light wooden desk in a navy blazer, warm office light" : "Daniela at a light wooden desk in a navy blazer, warm office light"}
              className="lp-input !rounded-full !px-4"
            />
            <button type="button" onClick={() => generate()} disabled={!shot.trim() || !!busy || active.length > 0} className={`${CTA_CLASSES} shrink-0 !py-2`}>
              <SvgIcon d={SP.wand} size={16} /> Create 2 options
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            {p.format === "vsl_16x9" ? "Made 16:9 for a VSL." : "Made 9:16 for an ad."} Uses the references marked ✓ Manus.
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
                <button type="button" onClick={() => pick(o.id)} disabled={!!busy} className="absolute inset-x-2 bottom-2 rounded-full bg-blue-600 py-2 text-[11px] font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500">
                  {pickLabel}
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
        title={story ? "The scenes" : client ? "The frame" : "Daniela's frame"}
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
        {story ? (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              The story plays in this order.{" "}
              {touch ? "Tap a scene to swap its frame." : "Hover a scene and paste to swap its frame, or hover + and paste to add one."}
            </p>
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
                        chosen || activeZone ? "border-blue-400 ring-2 ring-blue-500/30" : "border-white/15"
                      }`}
                      style={{ aspectRatio: aspect }}
                    >
                      {sc.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img src={sc.url} alt={`Scene ${sc.number}${sc.label ? `: ${sc.label}` : ""}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">No frame</div>
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
                        <button type="button" onClick={() => setTarget(chosen ? null : zone)} className="min-h-7 flex-1 rounded-md text-[10px] font-bold text-white hover:bg-white/10" aria-label={`Swap scene ${sc.number}'s frame`}>
                          Swap
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
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {picker}
            {busy && <p className="text-xs text-neutral-400">{busy}</p>}
          </div>
        )}
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
