"use client";

import { useEffect, useRef, useState } from "react";
import type { CopyJobView } from "@/lib/creative-studio/ad-copy-jobs";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, ErrorStrip, SP, StudioCanvas, StudioTabs, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
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
        <header className="lp-card flex justify-center pb-2 pt-8 sm:pt-12">
          <StudioTabs active="adcopy" />
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tighter text-white sm:text-5xl" style={SYNE}>
              Drop it in. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">Get the copy.</span>
            </h1>
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
              <div className={`relative overflow-hidden rounded-2xl p-[2px] transition-shadow ${dragging ? "shadow-2xl shadow-violet-600/40" : ""}`}>
                {/* Animated violet border while a file is over it. */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-100%] animate-[shimmer_4s_linear_infinite] transition-opacity ${dragging ? "opacity-100" : "opacity-0"}`}
                  style={{ background: "conic-gradient(from 0deg at 50% 50%, #8B5CF6, #D946EF, #EC4899, #8B5CF6, #D946EF, #8B5CF6)" }}
                />
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
                  className={`group relative z-10 flex w-full flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed bg-[#0b1220] px-6 py-14 text-center transition-colors [&>*]:pointer-events-none ${
                    dragging ? "border-transparent bg-violet-950/60" : "border-white/15 hover:border-violet-400/50 hover:bg-violet-500/[0.04]"
                  }`}
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-100 shadow-lg shadow-violet-600/30"
                    style={{ animation: "lp-float 4s ease-in-out infinite" }}
                  >
                    <SvgIcon d={SP.upload} size={26} />
                  </span>
                  <span className="text-base font-bold text-white" style={SYNE}>
                    {dragging ? "Let go to drop it in" : "Drop a video or image here"}
                  </span>
                  <span className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-neutral-300">
                      <SvgIcon d={SP.film} size={13} /> Video · MP4, MOV
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-neutral-300">
                      <SvgIcon d={SP.image} size={13} /> Image · PNG, JPG, WebP
                    </span>
                  </span>
                  <span className="text-xs text-neutral-500 group-hover:text-neutral-300">or click to choose a file</span>
                </button>
              </div>
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
