"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PresenterInfo, Pronoun } from "@/lib/creative-studio/tables";
import { defaultVoice } from "@/lib/creative-studio/prompts";
import { Button, FIELD, Segmented, Sheet } from "@/components/rainmaker";
import { inStudioQs } from "@/components/creative-studio/client";
import { uploadReferenceFile } from "@/components/creative-studio/upload";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";

/** A saved presenter as the presenters API lists them. */
export interface PresenterOption {
  id: string;
  name: string;
  pronoun: Pronoun;
  voice: string;
  look: string;
  photos: number;
  thumbUrl: string | null;
}

interface StudioLite {
  key: string;
  kind: "nexli" | "client";
  name: string;
}

/** The studio's default presenter's name: Daniela in Nexli's studio. */
export const defaultPresenterName = (studio: StudioLite) => (studio.kind === "client" ? `${studio.name}'s presenter` : "Daniela");

/** The studio's saved presenters (reload with `refresh`). */
export function usePresenters(studioKey: string) {
  const [list, setList] = useState<PresenterOption[] | null>(null);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/dashboard/creative-studio/presenters${inStudioQs(studioKey)}`).catch(() => null);
    const b = await r?.json().catch(() => null);
    setList(r?.ok && Array.isArray(b?.presenters) ? b.presenters : []);
  }, [studioKey]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/creative-studio/presenters${inStudioQs(studioKey)}`)
      .then((r) => r.json())
      .then((b) => !cancelled && setList(Array.isArray(b?.presenters) ? b.presenters : []))
      .catch(() => !cancelled && setList([]));
    return () => {
      cancelled = true;
    };
  }, [studioKey]);
  return { list, setList, refresh };
}

/**
 * "Presenter: Daniela ▾" — who's in this video. Lists the studio's default
 * presenter and its saved presenters, and opens the editor to add one.
 */
