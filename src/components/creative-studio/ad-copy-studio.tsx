"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CopyJobView } from "@/lib/creative-studio/ad-copy-jobs";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, ErrorStrip, SP, StudioCanvas, StudioTabs, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { AdCopyResults } from "@/components/creative-studio/ad-copy-results";
import { META_LIME, META_LIME_CONIC, MetaChip } from "@/components/creative-studio/meta";
import { acceptFiles, copyAllText, copyCsv, MAX_CREATIVES } from "@/components/creative-studio/ad-copy-export";

const BASE = "/api/dashboard/creative-studio/ad-copy";
const ACCEPT = ["video/mp4", "video/quicktime", "image/png", "image/jpeg", "image/webp"];
/** How many creatives are uploaded and written at once. */
const PARALLEL = 3;

const LIME_BTN = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#0a0f1c] shadow-lg shadow-lime-500/30 transition hover:brightness-110 disabled:opacity-50";

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

type Status = "ready" | "uploading" | "working" | "done" | "failed";

interface Item {
  key: string;
  file: File;
  url: string;
  kind: "video" | "image";
  status: Status;
  error?: string;
  jobId?: string;
}

const STATUS: Record<Status, { label: (kind: "video" | "image") => string; tone: "neutral" | "blue" | "green" | "red" | "amber" }> = {
  ready: { label: () => "Ready", tone: "neutral" },
  uploading: { label: () => "Uploading…", tone: "blue" },
  working: { label: (k) => (k === "video" ? "Listening & writing…" : "Looking & writing…"), tone: "amber" },
  done: { label: () => "✓ Done", tone: "green" },
  failed: { label: () => "Failed", tone: "red" },
};

type Open = { type: "job"; id: string } | { type: "group"; id: string } | null;

/**
 * Meta Ad Copy: drop one creative or up to 20 (videos and images). Each one
 * is listened to (Scribe) and watched (6 stills) or read, then Claude writes
 * 4 primary texts and 4 headlines. A batch gets one results card with a CSV
 * export; past jobs stay below to reopen.
 */
