"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CTA_CLASSES, labelCls } from "@/components/launch-pad";
import { api, send } from "@/components/creative-studio/client";
import { prepareFrame, uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { ManusActivity } from "@/components/creative-studio/manus-activity";

interface Reference {
  id: string;
  url: string | null;
}

/**
 * Daniela's frame. Paste an image into the chat box to use it as the frame.
 * Or pick one of your Daniela references, or have Manus create two options
 * (using the ticked references as the baseline) and choose "Use as frame?".
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
  const [picking, setPicking] = useState(!frame);
  const [refs, setRefs] = useState<Reference[] | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [zoneActive, setZoneActive] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const polling = useRef(false);

  const active = detail.manus.filter((t) => t.status === "running" || (t.status === "waiting" && t.waiting));
  const newest = detail.manus[detail.manus.length - 1];
  const lastFailed = newest?.status === "failed" && newest.error !== "Cancelled" ? newest : undefined;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/references")
      .then((r) => r.json())
      .then((b) => !cancelled && setRefs(b?.references ?? []))
      .catch(() => !cancelled && setRefs([]));
    return () => {
      cancelled = true;
    };
  }, []);

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
          const sign = await fetch("/api/dashboard/creative-studio/references", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sign", mime: prepared.mime }),
          });
          const target = await sign.json().catch(() => null);
          if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
          await uploadToTarget(target, prepared.blob, prepared.mime);
          const reg = await fetch("/api/dashboard/creative-studio/references", {
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
    [onError]
  );
  const addRef = useRef(addReferences);
  addRef.current = addReferences;

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

  async function removeReference(id: string) {
    if (!confirm("Remove this image from your Daniela references?")) return;
    const r = await fetch(`/api/dashboard/creative-studio/references?assetId=${encodeURIComponent(id)}`, { method: "DELETE" });
    const b = await r.json().catch(() => null);
    if (r.ok && b?.references) setRefs(b.references);
  }

  async function pick(assetId: string) {
    setBusy("Setting the frame…");
    const r = await send(api(`${p.id}/frame/pick`), "POST", { assetId });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setPicking(false);
      onFrameChosen();
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

  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";

  return (
    <div className="space-y-4">
      <AssistantCard
        id="stage-frame"
        accent="blue"
        icon={SP.image}
        title="Daniela's frame"
        right={
          frame && !picking ? (
            <button type="button" onClick={() => setPicking(true)} className="text-xs font-semibold text-neutral-400 hover:text-white">
              Change frame
            </button>
          ) : frame ? (
            <button type="button" onClick={() => setPicking(false)} className="text-xs font-semibold text-neutral-400 hover:text-white">
              Keep current frame
            </button>
          ) : null
        }
      >
        {frame && !picking ? (
          <div className="flex items-end gap-4">
            <div className="w-32 overflow-hidden rounded-xl border border-white/15 bg-black shadow-xl shadow-blue-500/10" style={{ aspectRatio: aspect }}>
              {frame.url && (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img src={frame.url} alt="Opening frame" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="space-y-1.5 pb-1">
              <Chip tone="green">✓ Opening frame</Chip>
              <p className="text-xs text-neutral-400">
                Every clip starts from this frame{frame.width && frame.height ? ` (${frame.width}×${frame.height})` : ""}.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-neutral-300">
              <b className="text-white">Paste the frame into the box below</b> and it&apos;s used as-is. Or use one of your references, or let Manus make one.
            </p>

            {/* Daniela references (paste zone) */}
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
                <span className={`${labelCls} !mb-0`}>Daniela references</span>
                <span className="text-[11px] text-neutral-500">{zoneActive ? "Paste or drop to save a reference" : "Hover here and paste to add"}</span>
              </div>
              <div className="cs-scroll flex gap-2.5 overflow-x-auto pb-1">
                {(refs ?? []).map((r) => {
                  const ticked = !unticked.has(r.id);
                  return (
                    <div key={r.id} className="group relative w-24 shrink-0 overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: "3 / 4", borderColor: ticked ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)" }}>
                      {r.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img src={r.url} alt="Daniela reference" className="h-full w-full object-cover" />
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
                        className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${ticked ? "bg-blue-600 text-white" : "bg-black/60 text-white/70"}`}
                        title="Use this reference as Manus's baseline"
                      >
                        {ticked ? "✓ Manus" : "Manus"}
                      </button>
                      <button type="button" onClick={() => removeReference(r.id)} className="absolute right-1.5 top-1.5 hidden rounded-md bg-black/70 p-0.5 text-white/80 group-hover:block" aria-label="Remove reference">
                        <SvgIcon d={SP.x} size={12} />
                      </button>
                      <button type="button" onClick={() => pick(r.id)} disabled={!!busy} className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-black/40 py-1.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:text-cyan-300">
                        Use as frame
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
                <p className="mt-1 text-[11px] text-neutral-500">Add 3–6 photos of Daniela (face close-up, outfits, your office setups). Manus copies her look from them.</p>
              )}
            </div>

            {/* Manus */}
            <div className="space-y-2">
              <span className={labelCls}>Or have Manus create it</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={shot}
                  onChange={(e) => setShot(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && shot.trim() && !busy && active.length === 0 && generate()}
                  placeholder="Daniela at a light wooden desk in a navy blazer, warm office light"
                  className="lp-input !rounded-full !px-4"
                />
                <button type="button" onClick={() => generate()} disabled={!shot.trim() || !!busy || active.length > 0} className={`${CTA_CLASSES} shrink-0 !py-2`}>
                  <SvgIcon d={SP.wand} size={16} /> Create 2 options
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                {p.format === "vsl_16x9" ? "Made 16:9 for a VSL." : "Made 9:16 for an ad."} Uses the references marked ✓ Manus.
              </p>
            </div>

            {detail.frameOptions.length > 0 && (
              <div className="space-y-2">
                <span className={labelCls}>Manus options · use one as the frame?</span>
                <div className="flex flex-wrap gap-3">
                  {detail.frameOptions.map((o) => (
                    <div key={o.id} className="group relative w-40 overflow-hidden rounded-2xl border border-white/15 bg-black" style={{ aspectRatio: aspect }}>
                      {o.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img src={o.url} alt="Frame option" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      )}
                      <button type="button" onClick={() => pick(o.id)} disabled={!!busy} className="absolute inset-x-2 bottom-2 rounded-full bg-blue-600 py-2 text-[11px] font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500">
                        Use as frame
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {busy && <p className="text-xs text-neutral-400">{busy}</p>}
          </div>
        )}
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