export function PresenterPicker({
  studio,
  value,
  onPick,
  disabled = false,
  label = "Presenter",
}: {
  studio: StudioLite;
  /** The chosen presenter (null = the studio's default). */
  value: { id: string; name: string } | PresenterInfo | null;
  onPick: (presenterId: string | null, option?: PresenterOption) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const { list, setList } = usePresenters(studio.key);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PresenterOption | "new" | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const current = value?.id ? list?.find((x) => x.id === value.id) : null;
  const name = value?.name || defaultPresenterName(studio);

  // Close the menu on an outside click or Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = async (id: string | null) => {
    setOpen(false);
    if ((id ?? null) !== (value?.id || null)) await onPick(id, list?.find((x) => x.id === id));
  };

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs font-semibold text-white transition-colors hover:border-white/25 disabled:opacity-50"
      >
        <Avatar url={current?.thumbUrl ?? null} name={name} />
        <span className="text-neutral-400">{label}:</span>
        <span className="max-w-[10rem] truncate">{name}</span>
        <span aria-hidden="true" className="text-neutral-400">
          ▾
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1.5 w-72 max-w-[85vw] overflow-hidden rounded-2xl border border-white/15 bg-[#0b1220] p-1.5 shadow-2xl shadow-black/60">
          <MenuRow active={!value?.id} onClick={() => void choose(null)} name={defaultPresenterName(studio)} sub={studio.kind === "client" ? "Whoever is in the studio's reference pictures" : "The default presenter"} url={null} />
          {(list ?? []).map((x) => (
            <MenuRow
              key={x.id}
              active={value?.id === x.id}
              onClick={() => void choose(x.id)}
              name={x.name}
              sub={`${x.pronoun === "he" ? "He/him" : "She/her"} · ${x.photos ? `${x.photos} photo${x.photos === 1 ? "" : "s"}` : x.look ? "Described, no photos yet" : "No photos yet"}`}
              url={x.thumbUrl}
            />
          ))}
          {list === null && <p className="px-3 py-2 text-xs text-neutral-400">Loading presenters…</p>}
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setEditing("new");
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-cyan-300 hover:bg-white/5"
          >
            + New presenter
          </button>
          {current && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setEditing(current);
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-neutral-300 hover:bg-white/5"
            >
              <SvgIcon d={SP.pen} size={14} /> Edit {current.name}
            </button>
          )}
        </div>
      )}
      <PresenterSheet
        studio={studio}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={async (presenters, id, created) => {
          setList(presenters);
          // A new presenter is the one you meant to use.
          if (created) await onPick(id, presenters.find((x) => x.id === id));
        }}
        onArchived={async (presenters, id) => {
          setList(presenters);
          setEditing(null);
          if (value?.id === id) await onPick(null);
        }}
      />
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    <img src={url} alt="" className="h-7 w-7 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/40 to-cyan-400/30 text-[11px] font-black text-white">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function MenuRow({ active, onClick, name, sub, url }: { active: boolean; onClick: () => void; name: string; sub: string; url: string | null }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors ${active ? "bg-blue-500/15" : "hover:bg-white/5"}`}
    >
      <Avatar url={url} name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{name}</span>
        <span className="block truncate text-[11px] text-neutral-400">{sub}</span>
      </span>
      {active && <span className="text-xs font-bold text-blue-300">✓</span>}
    </button>
  );
}

/**
 * Add or edit a presenter: name, woman or man, how they sound (worded the
 * same in every Kling clip), how they look (Manus works from it without
 * photos) and their reference photos.
 */
export function PresenterSheet({
  studio,
  editing,
  onClose,
  onSaved,
  onArchived,
}: {
  studio: StudioLite;
  editing: PresenterOption | "new" | null;
  onClose: () => void;
  onSaved: (presenters: PresenterOption[], id: string, created: boolean) => void | Promise<void>;
  onArchived: (presenters: PresenterOption[], id: string) => void | Promise<void>;
}) {
  const client = studio.kind === "client";
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pronoun, setPronoun] = useState<Pronoun>("she");
  const [voice, setVoice] = useState("");
  const [look, setLook] = useState("");
  const [photos, setPhotos] = useState<{ id: string; url: string | null }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const qs = id ? `${inStudioQs(studio.key)}&presenter=${encodeURIComponent(id)}` : null;

  // Load the form whenever the sheet opens.
  useEffect(() => {
    if (!editing) return;
    const p = editing === "new" ? null : editing;
    /* eslint-disable react-hooks/set-state-in-effect -- the form mirrors the presenter being opened */
    setId(p?.id ?? null);
    setName(p?.name ?? "");
    setPronoun(p?.pronoun ?? "she");
    setVoice(p?.voice || defaultVoice(p?.pronoun ?? "she", client));
    setLook(p?.look ?? "");
    setPhotos([]);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editing, client]);

  // Their photos.
  useEffect(() => {
    if (!qs) return;
    let cancelled = false;
    fetch(`/api/dashboard/creative-studio/references${qs}`)
      .then((r) => r.json())
      .then((b) => !cancelled && setPhotos(b?.references ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const addPhotos = useCallback(
    async (files: File[]) => {
      if (!qs) return;
      const images = files.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
      for (let i = 0; i < images.length; i++) {
        setBusy(images.length > 1 ? `Saving photo ${i + 1} of ${images.length}…` : "Saving the photo…");
        try {
          setPhotos(await uploadReferenceFile(qs, images[i]));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        }
      }
      setBusy(null);
    },
    [qs]
  );
  const addRef = useRef(addPhotos);
  useEffect(() => {
    addRef.current = addPhotos;
  });

  // Paste while hovering the photos area.
  useEffect(() => {
    if (!zone) return;
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void addRef.current(images);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [zone]);

  function switchPronoun(next: Pronoun) {
    // Keep a voice they wrote; swap the default wording to match.
    if (voice.trim() === defaultVoice(pronoun, client)) setVoice(defaultVoice(next, client));
    setPronoun(next);
  }

  async function save() {
    if (!name.trim()) {
      setError("Give the presenter a name.");
      return;
    }
    setBusy("Saving…");
    setError(null);
    const url = id
      ? `/api/dashboard/creative-studio/presenters/${encodeURIComponent(id)}${inStudioQs(studio.key)}`
      : `/api/dashboard/creative-studio/presenters${inStudioQs(studio.key)}`;
    const r = await fetch(url, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pronoun, voice, look }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setBusy(null);
    if (!r?.ok || !b?.id) {
      setError(b?.error || "Couldn't save the presenter.");
      return;
    }
    const created = !id;
    setId(b.id);
    await onSaved(b.presenters, b.id, created);
    // A new presenter stays open so you can add their photos.
    if (!created) onClose();
  }

  async function archive() {
    if (!id || !confirm(`Remove ${name || "this presenter"} from the studio? Videos already made with them keep working.`)) return;
    setBusy("Removing…");
    const r = await fetch(`/api/dashboard/creative-studio/presenters/${encodeURIComponent(id)}${inStudioQs(studio.key)}`, { method: "DELETE" }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setBusy(null);
    if (!r?.ok) {
      setError(b?.error || "Couldn't remove the presenter.");
      return;
    }
    await onArchived(b.presenters, id);
  }

  async function removePhoto(assetId: string) {
    if (!qs || !confirm("Remove this photo?")) return;
    const r = await fetch(`/api/dashboard/creative-studio/references${qs}&assetId=${encodeURIComponent(assetId)}`, { method: "DELETE" }).catch(() => null);
    const b = await r?.json().catch(() => null);
    if (r?.ok && b?.references) setPhotos(b.references);
  }

  return (
    <Sheet
      open={Boolean(editing)}
      onClose={onClose}
      size="md"
      title={id ? `${name || "Presenter"}` : "New presenter"}
      sub={id ? "Who presents, how they sound and how they look." : "Someone other than " + defaultPresenterName(studio) + " to present your videos."}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {id ? (
            <Button variant="danger" size="sm" onClick={() => void archive()} disabled={Boolean(busy)}>
              Remove presenter
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {id ? "Close" : "Cancel"}
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={Boolean(busy)}>
              {busy === "Saving…" ? "Saving…" : id ? "Save" : "Create presenter"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Marcus" className={FIELD} />
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Voice</span>
          <Segmented<Pronoun>
            value={pronoun}
            onChange={switchPronoun}
            ariaLabel="Voice"
            options={[
              { value: "she", label: "Woman · she" },
              { value: "he", label: "Man · he" },
            ]}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">How they sound</span>
          <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={3} maxLength={600} className={`${FIELD} resize-y`} />
          <span className="mt-1 block text-[11px] text-neutral-400">
            Kling gets this word for word in every clip, as &ldquo;{name.trim() || "Name"}&apos;s voice, the same in every clip: …&rdquo;. Keeping it identical keeps the voice steady.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">How they look</span>
          <textarea
            value={look}
            onChange={(e) => setLook(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="e.g. early 40s, short black hair with a little grey, trimmed beard, warm brown eyes, tailored navy suits"
            className={`${FIELD} resize-y`}
          />
          <span className="mt-1 block text-[11px] text-neutral-400">Manus makes their frames from their photos, or from this when there are none yet.</span>
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Photos</span>
          {id ? (
            <div
              data-paste-zone="presenter-photos"
              data-active={zone ? "true" : "false"}
              tabIndex={0}
              onMouseEnter={() => setZone(true)}
              onMouseLeave={() => setZone(false)}
              onFocus={() => setZone(true)}
              onBlur={() => setZone(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addPhotos(Array.from(e.dataTransfer.files));
              }}
              className={`rounded-2xl border p-3 outline-none transition-colors ${zone ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}
            >
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {photos.map((ph) => (
                  <div key={ph.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black" style={{ aspectRatio: "3 / 4" }}>
                    {ph.url && (
                      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                      <img src={ph.url} alt={`${name} photo`} className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => void removePhoto(ph.id)}
                      className="touch-show absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white/80"
                      aria-label="Remove photo"
                    >
                      <SvgIcon d={SP.x} size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 text-neutral-400 transition-colors hover:border-blue-400/50 hover:text-white"
                  style={{ aspectRatio: "3 / 4" }}
                >
                  <SvgIcon d={SP.upload} />
                  <span className="text-[10px] font-bold">Add</span>
                </button>
              </div>
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  void addPhotos(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-[11px] text-neutral-400">
                {busy && busy !== "Saving…" ? busy : "3–6 photos work best: a face close-up and a few outfits or settings. Hover here and paste, drop, or tap Add."}
              </p>
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] text-neutral-400">Create the presenter first, then add their photos here.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
