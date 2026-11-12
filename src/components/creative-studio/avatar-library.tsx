"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StudioView } from "@/lib/creative-studio/studios";
import { AVATAR_MAX_PHOTOS, KLING_EXTRA_PHOTOS, SAMPLE_MAX, TRIAL_CREDITS, type AvatarView } from "@/lib/creative-studio/avatar-shared";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { Button, FIELD, Segmented, Sheet } from "@/components/rainmaker";
import { AssistantCard, Chip, ErrorStrip, SP, StudioCanvas, StudioTabs, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { inStudioQs, studioHref } from "@/components/creative-studio/client";
import { StudioSwitch } from "@/components/creative-studio/home";
import { uploadReferenceFile } from "@/components/creative-studio/upload";
import { entriesOf, filesFromEntries, photosFromDrop, type PhotoPick } from "@/components/creative-studio/avatar-zip";

const API = "/api/dashboard/creative-studio/avatars";

interface FirmStudio {
  key: string;
  name: string;
  defaultPresenterId: string | null;
}

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!r) throw new Error("Network error. Check your connection and try again.");
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data as T;
}

/** Where an avatar's photos live (they move to the firm's studio with it). */
const photoQs = (a: Pick<AvatarView, "id" | "assigned">) => `${inStudioQs(a.assigned?.studioKey ?? "nexli")}&presenter=${encodeURIComponent(a.id)}`;

/** Upload photos two at a time, reporting progress. */
async function uploadAll(qs: string, files: File[], onProgress: (done: number) => void): Promise<string[]> {
  const errors: string[] = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      try {
        await uploadReferenceFile(qs, f);
      } catch (err) {
        errors.push(`${f.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
      onProgress(++done);
    }
  };
  await Promise.all([worker(), worker()]);
  return errors;
}

// One voice plays at a time across the page.
let playing: HTMLAudioElement | null = null;

function VoicePlay({ url, label, sub, size = "md" }: { url: string | null; label?: string; sub?: string; size?: "sm" | "md" }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const [progress, setProgress] = useState(0);
  if (!url) return null;
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      if (playing && playing !== el) playing.pause();
      playing = el;
      void el.play().catch(() => {});
    } else el.pause();
  };
  const sm = size === "sm";
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={on ? "Pause the voice" : `Play ${label ?? "the voice"}`}
        className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 ${sm ? "h-9 w-9" : "h-11 w-11"}`}
      >
        <svg width={sm ? 14 : 16} height={sm ? 14 : 16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {on ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5.5v13l11-6.5z" />}
        </svg>
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16.5" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeDasharray={`${progress * 103.7} 103.7`} />
        </svg>
      </button>
      {(label || sub) && (
        <span className="min-w-0">
          {label && <span className="block truncate text-sm font-semibold text-white">{label}</span>}
          {sub && <span className="block truncate text-[11px] text-neutral-400">{sub}</span>}
        </span>
      )}
      <audio
        ref={audio}
        src={url}
        preload="none"
        onPlay={() => setOn(true)}
        onPause={() => setOn(false)}
        onEnded={() => {
          setOn(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
      />
    </span>
  );
}

function StatusChip({ a }: { a: AvatarView }) {
  if (!a.locked) return <Chip tone="amber">Draft</Chip>;
  if (a.assigned) return <Chip tone="blue">{a.assigned.studioName}</Chip>;
  return <Chip tone="green">Available</Chip>;
}

function klingLine(a: AvatarView): { text: string; tone: string } {
  switch (a.kling.status) {
    case "ready":
      return { text: "Ready on Kling · same face and voice in every clip", tone: "text-emerald-300" };
    case "pending":
      return { text: "Setting up on Kling…", tone: "text-neutral-400" };
    case "needs_photo":
      return { text: "Kling needs one more photo (another angle)", tone: "text-amber-200" };
    case "error":
      return { text: `Kling: ${a.kling.error ?? "couldn't set it up"}`, tone: "text-rose-300" };
    default:
      return { text: "Not locked in yet", tone: "text-neutral-500" };
  }
}

/**
 * The Avatars tab: drop a zip of photos of the person you want → Claude reads
 * them and writes their voice → ElevenLabs makes 3 voices → lock one in →
 * give the avatar to one firm, whose studio then uses it everywhere.
 */
export function AvatarLibrary({ studio }: { studio: StudioView }) {
  const [avatars, setAvatars] = useState<AvatarView[] | null>(null);
  const [studios, setStudios] = useState<FirmStudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await call<{ avatars: AvatarView[]; studios: FirmStudio[] }>(API, "GET");
      setAvatars(b.avatars);
      setStudios(b.studios);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the avatars.");
      setAvatars((a) => a ?? []);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load of the library
    void load();
  }, [load]);

  const upsert = useCallback((a: AvatarView) => {
    setAvatars((list) => {
      const rest = (list ?? []).filter((x) => x.id !== a.id);
      return list?.some((x) => x.id === a.id) ? (list ?? []).map((x) => (x.id === a.id ? a : x)) : [a, ...rest];
    });
  }, []);

  const open = avatars?.find((a) => a.id === openId) ?? null;
  const drafts = (avatars ?? []).filter((a) => !a.locked);
  const available = (avatars ?? []).filter((a) => a.locked && !a.assigned);
  const assigned = (avatars ?? []).filter((a) => a.locked && a.assigned);

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <header className="lp-card flex justify-center pb-2 pt-8 sm:pt-12">
          <div className="flex w-full flex-col items-center gap-4">
            <StudioSwitch studio={studio} />
            <StudioTabs active="avatars" studioKey={studio.key} />
          </div>
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">
              AI Avatars · one per firm
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl" style={SYNE}>
              Their own face and voice.{" "}
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">No one else&apos;s ads.</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
              Drop a zip of photos of the person you want. Claude reads them and writes how they should sound, ElevenLabs makes the voice, you lock it in — then give
              the avatar to one firm. No other studio can ever use it.
            </p>
          </div>

          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          <NewAvatar
            onCreated={(a) => {
              upsert(a);
            }}
            onDone={(a) => {
              upsert(a);
              setOpenId(a.id);
            }}
            onOpen={setOpenId}
          />

          {avatars === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : avatars.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No avatars yet. Drop the first zip above.</p>
          ) : (
            <>
              <AvatarGroup title="Drafts" sub="Not locked in yet — open one to finish it." list={drafts} onOpen={setOpenId} />
              <AvatarGroup title="Available" sub="Locked in and ready to give to a firm." list={available} onOpen={setOpenId} />
              <AvatarGroup title="Assigned" sub="Each one belongs to one firm's studio." list={assigned} onOpen={setOpenId} />
            </>
          )}
        </div>
      </div>

      <AvatarSheet
        avatar={open}
        studios={studios}
        onClose={() => setOpenId(null)}
        onChange={upsert}
        onRetired={(id) => {
          setAvatars((list) => (list ?? []).filter((a) => a.id !== id));
          setOpenId(null);
          void load();
        }}
        onStudios={() => void load()}
      />
    </StudioCanvas>
  );
}

function AvatarGroup({ title, sub, list, onOpen }: { title: string; sub: string; list: AvatarView[]; onOpen: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <section className="lp-card pt-2">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-white" style={SYNE}>
          {title} <span className="text-sm font-semibold text-neutral-500">{list.length}</span>
        </h2>
        <p className="text-xs text-neutral-500">{sub}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((a) => (
          <AvatarTile key={a.id} a={a} onOpen={() => onOpen(a.id)} />
        ))}
      </div>
    </section>
  );
}

