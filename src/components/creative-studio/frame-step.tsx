"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";
import { prepareFrame, uploadToTarget } from "@/components/creative-studio/upload";
import { INPUT } from "@/components/creative-studio/ui";

interface Reference {
  id: string;
  url: string | null;
}

/**
 * Step 1 — Daniela's opening frame. Either use one of your Daniela reference
 * images as the frame, or have Manus generate new frames with the references
 * as the baseline, then pick one. Ads are cropped to 9:16.
 */
export function FrameStep({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [refs, setRefs] = useState<Reference[] | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const frameInput = useRef<HTMLInputElement>(null);
  const polling = useRef(false);

  const loadRefs = useCallback(async () => {
    const r = await fetch("/api/dashboard/creative-studio/references");
    const b = await r.json().catch(() => null);
    if (r.ok && b?.references) setRefs(b.references);
  }, []);

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

  const running = detail.manus.filter((t) => t.status === "running");
  const failed = detail.manus.filter((t) => t.status === "failed").slice(-1)[0];

  // Manus takes a few minutes; check every 15 s while a task is running.
  useEffect(() => {
    if (running.length === 0) return;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      const r = await send(api(`${p.id}/frame/poll`), "POST");
      polling.current = false;
      if (r.ok) onChange(r.data);
    };
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [running.length, p.id, onChange]);

  // Paste images straight into the references (Cmd/Ctrl+V anywhere on the
  // page). Text pastes into the shot box are left alone.
  const addRef = useRef(addReferences);
  addRef.current = addReferences;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void addRef.current(
        images.map((f, i) =>
          f.name && f.name !== "image.png" ? f : new File([f], `pasted-${Date.now()}-${i}.${f.type.split("/")[1] || "png"}`, { type: f.type })
        )
      );
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const chosen = selected ?? new Set((refs ?? []).map((r) => r.id));

  async function addReferences(files: FileList | File[] | null) {
    const list = files ? Array.from(files).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type)) : [];
    if (list.length === 0) return;
    setBusy(list.length > 1 ? `Adding ${list.length} references…` : "Adding reference…");
    for (const file of list) {
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
    if (refInput.current) refInput.current.value = "";
  }

  async function removeReference(id: string) {
    if (!confirm("Remove this reference image from your library?")) return;
    const r = await fetch(`/api/dashboard/creative-studio/references?assetId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) loadRefs();
  }

  async function pick(assetId: string) {
    setBusy("Setting the frame…");
    const r = await send(api(`${p.id}/frame/pick`), "POST", { assetId });
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function generate() {
    setBusy("Starting Manus…");
    const r = await send(api(`${p.id}/frame/generate`), "POST", { shot, referenceIds: [...chosen] });
    setBusy(null);
    if (r.ok) {
      onChange(r.data);
      setShot("");
    } else onError(r.error);
  }

  async function uploadFrame(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      setBusy("Uploading frame…");
      const prepared = await prepareFrame(file, p.format === "ad_9x16");
      const sign = await fetch(api(`${p.id}/frames`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", mime: prepared.mime }),
      });
      const target = await sign.json().catch(() => null);
      if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
      await uploadToTarget(target, prepared.blob, prepared.mime);
      const r = await send(api(`${p.id}/frames`), "POST", {
        action: "register",
        path: target.path,
        mime: prepared.mime,
        width: prepared.width,
        height: prepared.height,
      });
      if (!r.ok) throw new Error(r.error);
      // Uploaded frames go last; make it the opening frame.
      const newest = r.data.frames[r.data.frames.length - 1];
      const primary = newest ? await send(api(`${p.id}/frames`), "PATCH", { primaryId: newest.id }) : r;
      if (primary.ok) onChange(primary.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (frameInput.current) frameInput.current.value = "";
    }
  }

  const current = detail.frames[0];
  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";

  return (
    <div className="space-y-6">
      {/* Daniela references */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Daniela references</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Your baseline images of Daniela, saved for every video. Paste an image (⌘V) or add files. Use one as the frame, or tick the ones Manus should copy her look from.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refInput.current?.click()}
            className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-[var(--input-bg)]"
            style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
          >
            + Add references
          </button>
          <input ref={refInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => addReferences(e.target.files)} />
        </div>
        {refs === null ? (
          <div className="h-36 rounded-xl animate-pulse" style={{ background: "var(--input-bg)" }} />
        ) : refs.length === 0 ? (
          <button
            type="button"
            onClick={() => refInput.current?.click()}
            className="w-full rounded-xl border-2 border-dashed py-8 text-sm hover:bg-[var(--input-bg)]"
            style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
          >
            Paste (⌘V) or click to add 3–6 images of Daniela: a clear face close-up, a couple of outfits, your usual office setups.
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {refs.map((r) => (
              <div key={r.id} className="relative w-28 shrink-0 overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: "3 / 4", borderColor: chosen.has(r.id) ? "#3b82f6" : "var(--card-border)" }}>
                {r.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={r.url} alt="Daniela reference" className="h-full w-full object-cover" />
                )}
                <label className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <input
                    type="checkbox"
                    checked={chosen.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setSelected(next);
                    }}
                  />
                  Manus
                </label>
                <button type="button" onClick={() => removeReference(r.id)} className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white/80" aria-label="Remove reference">
                  ✕
                </button>
                <button type="button" onClick={() => pick(r.id)} disabled={!!busy} className="absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-[10px] font-bold text-white hover:bg-blue-600">
                  Use as frame
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manus */}
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Or create a new frame with Manus</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={shot}
            onChange={(e) => setShot(e.target.value)}
            placeholder="e.g. Daniela at a light wooden desk in a navy blazer, warm office light, bookshelves behind her"
            className={INPUT}
            style={{ color: "var(--text-main)" }}
          />
          <button type="button" onClick={generate} disabled={!shot.trim() || !!busy || running.length > 0} className="btn-primary px-5 py-2 text-sm shrink-0">
            Create 2 options
          </button>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Manus uses the ticked references so it&apos;s the same Daniela. {p.format === "vsl_16x9" ? "Frames are made 16:9 for a VSL." : "Frames are made 9:16 for an ad."}
        </p>
        {running.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-xs" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
            Manus is creating your frames ({running[0].shot}). This usually takes a few minutes. You can leave this page and come back.
          </div>
        )}
        {failed && running.length === 0 && detail.frameOptions.length === 0 && (
          <p className="text-xs font-semibold text-rose-500">{failed.error}</p>
        )}
      </div>

      {detail.frameOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Manus options</p>
          <div className="flex flex-wrap gap-3">
            {detail.frameOptions.map((o) => (
              <div key={o.id} className="relative w-44 overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: aspect, borderColor: "var(--card-border)" }}>
                {o.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={o.url} alt="Frame option" className="h-full w-full object-cover" />
                )}
                <button type="button" onClick={() => pick(o.id)} disabled={!!busy} className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-[11px] font-bold text-white hover:bg-blue-600">
                  Use this frame
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {current?.url && (
          <div className="flex items-center gap-3">
            <div className="w-16 overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: aspect, borderColor: "#3b82f6" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={current.url} alt="Opening frame" className="h-full w-full object-cover" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>★ Current opening frame</span>
          </div>
        )}
        <button type="button" onClick={() => frameInput.current?.click()} disabled={!!busy} className="text-xs font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
          Upload a frame made elsewhere
        </button>
        <input ref={frameInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => uploadFrame(e.target.files)} />
        {busy && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{busy}</span>}
      </div>
    </div>
  );
}
