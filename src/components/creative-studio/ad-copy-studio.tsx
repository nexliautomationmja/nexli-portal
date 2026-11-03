"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CopyJobView } from "@/lib/creative-studio/ad-copy-jobs";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, ErrorStrip, GradientText, SP, StudioCanvas, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { AdCopyResults } from "@/components/creative-studio/ad-copy-results";

const BASE = "/api/dashboard/creative-studio/ad-copy";
const ACCEPT = ["video/mp4", "video/quicktime", "image/png", "image/jpeg", "image/webp"];

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data as T;
}

/**
 * The Ad copy tool: drop any video or image; it's listened to (Scribe) and
 * watched (6 stills), then Claude writes 4 primary texts and 4 headlines.
 * Past jobs stay below to reopen.
 */
export function AdCopyStudio() {
  const [jobs, setJobs] = useState<CopyJobView[] | null>(null);
  const [current, setCurrent] = useState<CopyJobView | null>(null);
  const [file, setFile] = useState<{ file: File; url: string; kind: "video" | "image" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<{ label: string; detail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    call<{ jobs: CopyJobView[] }>(BASE, "GET")
      .then((b) => !cancelled && setJobs(b.jobs))
      .catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      setError("Drop an MP4 or MOV video, or a PNG, JPG or WebP image.");
      return;
    }
    if (file) URL.revokeObjectURL(file.url);
    setError(null);
    setFile({ file: f, url: URL.createObjectURL(f), kind: f.type.startsWith("video/") ? "video" : "image" });
  }

  function upsert(job: CopyJobView) {
    setCurrent(job);
    setJobs((list) => [job, ...(list ?? []).filter((j) => j.id !== job.id)]);
  }

  async function writeCopy() {
    if (!file) return;
    setError(null);
    try {
      setBusy({ label: `Uploading ${file.file.name} · ${Math.max(1, Math.round(file.file.size / 1e6))} MB…` });
      const target = await call<{ path: string; token: string }>(BASE, "POST", { action: "sign", mime: file.file.type });
      await uploadToTarget(target, file.file, file.file.type);
      const { id } = await call<{ id: string }>(BASE, "POST", { action: "register", path: target.path, mime: file.file.type, filename: file.file.name, note });
      setBusy(
        file.kind === "video"
          ? { label: "Listening to it and watching it…", detail: "Transcribing what's said and looking at 6 moments from the video, then Claude writes 4 primary texts and 4 headlines. About a minute." }
          : { label: "Looking at your image…", detail: "Then Claude writes 4 primary texts and 4 headlines. Under a minute." }
      );
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${id}`, "POST", {});
      upsert(job);
      URL.revokeObjectURL(file.url);
      setFile(null);
      setNote("");
      setShowTranscript(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Writing the copy failed");
    } finally {
      setBusy(null);
    }
  }

  async function again(body: { note?: string }) {
    if (!current) return;
    setError(null);
    setBusy({ label: body.note ? "Claude is changing the copy…" : "Claude is writing new variations…", detail: body.note ? `“${body.note}”` : undefined });
    try {
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${current.id}`, "POST", body);
      upsert(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Writing the copy failed");
    } finally {
      setBusy(null);
    }
  }
  async function undo() {
    if (!current) return;
    try {
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${current.id}/undo`, "POST");
      upsert(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  }
  async function remove(job: CopyJobView) {
    if (!confirm(`Delete the copy for "${job.filename}"?`)) return;
    try {
      await call(`${BASE}/${job.id}`, "DELETE");
      setJobs((list) => (list ?? []).filter((j) => j.id !== job.id));
      if (current?.id === job.id) setCurrent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const latest = current?.versions[current.versions.length - 1];

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <header className="flex items-center gap-3 border-b border-white/5 py-4">
          <Link href="/dashboard/creative-studio" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Back to Creative Studio">
            <SvgIcon d={SP.chevronLeft} />
          </Link>
          <h1 className="text-base font-bold text-white sm:text-lg" style={SYNE}>
            Ad copy
          </h1>
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl" style={SYNE}>
              Drop it in, get the <GradientText>copy</GradientText>
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
              Any video or image. I listen to it and watch it, then write 4 primary texts and 4 headlines for Meta, in your style.
            </p>
          </div>

          <AssistantCard accent="violet" icon={SP.upload} title={file ? file.file.name : "Your video or image"}>
            {file ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,200px)_1fr]">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  {file.kind === "video" ? (
                    <video src={file.url} controls playsInline muted className="max-h-[320px] w-full object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img src={file.url} alt="" className="max-h-[320px] w-full object-contain" />
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-neutral-400">
                    Anything to push? <span className="text-neutral-600">(optional)</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. the free tax-planning audit · firms doing $750K+"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-violet-400/50 focus:outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void writeCopy()} disabled={Boolean(busy)} className={`${CTA_CLASSES} disabled:opacity-50`}>
                      ✍️ Write the copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(file.url);
                        setFile(null);
                      }}
                      disabled={Boolean(busy)}
                      className="px-2 text-xs font-semibold text-neutral-500 hover:text-white"
                    >
                      Choose another
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  choose(Array.from(e.dataTransfer.files)[0]);
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragging ? "border-violet-400 bg-violet-500/10" : "border-white/15 hover:border-violet-400/50 hover:bg-white/[0.02]"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15 text-violet-300">
                  <SvgIcon d={SP.upload} size={22} />
                </span>
                <span className="text-sm font-semibold text-white">Drop a video or image here</span>
                <span className="text-xs text-neutral-500">MP4 or MOV · PNG, JPG or WebP · or click to choose</span>
              </button>
            )}
            <input ref={input} type="file" accept={ACCEPT.join(",")} hidden onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }} />
          </AssistantCard>

          {busy && <ThinkingCard accent="violet" label={busy.label} detail={busy.detail} />}
          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          {current && latest && (
            <AssistantCard accent="violet" icon={SP.script} title={`Copy for ${current.filename}`} right={current.note ? <Chip>Pushing: {current.note}</Chip> : null}>
              <AdCopyResults
                copy={latest}
                versions={current.versions.length}
                media={{ url: current.mediaUrl, kind: current.media }}
                busy={Boolean(busy)}
                onRevise={(n) => void again({ note: n })}
                onFresh={() => void again({})}
                onUndo={() => void undo()}
                onError={setError}
              />
              {current.media === "video" && (
                <div className="mt-4">
                  <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-[11px] font-semibold text-neutral-500 hover:text-white">
                    {showTranscript ? "▾" : "▸"} What I heard (transcript)
                  </button>
                  {showTranscript && (
                    <p className="mt-2 whitespace-pre-line rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-neutral-300">
                      {current.transcript?.trim() || "No speech found. The copy is from what's on screen."}
                    </p>
                  )}
                </div>
              )}
            </AssistantCard>
          )}

          {jobs && jobs.length > 0 && (
            <section className="pt-6">
              <h3 className="mb-3 text-sm font-bold text-white" style={SYNE}>
                Recent
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {jobs.map((j) => {
                  const v = j.versions[j.versions.length - 1];
                  return (
                    <div
                      key={j.id}
                      className={`group overflow-hidden rounded-2xl border bg-white/[0.03] transition hover:-translate-y-0.5 ${current?.id === j.id ? "border-violet-400/60" : "border-white/10 hover:border-violet-400/30"}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrent(j);
                          setShowTranscript(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="block w-full text-left"
                      >
                        <div className="relative aspect-[4/5] bg-black">
                          {j.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                            <img src={j.thumbUrl} alt="" className="h-full w-full object-cover opacity-90" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-neutral-600">
                              <SvgIcon d={j.media === "video" ? SP.film : SP.image} size={26} />
                            </div>
                          )}
                          <span className="absolute left-2 top-2">
                            <Chip>{j.media === "video" ? "Video" : "Image"}</Chip>
                          </span>
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-xs font-semibold text-white">{v?.headlines[0] ?? "No copy yet"}</p>
                          <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                            {j.filename} · {new Date(j.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="flex justify-end px-2.5 pb-2">
                        <button type="button" onClick={() => void remove(j)} className="text-[10px] font-semibold text-neutral-600 hover:text-rose-300">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </StudioCanvas>
  );
}