function AvatarTile({ a, onOpen }: { a: AvatarView; onOpen: () => void }) {
  const main = a.photos.find((p) => p.id === a.mainPhotoId) ?? a.photos[0];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black transition-all hover:-translate-y-0.5 hover:border-violet-300/40 hover:shadow-2xl hover:shadow-violet-500/10">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${a.name || "this avatar"}`}>
        <div className="relative aspect-[4/5] w-full bg-white/[0.03]">
          {main?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={main.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-neutral-600">No photos</span>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <span className="absolute left-2 top-2">
            <StatusChip a={a} />
          </span>
          <span className="absolute inset-x-0 bottom-0 p-3">
            <span className="block truncate text-base font-bold text-white" style={SYNE}>
              {a.name || "Unnamed"}
            </span>
            <span className="line-clamp-2 text-[11px] leading-snug text-neutral-300">{a.bestFor || a.note || `${a.photos.length} photo${a.photos.length === 1 ? "" : "s"}`}</span>
          </span>
        </div>
      </button>
      {a.voiceUrl && (
        <span className="absolute right-2 top-2">
          <VoicePlay url={a.voiceUrl} label={undefined} size="sm" />
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New avatar: drop → upload → Claude reads → 3 voices → lock in → trial video

type Step = { label: string; detail?: string };

/** The trial video: Claude writes it, then it goes to Kling (two requests, so each stays short). */
async function makeTrial(a: AvatarView, fresh: boolean, onStep: (s: Step) => void): Promise<AvatarView> {
  onStep({ label: `Claude is writing ${a.name}'s trial video…`, detail: a.intro ? `“${a.intro}”` : "An intro in their own words" });
  await call(`${API}/${a.id}/trial`, "POST", { step: "write", fresh });
  onStep({ label: "Sending it to Kling…", detail: `About ${TRIAL_CREDITS} Kling credits` });
  return (await call<{ avatar: AvatarView }>(`${API}/${a.id}/trial`, "POST", { step: "render" })).avatar;
}

const trialHref = (projectId: string) => `/dashboard/creative-studio/${encodeURIComponent(projectId)}`;

/** Where the trial video is, in plain words. */
function trialLabel(status: string): string {
  if (status === "draft") return "Not written yet";
  if (status === "scripted") return "Written, not sent to Kling yet";
  if (status === "approved" || status === "rendering") return "Kling is making it — open it and the auto-cut starts by itself when the clips land";
  if (status === "clips_ready") return "Clips are ready — open it to auto-cut";
  return "Open it to edit, add captions and download";
}

function NewAvatar({ onCreated, onDone, onOpen }: { onCreated: (a: AvatarView) => void; onDone: (a: AvatarView) => void; onOpen: (id: string) => void }) {
  const [pick, setPick] = useState<(PhotoPick & { from: string }) | null>(null);
  const [opening, setOpening] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<{ text: string; avatarId?: string } | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const previews = usePreviews(pick?.photos ?? NO_FILES);

  async function take(files: File[], from?: string) {
    if (!files.length) {
      setError({ text: "That folder is empty." });
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const p = await photosFromDrop(files);
      setPick({ ...p, from: from ?? folderName(files) ?? (files.length === 1 ? files[0].name : `${files.length} files`) });
      if (!p.photos.length) setError({ text: "No photos in there. Use a folder (or a zip, or photos) with JPG, PNG or WebP pictures." });
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : "Couldn't open that." });
    } finally {
      setOpening(false);
    }
  }

  async function create() {
    if (!pick?.photos.length) return;
    setError(null);
    let avatar: AvatarView | null = null;
    try {
      setStep({ label: "Saving the avatar…" });
      avatar = (await call<{ avatar: AvatarView }>(API, "POST", { name, note })).avatar;
      onCreated(avatar);
      const total = pick.photos.length;
      setStep({ label: `Uploading ${total} photo${total === 1 ? "" : "s"}…`, detail: `0 of ${total}` });
      const failed = await uploadAll(photoQs(avatar), pick.photos, (done) => setStep({ label: `Uploading ${total} photo${total === 1 ? "" : "s"}…`, detail: `${done} of ${total}` }));
      if (failed.length === total) throw new Error(failed[0] ?? "The photos didn't upload.");
      setStep({ label: "Claude is looking at the photos…", detail: "How they look, what firm they suit, how they should sound" });
      avatar = (await call<{ avatar: AvatarView }>(`${API}/${avatar.id}/read`, "POST")).avatar;
      onCreated(avatar);
      setStep({ label: `ElevenLabs is making ${avatar.name ? `${avatar.name}'s` : "3"} voices…`, detail: avatar.voice });
      avatar = (await call<{ avatar: AvatarView }>(`${API}/${avatar.id}/voices`, "POST", {})).avatar;
      onCreated(avatar);
      // "You give them the voice": Voice A is locked in (Rebuild switches it later), then the trial video.
      const first = avatar.options?.voices[0]?.generatedVoiceId;
      if (!first) throw new Error("ElevenLabs didn't send any voices back. Open the avatar and tap Make 3 voices.");
      setStep({ label: `Locking in ${avatar.name}'s voice and setting up Kling…`, detail: "Voice A — you can listen to all 3 and switch later (Rebuild)" });
      avatar = (await call<{ avatar: AvatarView }>(`${API}/${avatar.id}/lock`, "POST", { generatedVoiceId: first })).avatar;
      onCreated(avatar);
      avatar = await makeTrial(avatar, false, setStep);
      setPick(null);
      setName("");
      setNote("");
      onDone(avatar);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : "Something went wrong.", avatarId: avatar?.id });
    } finally {
      setStep(null);
    }
  }

  return (
    <AssistantCard accent="violet" icon={SP.sparkles} title="New avatar">
      {step ? (
        <ThinkingCard accent="violet" label={step.label} detail={step.detail} />
      ) : (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              // Read the folder entries now: the browser only hands them out during the drop.
              const { entries, files } = entriesOf(e.dataTransfer);
              const folder = entries.length === 1 && entries[0].isDirectory ? entries[0].name : undefined;
              setOpening(true);
              void filesFromEntries(entries)
                .then((inFolders) => take([...files, ...inFolders], folder))
                .catch(() => setError({ text: "Couldn't read that folder. Try Pick a folder instead." }))
                .finally(() => setOpening(false));
            }}
            className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${over ? "border-violet-400/70 bg-violet-500/10" : "border-white/15 bg-black/20"}`}
          >
            {pick?.photos.length ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {previews.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img key={i} src={u} alt="" className="h-16 w-12 rounded-lg border border-white/10 object-cover" />
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  {pick.photos.length} photo{pick.photos.length === 1 ? "" : "s"} from {pick.from}
                  {pick.photos.length === 1 && <span className="text-amber-200"> · Kling needs at least 2 (different angles) — add another if you can</span>}
                </p>
                {pick.skipped.length > 0 && (
                  <details className="mt-1 text-[11px] text-neutral-500">
                    <summary className="cursor-pointer">
                      Skipped {pick.skipped.length} file{pick.skipped.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {pick.skipped.slice(0, 20).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <button type="button" onClick={() => setPick(null)} className="mt-2 min-h-9 text-xs font-semibold text-neutral-400 hover:text-white">
                  Use different photos
                </button>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-2 py-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                  <SvgIcon d={SP.upload} size={22} />
                </span>
                <span className="text-sm font-bold text-white">{opening ? "Opening…" : "Drop the folder of photos here"}</span>
                <span className="max-w-sm text-xs text-neutral-400">
                  A zip or loose photos work too. Up to {AVATAR_MAX_PHOTOS} photos of the same person are used — include a selfie-style one: their trial video starts from it.
                </span>
                <span className="mt-1 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => folderPicker.current?.click()} disabled={opening} className="min-h-10 rounded-full bg-violet-500 px-4 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-50">
                    Pick a folder
                  </button>
                  <button type="button" onClick={() => picker.current?.click()} disabled={opening} className="min-h-10 rounded-full border border-white/15 px-4 text-xs font-semibold text-neutral-200 hover:bg-white/5 disabled:opacity-50">
                    Pick photos or a zip
                  </button>
                </span>
              </div>
            )}
            <input
              ref={folderPicker}
              type="file"
              multiple
              hidden
              {...FOLDER_INPUT}
              onChange={(e) => {
                void take(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <input
              ref={picker}
              type="file"
              accept=".zip,application/zip,image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                void take(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">Name (optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Claude suggests one" className={FIELD} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">Note for Claude (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. for estate-planning attorneys in Texas, a bit older" className={FIELD} />
            </label>
          </div>

          {error && (
            <ErrorStrip onClose={() => setError(null)}>
              {error.text}
              {error.avatarId && (
                <>
                  {" "}
                  <button type="button" onClick={() => onOpen(error.avatarId!)} className="font-bold underline">
                    Open it to finish
                  </button>
                </>
              )}
            </ErrorStrip>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => void create()} disabled={!pick?.photos.length || opening} className={`${CTA_CLASSES} disabled:opacity-50`}>
              Create avatar
            </button>
          </div>
        </div>
      )}
    </AssistantCard>
  );
}

/** A folder picker (Chrome, Safari, Edge and Firefox all read these). */
const FOLDER_INPUT = { webkitdirectory: "", directory: "" } as Record<string, string>;

/** The folder picked files came from ("Marcus" for Marcus/IMG_01.jpg), when they all share one. */
function folderName(files: File[]): string | undefined {
  const tops = new Set(files.map((f) => (f.webkitRelativePath || "").split("/")[0]).filter(Boolean));
  return tops.size === 1 ? [...tops][0] : undefined;
}

/** One stable empty list (a new [] each render would re-run the previews effect forever). */
const NO_FILES: File[] = [];

/** Object URLs for local photos (revoked when they change). */
function usePreviews(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (files.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- previews follow the picked files
      setUrls((u) => (u.length ? [] : u));
      return;
    }
    const made = files.slice(0, AVATAR_MAX_PHOTOS).map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

// ---------------------------------------------------------------------------
// One avatar: photos, Claude's read, voices, lock in, assign

function AvatarSheet({
  avatar,
  studios,
  onClose,
  onChange,
  onRetired,
  onStudios,
}: {
  avatar: AvatarView | null;
  studios: FirmStudio[];
  onClose: () => void;
  onChange: (a: AvatarView) => void;
  onRetired: (id: string) => void;
  onStudios: () => void;
}) {
  const a = avatar;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", look: "", bestFor: "", personality: "", intro: "", pronoun: "she" as "she" | "he" });
  const [voice, setVoice] = useState({ description: "", sample: "" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [firm, setFirm] = useState("");
  const adder = useRef<HTMLInputElement>(null);
  const id = a?.id ?? null;

  // The form mirrors the avatar whenever another one opens (or the server changes it).
  const sig = a ? `${a.id}|${a.name}|${a.look}|${a.bestFor}|${a.personality}|${a.intro}|${a.pronoun}|${a.voice}|${a.voiceSample}|${a.options?.voices.map((v) => v.generatedVoiceId).join(",")}` : "";
  useEffect(() => {
    if (!a) return;
    // The form mirrors the avatar being opened.
    setForm({ name: a.name, look: a.look, bestFor: a.bestFor, personality: a.personality, intro: a.intro, pronoun: a.pronoun });
    setVoice({ description: a.options?.description ?? a.voice, sample: a.options?.sample ?? a.voiceSample });
    setChosen(a.options?.voices[0]?.generatedVoiceId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` captures what matters
  }, [sig]);
  // While Manus makes photos: check every few seconds.
  const working = a?.photoTask && a.photoTask.status !== "failed" ? "photos" : null;
  useEffect(() => {
    if (!id || !working) return;
    const t = setInterval(() => {
      void call<{ avatar: AvatarView }>(`${API}/${id}/${working}`, "GET")
        .then((b) => onChange(b.avatar))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [id, working, onChange]);

  useEffect(() => {
    // Reset per avatar.
    setError(null);
    setNotice(null);
    setFirm("");
  }, [id]);

  async function run(label: string, fn: () => Promise<{ avatar?: AvatarView; note?: string } | void>) {
    setBusy(label);
    setError(null);
    try {
      const out = await fn();
      if (out?.avatar) onChange(out.avatar);
      if (out?.note) setNotice(out.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!a) return null;
  const dirty =
    form.name !== a.name || form.look !== a.look || form.bestFor !== a.bestFor || form.personality !== a.personality || form.intro !== a.intro || (!a.locked && form.pronoun !== a.pronoun);
  const formBody = { name: form.name, look: form.look, bestFor: form.bestFor, personality: form.personality, intro: form.intro, ...(!a.locked ? { pronoun: form.pronoun } : {}) };
  const flagged = new Set(a.read?.otherPerson ?? []);
  const kling = klingLine(a);
  const firmOf = (key: string) => studios.find((s) => s.key === key);

  const save = () =>
    run("Saving…", () =>
      call(`${API}/${a.id}`, "PATCH", formBody)
    );
  const setPicks = (mainPhotoId: string, klingPhotoIds: string[]) => run("Saving…", () => call(`${API}/${a.id}`, "PATCH", { mainPhotoId, klingPhotoIds }));
  const toggleKling = (photoId: string) => {
    const on = a.klingPhotoIds.includes(photoId);
    if (!on && a.klingPhotoIds.length >= KLING_EXTRA_PHOTOS) {
      setError(`Kling takes the main photo plus ${KLING_EXTRA_PHOTOS} more. Untick one first.`);
      return;
    }
    void setPicks(a.mainPhotoId ?? photoId, on ? a.klingPhotoIds.filter((x) => x !== photoId) : [...a.klingPhotoIds, photoId]);
  };
  const addPhotos = (files: File[]) =>
    run("Adding photos…", async () => {
      const p = await photosFromDrop(files, AVATAR_MAX_PHOTOS - a.photos.length);
      if (!p.photos.length) throw new Error(p.skipped[0] ?? "No photos in there.");
      const failed = await uploadAll(photoQs(a), p.photos, () => {});
      if (failed.length) setError(failed.join(" · "));
      return call(`${API}/${a.id}`, "GET");
    });
  const removePhoto = (photoId: string) =>
    run("Removing…", async () => {
      const r = await fetch(`/api/dashboard/creative-studio/references${photoQs(a)}&assetId=${encodeURIComponent(photoId)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Couldn't remove it.");
      return call(`${API}/${a.id}`, "GET");
    });

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {a.name || "Unnamed avatar"} <StatusChip a={a} />
        </span>
      }
      sub={a.locked ? kling.text : "Check what Claude saw, pick a voice, then lock it in."}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => {
              if (!confirm(`Retire ${a.name || "this avatar"}? It leaves the library${a.assigned ? ` and ${a.assigned.studioName}'s studio` : ""}; videos already made with it keep working.`)) return;
              void run("Retiring…", async () => {
                await call(`${API}/${a.id}`, "DELETE");
                onRetired(a.id);
                onStudios();
              });
            }}
          >
            Retire
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && (a.locked || !a.options) && (
              <Button size="sm" variant="secondary" onClick={() => void save()} disabled={Boolean(busy)}>
                {busy === "Saving…" ? "Saving…" : "Save changes"}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {!a.locked && (
              <button
                type="button"
                disabled={Boolean(busy) || !chosen || !form.name.trim()}
                onClick={() =>
                  void run("lock", async () => {
                    // Lock-in keeps what's typed here too.
                    if (dirty) await call(`${API}/${a.id}`, "PATCH", formBody);
                    return call(`${API}/${a.id}/lock`, "POST", { generatedVoiceId: chosen });
                  })
                }
                className={`${CTA_CLASSES} disabled:opacity-50`}
              >
                {busy === "lock" ? "Locking in · setting up Kling…" : !form.name.trim() ? "Name them to lock in" : !chosen ? "Make voices first" : `Lock in ${form.name.trim()}`}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {notice && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {notice}
          </p>
        )}
        {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

        {/* Photos */}
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Photos</h3>
            <span className="text-[11px] text-neutral-500">
              ★ main photo · <span className="text-violet-200">K</span> = also sent to Kling (up to {KLING_EXTRA_PHOTOS})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {a.photos.map((p) => {
              const main = p.id === a.mainPhotoId;
              const k = a.klingPhotoIds.includes(p.id);
              const other = flagged.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-xl border bg-black ${main ? "border-violet-300 ring-2 ring-violet-400/50" : other ? "border-amber-400/60" : k ? "border-violet-400/40" : "border-white/10"}`}
                  style={{ aspectRatio: "3 / 4" }}
                >
                  {p.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={p.url} alt="" className={`h-full w-full object-cover ${other ? "opacity-50" : ""}`} />
                  )}
                  {other && <span className="absolute inset-x-1 top-1 rounded bg-amber-500/90 px-1 py-0.5 text-center text-[9px] font-black uppercase text-black">Someone else?</span>}
                  {main && <span className="absolute left-1 top-1 rounded-md bg-violet-500 px-1.5 py-0.5 text-[10px] font-black text-white">★ Main</span>}
                  {p.id === a.trialPhotoId && !other && (
                    <span className="absolute right-1 top-1 rounded-md bg-cyan-500 px-1.5 py-0.5 text-[10px] font-black text-[#020617]" title="The trial video starts from this photo">
                      Trial
                    </span>
                  )}
                  {!a.locked && (
                    <div className="absolute inset-x-1 bottom-1 flex gap-1">
                      {!main && (
                        <button type="button" onClick={() => void setPicks(p.id, a.klingPhotoIds.filter((x) => x !== p.id))} disabled={Boolean(busy)} className="min-h-7 flex-1 rounded-md bg-black/75 text-[10px] font-bold text-white hover:bg-violet-600" aria-label="Make this the main photo">
                          ★
                        </button>
                      )}
                      {!main && (
                        <button type="button" onClick={() => toggleKling(p.id)} disabled={Boolean(busy)} className={`min-h-7 flex-1 rounded-md text-[10px] font-black ${k ? "bg-violet-500 text-white" : "bg-black/75 text-neutral-300 hover:bg-white/20"}`} aria-pressed={k} aria-label="Send this photo to Kling too">
                          K
                        </button>
                      )}
                      <button type="button" onClick={() => confirm("Remove this photo?") && void removePhoto(p.id)} disabled={Boolean(busy)} className="min-h-7 w-7 rounded-md bg-black/75 text-white/80 hover:bg-rose-600" aria-label="Remove photo">
                        ✕
                      </button>
                    </div>
                  )}
                  {a.locked && k && <span className="absolute bottom-1 right-1 rounded-md bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-black text-white">K</span>}
                </div>
              );
            })}
            {!a.locked && a.photos.length < AVATAR_MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => adder.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const { entries, files } = entriesOf(e.dataTransfer);
                  void filesFromEntries(entries).then((inFolders) => addPhotos([...files, ...inFolders]));
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 text-neutral-400 transition-colors hover:border-violet-400/50 hover:text-white"
                style={{ aspectRatio: "3 / 4" }}
              >
                <SvgIcon d={SP.upload} />
                <span className="text-[10px] font-bold">Add</span>
              </button>
            )}
          </div>
          <input
            ref={adder}
            type="file"
            accept=".zip,application/zip,image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void addPhotos(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {a.read?.notes && <p className="mt-2 text-[11px] text-neutral-400">Claude: {a.read.notes}</p>}
          {!a.locked && <MorePhotos a={a} busy={busy} usable={a.photos.length - flagged.size} onRun={run} />}
        </section>

        {/* Who they are */}
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="e.g. Marcus" className={FIELD} />
            {!a.locked && (a.read?.names.length ?? 0) > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {a.read!.names.map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, name: n })} className={`min-h-8 rounded-full border px-3 text-xs font-semibold ${form.name === n ? "border-violet-400/60 bg-violet-500/20 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
                    {n}
                  </button>
                ))}
              </span>
            )}
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Man or woman{a.read?.age ? ` · ${a.read.age}` : ""}</span>
            {a.locked ? (
              <p className="text-sm text-neutral-200">{a.pronoun === "he" ? "Man · he" : "Woman · she"}</p>
            ) : (
              <Segmented<"she" | "he">
                value={form.pronoun}
                onChange={(v) => setForm({ ...form, pronoun: v })}
                ariaLabel="Man or woman"
                options={[
                  { value: "she", label: "Woman · she" },
                  { value: "he", label: "Man · he" },
                ]}
              />
            )}
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Good fit for</span>
            <input value={form.bestFor} onChange={(e) => setForm({ ...form, bestFor: e.target.value })} maxLength={400} placeholder="The kind of firm this avatar suits" className={FIELD} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">How they look</span>
            <textarea value={form.look} onChange={(e) => setForm({ ...form, look: e.target.value })} rows={2} maxLength={1500} className={`${FIELD} resize-y`} />
            <span className="mt-1 block text-[11px] text-neutral-500">Manus works from this and the photos when it makes their frames.</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Personality</span>
            <input value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} maxLength={120} placeholder="How they come across, e.g. calm, seasoned, quietly confident" className={FIELD} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Trial video line</span>
            <textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} rows={2} maxLength={300} placeholder={`Hey, I'm ${form.name || "…"} — and …`} className={`${FIELD} resize-y`} />
            <span className="mt-1 block text-[11px] text-neutral-500">What they say to camera in their trial video. Change it, then tap Make the trial video again.</span>
          </label>
        </section>

        {/* Voice */}
        <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-200">Voice</h3>
          {a.locked ? (
            <div className="mt-3 space-y-3">
              <VoicePlay url={a.voiceUrl} label={`${a.name}'s voice`} sub={a.voiceKept ? "Locked in · kept in ElevenLabs" : "Locked in"} />
              <p className="text-xs leading-relaxed text-neutral-300">{a.voice}</p>
              {a.voiceSample && <p className="text-[11px] italic leading-relaxed text-neutral-500">&ldquo;{a.voiceSample}&rdquo;</p>}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-neutral-400">How they sound (Claude wrote this from the photos — edit it if you like)</span>
                <textarea value={voice.description} onChange={(e) => setVoice({ ...voice, description: e.target.value })} rows={3} maxLength={1000} className={`${FIELD} resize-y`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-neutral-400">What they say in the sample</span>
                <textarea value={voice.sample} onChange={(e) => setVoice({ ...voice, sample: e.target.value })} rows={3} maxLength={SAMPLE_MAX} className={`${FIELD} resize-y`} />
              </label>
              {a.options?.voices.length ? (
                <div className="space-y-2" role="radiogroup" aria-label="Pick a voice">
                  {a.options.voices.map((v, i) => (
                    <div
                      key={v.generatedVoiceId}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${chosen === v.generatedVoiceId ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-black/20"}`}
                    >
                      <VoicePlay url={v.url} label={`Voice ${"ABC"[i] ?? i + 1}`} sub={v.durationS ? `${Math.round(v.durationS)} s` : undefined} size="sm" />
                      <button
                        type="button"
                        role="radio"
                        aria-checked={chosen === v.generatedVoiceId}
                        onClick={() => setChosen(v.generatedVoiceId)}
                        className={`ml-auto min-h-9 rounded-full px-4 text-xs font-bold ${chosen === v.generatedVoiceId ? "bg-violet-500 text-white" : "border border-white/15 text-neutral-300 hover:bg-white/5"}`}
                      >
                        {chosen === v.generatedVoiceId ? "✓ This one" : "Pick"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  busy={busy === "voices"}
                  disabled={Boolean(busy) || !voice.description.trim() || !voice.sample.trim()}
                  onClick={() => void run("voices", () => call(`${API}/${a.id}/voices`, "POST", voice))}
                >
                  {busy === "voices" ? "ElevenLabs is making voices…" : a.options ? "Try 3 more" : "Make 3 voices"}
                </Button>
                {a.photos.length > 0 && (
                  <Button size="sm" variant="ghost" busy={busy === "read"} disabled={Boolean(busy)} onClick={() => void run("read", () => call(`${API}/${a.id}/read`, "POST"))}>
                    {busy === "read" ? "Claude is looking…" : a.read ? "Read the photos again" : "Have Claude read the photos"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Lock in / Kling / Rebuild */}
        {!a.locked ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="max-w-md text-xs leading-relaxed text-neutral-400">
              Locking in keeps the voice and photos fixed: every video and photo ad uses this exact face and voice.
              {a.photos.length - flagged.size < 2 && <span className="text-amber-200"> Kling needs a second photo of them (another angle) to keep the face steady.</span>}
            </p>
          </section>
        ) : (
          <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className={`text-sm font-semibold ${kling.tone}`}>{kling.text}</p>
            {a.kling.status === "needs_photo" && (
              <p className="text-xs text-neutral-400">Tap Rebuild, add a photo of {a.pronoun === "he" ? "him" : "her"} from another angle (tick K), and lock in again.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {(a.kling.status === "error" || a.kling.status === "pending") && (
                <Button size="sm" busy={busy === "kling"} disabled={Boolean(busy)} onClick={() => void run("kling", () => call(`${API}/${a.id}/kling`, "POST"))}>
                  {busy === "kling" ? "Setting up on Kling…" : "Set up on Kling"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (!confirm(`Rebuild ${a.name}? The voice and photos unlock so you can change them; lock in again when you're done.${a.videos ? ` Clips already made keep the old voice.` : ""}`)) return;
                  void run("Unlocking…", () => call(`${API}/${a.id}/lock`, "DELETE"));
                }}
              >
                Rebuild
              </Button>
            </div>
            <TrialRow a={a} busy={busy} dirty={dirty} onRun={run} onSave={() => call(`${API}/${a.id}`, "PATCH", formBody)} />
          </section>
        )}

        {/* Assign */}
        {a.locked && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Firm</h3>
            {a.assigned ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-neutral-200">
                  Belongs to <span className="font-bold text-white">{a.assigned.studioName}</span> since{" "}
                  {new Date(a.assigned.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {a.videos ? ` · in ${a.videos} video${a.videos === 1 ? "" : "s"}` : ""}. No other studio can use {a.pronoun === "he" ? "him" : "her"}.
                </p>
                <Link href={studioHref(a.assigned.studioKey)} className="min-h-9 rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">
                  Open their studio
                </Link>
                {a.videos === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (!confirm(`Take ${a.name} back from ${a.assigned!.studioName}? Nothing has been made with ${a.pronoun === "he" ? "him" : "her"} yet.`)) return;
                      void run("Undoing…", async () => {
                        const out = await call<{ avatar: AvatarView }>(`${API}/${a.id}/assign`, "DELETE");
                        onStudios();
                        return out;
                      });
                    }}
                  >
                    Undo
                  </Button>
                )}
              </div>
            ) : studios.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400">
                No client studios yet.{" "}
                <Link href="/dashboard/creative-studio" className="font-semibold text-violet-200 underline">
                  Make one for the firm
                </Link>
                , then come back to give them {a.name}.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={firm} onChange={(e) => setFirm(e.target.value)} className={`${FIELD} max-w-xs`} aria-label="Which firm">
                  <option value="">Give {a.name} to…</option>
                  {studios.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                      {s.defaultPresenterId ? " (has an avatar)" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!firm || Boolean(busy)}
                  onClick={() => {
                    const f = firmOf(firm);
                    if (!f || !confirm(`Give ${a.name} to ${f.name}? ${a.pronoun === "he" ? "He" : "She"} becomes their presenter, and no other firm can ever use ${a.pronoun === "he" ? "him" : "her"}.`)) return;
                    void run("Assigning…", async () => {
                      const out = await call<{ avatar: AvatarView }>(`${API}/${a.id}/assign`, "POST", { studioKey: firm });
                      onStudios();
                      return out;
                    });
                  }}
                >
                  Assign
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

type Run = (label: string, fn: () => Promise<{ avatar?: AvatarView; note?: string } | void>) => Promise<void>;

/** Manus makes 3 more angles of them — for a zip with too few (Kling needs the main photo plus one more). */
function MorePhotos({ a, busy, usable, onRun }: { a: AvatarView; busy: string | null; usable: number; onRun: Run }) {
  const t = a.photoTask;
  if (t && t.status !== "failed") {
    return (
      <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.06] px-3 py-2.5 text-xs text-violet-100">
        {t.status === "waiting" ? (
          <>
            Manus is waiting for an OK: “{t.waiting}”.{" "}
            {t.taskUrl && (
              <a href={t.taskUrl} target="_blank" rel="noreferrer" className="font-bold underline">
                Open it in Manus
              </a>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" /> Manus is making 3 more photos of {a.name || "them"} — usually 3–8 minutes. They show up here.
          </span>
        )}
      </div>
    );
  }
  if (a.photos.length >= AVATAR_MAX_PHOTOS || a.photos.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" variant={usable < 2 ? "primary" : "ghost"} busy={busy === "manus"} disabled={Boolean(busy)} onClick={() => void onRun("manus", () => call(`${API}/${a.id}/photos`, "POST"))}>
        ✨ Manus: make 3 more angles
      </Button>
      <span className="text-[11px] text-neutral-500">
        {t?.status === "failed" ? <span className="text-rose-300">Last try: {t.error}</span> : usable < 2 ? "Kling needs at least one more angle of them." : "From the main photo: head-and-shoulders, three-quarter, at a desk."}
      </span>
    </div>
  );
}

/**
 * The trial video: the avatar introducing itself, made as a normal video (so
 * its page has the auto-cut, captions and download). Made automatically when
 * the avatar is created; "again" makes a new one (e.g. after a new line or voice).
 */
function TrialRow({ a, busy, dirty, onRun, onSave }: { a: AvatarView; busy: string | null; dirty: boolean; onRun: Run; onSave: () => Promise<unknown> }) {
  const t = a.trial;
  const [picking, setPicking] = useState(false);
  const framePhoto = a.photos.find((p) => p.id === a.trialPhotoId);
  const flagged = new Set(a.read?.otherPerson ?? []);
  const isSelfie = Boolean(a.read?.selfie && a.read.selfie === a.trialPhotoId);
  const sent = t && t.status !== "draft" && t.status !== "scripted";
  const go = (fresh: boolean) => {
    if (!confirm(`${fresh ? "Make a new trial video" : "Make the trial video"} of ${a.name} on Kling? About ${TRIAL_CREDITS} Kling credits.`)) return;
    void onRun("trial", async () => {
      if (dirty) await onSave();
      await call(`${API}/${a.id}/trial`, "POST", { step: "write", fresh });
      return call(`${API}/${a.id}/trial`, "POST", { step: "render" });
    });
  };
  return (
    <div className="mt-2 border-t border-white/10 pt-3">
      <h4 className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">Trial video</h4>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {framePhoto?.url && (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={framePhoto.url} alt="" className="h-16 w-12 rounded-lg border border-cyan-400/50 object-cover" />
        )}
        <p className="min-w-0 flex-1 text-xs text-neutral-400">
          Starts from {isSelfie ? "their selfie-style photo" : "their main photo"}
          {isSelfie ? "" : a.read ? " (Claude found no selfie-style photo)" : ""}.{" "}
          <button type="button" onClick={() => setPicking((v) => !v)} className="font-semibold text-cyan-300 hover:text-white">
            {picking ? "Done" : "Change"}
          </button>
        </p>
      </div>
      {picking && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {a.photos
            .filter((p) => !flagged.has(p.id))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void onRun("Saving…", async () => {
                    const out = await call<{ avatar: AvatarView }>(`${API}/${a.id}`, "PATCH", { trialPhotoId: p.id });
                    setPicking(false);
                    return out;
                  })
                }
                className={`h-16 w-12 overflow-hidden rounded-lg border ${p.id === a.trialPhotoId ? "border-cyan-400 ring-2 ring-cyan-400/40" : "border-white/10 hover:border-white/40"}`}
                aria-label="Start the trial video from this photo"
              >
                {p.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
        </div>
      )}
      {t ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-300">{trialLabel(t.status)}.</p>
          <Link href={trialHref(t.projectId)} className="min-h-9 rounded-full bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400">
            Open the trial video →
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-xs text-neutral-400">
          {a.name} introducing {a.pronoun === "he" ? "himself" : "herself"} on camera — auto-cut, captions and download on its page.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={t ? "ghost" : "secondary"} busy={busy === "trial"} disabled={Boolean(busy)} onClick={() => go(Boolean(sent))}>
          {busy === "trial" ? "Making the trial video…" : !t ? "Make the trial video" : sent ? "Make the trial video again" : "Send it to Kling"}
        </Button>
        <span className="text-[11px] text-neutral-500">About {TRIAL_CREDITS} Kling credits.</span>
      </div>
    </div>
  );
}