export function AdCopyStudio() {
  const [jobs, setJobs] = useState<CopyJobView[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyJob, setBusyJob] = useState<{ id: string; label: string; detail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const groupRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<{ jobs: CopyJobView[] }>(BASE, "GET")
      .then((b) => !cancelled && setJobs(b.jobs))
      .catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, []);

  function addFiles(list: File[]) {
    if (running) return;
    const { ok, dropped, wrongType } = acceptFiles(list, items.length, ACCEPT);
    const notes = [
      dropped ? `Up to ${MAX_CREATIVES} creatives at a time, so ${dropped} ${dropped === 1 ? "wasn't" : "weren't"} added.` : "",
      wrongType ? `${wrongType} file${wrongType === 1 ? " isn't" : "s aren't"} an MP4/MOV video or PNG/JPG/WebP image.` : "",
    ].filter(Boolean);
    setError(notes.length ? notes.join(" ") : null);
    if (!ok.length) return;
    setItems((cur) => [
      ...cur,
      ...ok.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
        kind: (file.type.startsWith("video/") ? "video" : "image") as "video" | "image",
        status: "ready" as Status,
      })),
    ]);
  }
  function removeItem(key: string) {
    setItems((cur) => {
      const it = cur.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.url);
      return cur.filter((x) => x.key !== key);
    });
  }
  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));

  function upsert(job: CopyJobView) {
    setJobs((list) => [job, ...(list ?? []).filter((j) => j.id !== job.id)]);
  }

  /** Upload (once) and write the copy for one creative. Returns its job id, or null if it failed. */
  async function runItem(it: Item, group: string | null, index: number): Promise<string | null> {
    try {
      let jobId = it.jobId;
      if (!jobId) {
        patch(it.key, { status: "uploading", error: undefined });
        const target = await call<{ path: string; token: string }>(BASE, "POST", { action: "sign", mime: it.file.type });
        await uploadToTarget(target, it.file, it.file.type);
        const reg = await call<{ id: string }>(BASE, "POST", {
          action: "register",
          path: target.path,
          mime: it.file.type,
          filename: it.file.name,
          note,
          ...(group ? { group, groupIndex: index } : {}),
        });
        jobId = reg.id;
        patch(it.key, { jobId });
      }
      patch(it.key, { status: "working" });
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${jobId}`, "POST", {});
      upsert(job);
      patch(it.key, { status: "done" });
      return job.id;
    } catch (err) {
      patch(it.key, { status: "failed", error: err instanceof Error ? err.message : "Writing the copy failed" });
      return null;
    }
  }

  async function writeAll(only?: Item[]) {
    const list = only ?? items.filter((x) => x.status !== "done");
    if (!list.length) return;
    setRunning(true);
    setError(null);
    // A drop of 2+ creatives is one batch (kept together in results and Recent).
    // A retry keeps the batch it started in.
    if (!items.some((x) => x.jobId) || !groupRef.current) groupRef.current = crypto.randomUUID();
    const group = items.length > 1 ? groupRef.current : null;
    const queue = list.map((it) => ({ it, index: items.indexOf(it) }));
    let failed = 0;
    let firstId: string | null = null;
    const worker = async () => {
      while (queue.length) {
        const { it, index } = queue.shift()!;
        const id = await runItem(it, group, index);
        if (!id) failed++;
        else firstId = firstId ?? id;
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    setRunning(false);
    if (failed === 0) {
      setNote("");
      setOpen(group ? { type: "group", id: group } : firstId ? { type: "job", id: firstId } : null);
      setExpanded(null);
      setItems((cur) => {
        cur.forEach((x) => URL.revokeObjectURL(x.url));
        return [];
      });
    } else {
      setError(`${failed} of ${list.length} didn't finish. Retry ${failed === 1 ? "it" : "them"} below.`);
    }
  }

  async function again(jobId: string, body: { note?: string }) {
    setError(null);
    setBusyJob({ id: jobId, label: body.note ? "Claude is changing the copy…" : "Claude is writing new variations…", detail: body.note ? `“${body.note}”` : undefined });
    try {
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${jobId}`, "POST", body);
      upsert(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Writing the copy failed");
    } finally {
      setBusyJob(null);
    }
  }
  async function undo(jobId: string) {
    try {
      const { job } = await call<{ job: CopyJobView }>(`${BASE}/${jobId}/undo`, "POST");
      upsert(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  }
  async function removeJobs(list: CopyJobView[], label: string) {
    if (!confirm(`Delete the copy for ${label}?`)) return;
    try {
      for (const j of list) await call(`${BASE}/${j.id}`, "DELETE");
      const ids = new Set(list.map((j) => j.id));
      setJobs((cur) => (cur ?? []).filter((j) => !ids.has(j.id)));
      if (open && (open.type === "job" ? ids.has(open.id) : list.some((j) => j.group === open.id))) setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // Recent: batches as one entry, single jobs as their own.
  const recent = useMemo(() => {
    const out: { key: string; type: "job" | "group"; id: string; jobs: CopyJobView[]; createdAt: string }[] = [];
    const seen = new Set<string>();
    for (const j of jobs ?? []) {
      if (j.group) {
        if (seen.has(j.group)) continue;
        seen.add(j.group);
        const members = (jobs ?? []).filter((x) => x.group === j.group).sort((a, b) => a.groupIndex - b.groupIndex);
        out.push({ key: `g-${j.group}`, type: "group", id: j.group, jobs: members, createdAt: j.createdAt });
      } else out.push({ key: j.id, type: "job", id: j.id, jobs: [j], createdAt: j.createdAt });
    }
    return out;
  }, [jobs]);

  const openJobs = useMemo(() => {
    if (!open || !jobs) return [];
    return open.type === "job" ? jobs.filter((j) => j.id === open.id) : jobs.filter((j) => j.group === open.id).sort((a, b) => a.groupIndex - b.groupIndex);
  }, [open, jobs]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(copyAllText(openJobs.map((j) => ({ filename: j.filename, copy: j.versions[j.versions.length - 1] ?? null }))));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      setError("Couldn't copy. Download the CSV instead.");
    }
  }
  function downloadCsv() {
    const csv = copyCsv(openJobs.map((j) => ({ filename: j.filename, copy: j.versions[j.versions.length - 1] ?? null })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `nexli-meta-ad-copy-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const doneCount = items.filter((x) => x.status === "done").length;
  const n = items.length;

  const results = (j: CopyJobView) => {
    const v = j.versions[j.versions.length - 1];
    if (!v) return <p className="text-sm text-neutral-400">No copy yet.</p>;
    return (
      <>
        <AdCopyResults
          copy={v}
          versions={j.versions.length}
          media={{ url: j.mediaUrl, kind: j.media }}
          busy={Boolean(busyJob)}
          onRevise={(text) => void again(j.id, { note: text })}
          onFresh={() => void again(j.id, {})}
          onUndo={() => void undo(j.id)}
          onError={setError}
        />
        {busyJob?.id === j.id && (
          <div className="mt-3">
            <ThinkingCard accent="lime" label={busyJob.label} detail={busyJob.detail} />
          </div>
        )}
        {j.media === "video" && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowTranscript((s) => !s)} className="text-[11px] font-semibold text-neutral-500 hover:text-white">
              {showTranscript ? "▾" : "▸"} What I heard (transcript)
            </button>
            {showTranscript && (
              <p className="mt-2 whitespace-pre-line rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-neutral-300">
                {j.transcript?.trim() || "No speech found. The copy is from what's on screen."}
              </p>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <header className="lp-card flex justify-center pb-2 pt-8 sm:pt-12">
          <StudioTabs active="adcopy" />
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <MetaChip>Meta Ad Copy</MetaChip>
            <h1 className="mt-4 text-3xl font-bold tracking-tighter text-white sm:text-5xl" style={SYNE}>
              Drop it in. <span className="bg-gradient-to-r from-lime-200 via-lime-300 to-lime-400 bg-clip-text text-transparent">Get the copy.</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
              One creative or up to {MAX_CREATIVES} at once, videos and images. I listen to each one and watch it, then write 4 primary texts and 4 headlines for Meta in your style.
            </p>
          </div>

          <AssistantCard
            accent="lime"
            icon={SP.upload}
            title={n ? `${n} creative${n > 1 ? "s" : ""}` : "Your creatives"}
            right={n ? <Chip tone={running ? "blue" : "neutral"}>{running ? `${doneCount} of ${n} done` : `${n} / ${MAX_CREATIVES}`}</Chip> : null}
          >
            {n > 0 && (
              <div className="mb-4 space-y-3">
                {running && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(6, (doneCount / n) * 100)}%`, background: META_LIME }} />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {items.map((it) => {
                    const st = STATUS[it.status];
                    return (
                      <div key={it.key} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black">
                        <div className="aspect-[4/5]">
                          {it.kind === "video" ? (
                            <video src={`${it.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- local preview
                            <img src={it.url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1.5 pt-6">
                          <p className="truncate text-[10px] font-semibold text-white" title={it.file.name}>
                            {it.file.name}
                          </p>
                          <p className="text-[9px] text-neutral-400" style={NUM_FONT}>
                            {it.kind === "video" ? "Video" : "Image"} · {Math.max(1, Math.round(it.file.size / 1e6))} MB
                          </p>
                        </div>
                        <span className="absolute left-1.5 top-1.5">
                          <Chip tone={st.tone}>
                            {(it.status === "uploading" || it.status === "working") && (
                              <span className="mr-1 inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent align-middle" />
                            )}
                            {st.label(it.kind)}
                          </Chip>
                        </span>
                        {!running && it.status !== "done" && (
                          <button
                            type="button"
                            onClick={() => removeItem(it.key)}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-neutral-300 opacity-0 transition group-hover:opacity-100 hover:text-white"
                            aria-label={`Remove ${it.file.name}`}
                          >
                            <SvgIcon d={SP.x} size={12} />
                          </button>
                        )}
                        {it.status === "failed" && !running && (
                          <button
                            type="button"
                            onClick={() => void writeAll([it])}
                            className="absolute inset-x-1.5 top-9 rounded-md bg-rose-500/90 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-500"
                            title={it.error}
                          >
                            ↻ Retry
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!running && n < MAX_CREATIVES && (
                    <button
                      type="button"
                      onClick={() => input.current?.click()}
                      className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 text-neutral-400 transition hover:border-lime-300/50 hover:text-lime-200"
                    >
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-[10px] font-semibold">Add more</span>
                    </button>
                  )}
                </div>
                <label className="block text-xs text-neutral-400">
                  Anything to push? <span className="text-neutral-600">(optional, for every creative)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={running}
                    placeholder="e.g. the free tax-planning audit · firms doing $750K+"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-lime-300/50 focus:outline-none"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void writeAll()} disabled={running} className={LIME_BTN} style={{ background: META_LIME }}>
                    {running ? `Writing… ${doneCount} of ${n}` : n > 1 ? `✍️ Write copy for ${n} creatives` : "✍️ Write the copy"}
                  </button>
                  {!running && (
                    <button
                      type="button"
                      onClick={() =>
                        setItems((cur) => {
                          cur.forEach((x) => URL.revokeObjectURL(x.url));
                          return [];
                        })
                      }
                      className="px-2 text-xs font-semibold text-neutral-500 hover:text-white"
                    >
                      Clear all
                    </button>
                  )}
                  {running && <span className="text-[11px] text-neutral-500">{PARALLEL} at a time · keep this page open</span>}
                </div>
              </div>
            )}

            {n === 0 && (
              <div className={`relative overflow-hidden rounded-2xl p-[2px] transition-shadow ${dragging ? "shadow-2xl shadow-lime-500/30" : ""}`}>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-100%] animate-[shimmer_4s_linear_infinite] transition-opacity ${dragging ? "opacity-100" : "opacity-0"}`}
                  style={{ background: META_LIME_CONIC }}
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
                    addFiles(Array.from(e.dataTransfer.files));
                  }}
                  className={`group relative z-10 flex w-full flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed bg-[#0b1220] px-6 py-14 text-center transition-colors [&>*]:pointer-events-none ${
                    dragging ? "border-transparent bg-lime-950/40" : "border-white/15 hover:border-lime-300/50 hover:bg-lime-400/[0.03]"
                  }`}
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/40 bg-gradient-to-br from-lime-400/25 to-emerald-500/15 text-lime-200 shadow-lg shadow-lime-500/20"
                    style={{ animation: "lp-float 4s ease-in-out infinite" }}
                  >
                    <SvgIcon d={SP.upload} size={26} />
                  </span>
                  <span className="text-base font-bold text-white" style={SYNE}>
                    {dragging ? "Let go to drop them in" : "Drop your creatives here"}
                  </span>
                  <span className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-neutral-300">
                      <SvgIcon d={SP.film} size={13} /> Video · MP4, MOV
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-neutral-300">
                      <SvgIcon d={SP.image} size={13} /> Image · PNG, JPG, WebP
                    </span>
                    <span className="inline-flex items-center rounded-full border border-lime-300/30 bg-lime-400/10 px-3 py-1 text-lime-200">Up to {MAX_CREATIVES} at once</span>
                  </span>
                  <span className="text-xs text-neutral-500 group-hover:text-neutral-300">or click to choose files</span>
                </button>
              </div>
            )}
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT.join(",")}
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </AssistantCard>

          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          {/* One creative */}
          {open?.type === "job" && openJobs[0] && (
            <AssistantCard accent="lime" icon={SP.script} title={`Copy for ${openJobs[0].filename}`} right={openJobs[0].note ? <Chip>Pushing: {openJobs[0].note}</Chip> : null}>
              {results(openJobs[0])}
            </AssistantCard>
          )}

          {/* A batch */}
          {open?.type === "group" && openJobs.length > 0 && (
            <AssistantCard
              accent="lime"
              icon={SP.script}
              title={`Copy for ${openJobs.length} creatives`}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={downloadCsv} className={`${LIME_BTN} px-3.5 py-1.5 text-xs`} style={{ background: META_LIME }}>
                    <SvgIcon d={SP.download} size={13} /> Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyAll()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                  >
                    <SvgIcon d={SP.copy} size={13} /> {copiedAll ? "✓ Copied" : "Copy all"}
                  </button>
                </div>
              }
            >
              <div className="space-y-2">
                {openJobs.map((j, i) => {
                  const v = j.versions[j.versions.length - 1];
                  const isOpen = expanded === j.id;
                  return (
                    <div key={j.id} className={`overflow-hidden rounded-xl border transition ${isOpen ? "border-lime-300/40 bg-lime-400/[0.03]" : "border-white/10 bg-white/[0.02]"}`}>
                      <button type="button" onClick={() => setExpanded(isOpen ? null : j.id)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-white/[0.03]">
                        <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
                          {j.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                            <img src={j.thumbUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-neutral-600">
                              <SvgIcon d={j.media === "video" ? SP.film : SP.image} size={16} />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-lime-300" style={NUM_FONT}>
                              {i + 1}
                            </span>
                            <span className="truncate text-xs font-semibold text-neutral-400">{j.filename}</span>
                          </span>
                          <span className="block truncate text-sm font-bold text-white">{v?.headlines[0] ?? "No copy yet"}</span>
                          <span className="block truncate text-[11px] text-neutral-500">{v?.primaryTexts[0]?.split("\n")[0]}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-neutral-500">{isOpen ? "▾" : "▸"} {v ? `${v.primaryTexts.length} + ${v.headlines.length}` : ""}</span>
                      </button>
                      {isOpen && <div className="border-t border-white/5 p-3">{results(j)}</div>}
                    </div>
                  );
                })}
              </div>
            </AssistantCard>
          )}

          {recent.length > 0 && (
            <section className="pt-6">
              <h3 className="mb-3 text-sm font-bold text-white" style={SYNE}>
                Recent
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {recent.map((r) => {
                  const first = r.jobs[0];
                  const v = first.versions[first.versions.length - 1];
                  const isOpen = open?.type === r.type && open.id === r.id;
                  const batch = r.type === "group";
                  return (
                    <div
                      key={r.key}
                      className={`group overflow-hidden rounded-2xl border bg-white/[0.03] transition hover:-translate-y-0.5 ${isOpen ? "border-lime-300/60" : "border-white/10 hover:border-lime-300/30"}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpen({ type: r.type, id: r.id });
                          setExpanded(null);
                          setShowTranscript(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="block w-full text-left"
                      >
                        <div className="relative aspect-[4/5] bg-black">
                          {batch ? (
                            <div className="grid h-full grid-cols-2 grid-rows-2 gap-px">
                              {r.jobs.slice(0, 4).map((j) =>
                                j.thumbUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                                  <img key={j.id} src={j.thumbUrl} alt="" className="h-full w-full object-cover opacity-90" />
                                ) : (
                                  <span key={j.id} className="flex items-center justify-center bg-white/5 text-neutral-600">
                                    <SvgIcon d={j.media === "video" ? SP.film : SP.image} size={18} />
                                  </span>
                                )
                              )}
                            </div>
                          ) : first.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                            <img src={first.thumbUrl} alt="" className="h-full w-full object-cover opacity-90" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-neutral-600">
                              <SvgIcon d={first.media === "video" ? SP.film : SP.image} size={26} />
                            </div>
                          )}
                          <span className="absolute left-2 top-2">
                            {batch ? (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-[#0a0f1c]" style={{ background: META_LIME }}>
                                Batch · {r.jobs.length}
                              </span>
                            ) : (
                              <Chip>{first.media === "video" ? "Video" : "Image"}</Chip>
                            )}
                          </span>
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-xs font-semibold text-white">{batch ? `${r.jobs.length} creatives` : (v?.headlines[0] ?? "No copy yet")}</p>
                          <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                            {batch ? r.jobs.map((j) => j.filename).join(", ") : first.filename} · {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="flex justify-end px-2.5 pb-2">
                        <button
                          type="button"
                          onClick={() => void removeJobs(r.jobs, batch ? `these ${r.jobs.length} creatives` : `"${first.filename}"`)}
                          className="text-[10px] font-semibold text-neutral-600 hover:text-rose-300"
                        >
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
