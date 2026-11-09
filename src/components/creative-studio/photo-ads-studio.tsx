"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PhotoAdView, PhotoBatchSummary, PhotoBatchView } from "@/lib/creative-studio/photo-ads-service";
import type { StudioView } from "@/lib/creative-studio/studios";
import { PHOTO_MAX } from "@/lib/creative-studio/photo-ads-shared";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { AssistantCard, Chip, ErrorStrip, SP, StudioCanvas, StudioTabs, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { downloadHref, inStudioQs } from "@/components/creative-studio/client";
import { StudioSwitch } from "@/components/creative-studio/home";
import { zipFiles } from "@/components/creative-studio/zip";
import { useIsTouch } from "@/lib/use-media";

const BASE = "/api/dashboard/creative-studio/photo-ads";
const WORKING = ["queued", "starting", "running", "waiting", "saving"];
const QUICK_COUNTS = [4, 8, 12, 20];
const FIELD =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[16px] text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none sm:text-sm";

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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "ad";
const fileName = (ad: PhotoAdView, size: "story" | "feed") => `${String(ad.idx + 1).padStart(2, "0")}-${slug(ad.title)}-${size}.png`;

const STATUS: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" | "amber" }> = {
  planned: { label: "Planned", tone: "neutral" },
  queued: { label: "In line", tone: "neutral" },
  starting: { label: "Starting Manus…", tone: "blue" },
  running: { label: "Manus is designing…", tone: "blue" },
  saving: { label: "Saving…", tone: "blue" },
  waiting: { label: "Manus needs you", tone: "amber" },
  done: { label: "✓ Done", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

type Edits = Record<string, Partial<Pick<PhotoAdView, "title" | "headline" | "subline" | "scene" | "look">>>;

/**
 * Photo Ads: one prompt → up to 20 concepts Claude writes (headline, Daniela's
 * scene, look); a quick review; then Manus makes each as a finished static ad
 * in Story (1080×1920) and Feed (1080×1350). Earlier batches stay below.
 */
export function PhotoAdsStudio({ studio }: { studio: StudioView }) {
  const qs = inStudioQs(studio.key);
  const client = studio.kind === "client";
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(8);
  const [planning, setPlanning] = useState(false);
  const [batch, setBatch] = useState<PhotoBatchView | null>(null);
  const [batches, setBatches] = useState<PhotoBatchSummary[] | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ ad: PhotoAdView; size: "story" | "feed" } | null>(null);
  const [fromAds, setFromAds] = useState(false);
  const polling = useRef(false);

  const loadList = useCallback(() => {
    call<{ batches: PhotoBatchSummary[] }>(`${BASE}${qs}`, "GET")
      .then((d) => setBatches(d.batches))
      .catch(() => setBatches([]));
  }, [qs]);

  const remember = (id: string | null) => {
    try {
      const u = new URL(window.location.href);
      if (id) u.searchParams.set("batch", id);
      else u.searchParams.delete("batch");
      window.history.replaceState(null, "", u.toString());
    } catch {}
  };

  const show = useCallback((b: PhotoBatchView) => {
    setBatch(b);
    setEdits({});
    setRemoved([]);
    remember(b.id);
  }, []);

  // The list, and the batch in the URL (so a reload comes back to it).
  useEffect(() => {
    loadList();
    // Sent from the Ads tab ("Make N photo ads"): the refresh brief and count, filled in once.
    const q = new URLSearchParams(window.location.search);
    const brief = q.get("brief");
    if (brief) {
      setPrompt(brief.slice(0, 4000));
      setCount(Math.max(1, Math.min(PHOTO_MAX, Number(q.get("count")) || 4)));
      setFromAds(q.get("from") === "ads");
      try {
        const u = new URL(window.location.href);
        ["brief", "count", "from", "step"].forEach((k) => u.searchParams.delete(k));
        window.history.replaceState(null, "", u.toString());
      } catch {}
    }
    const id = q.get("batch");
    if (id) {
      call<{ batch: PhotoBatchView }>(`${BASE}/${id}`, "GET")
        .then((d) => {
          setBatch(d.batch);
          setEdits({});
          setRemoved([]);
        })
        .catch(() => remember(null));
    }
  }, [loadList]);

  const working = Boolean(batch && batch.status === "started" && batch.ads.some((a) => WORKING.includes(a.status)));

  // Drive Manus while ads are in line or being made.
  useEffect(() => {
    if (!working || !batch) return;
    const id = batch.id;
    const tick = async () => {
      if (polling.current || document.visibilityState === "hidden") return;
      polling.current = true;
      try {
        const d = await call<{ batch: PhotoBatchView }>(`${BASE}/${id}/poll`, "POST");
        setBatch((cur) => (cur?.id === id ? d.batch : cur));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checking Manus failed");
      } finally {
        polling.current = false;
      }
    };
    const t = setInterval(tick, 8000);
    return () => clearInterval(t);
  }, [working, batch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function plan() {
    if (!prompt.trim()) return;
    setPlanning(true);
    setError(null);
    try {
      const d = await call<{ batch: PhotoBatchView }>(`${BASE}${qs}`, "POST", { prompt, count });
      show(d.batch);
      setPrompt("");
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }

  const editList = () => Object.entries(edits).map(([id, e]) => ({ id, ...e }));

  async function make() {
    if (!batch) return;
    setBusy("make");
    setError(null);
    try {
      const d = await call<{ batch: PhotoBatchView }>(`${BASE}/${batch.id}/start`, "POST", { ads: editList(), remove: removed });
      show(d.batch);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Starting Manus failed");
    } finally {
      setBusy(null);
    }
  }

  async function act(ad: PhotoAdView, body: Record<string, unknown>) {
    setBusy(ad.id);
    setError(null);
    try {
      const d = await call<{ batch: PhotoBatchView }>(`${BASE}/ads/${ad.id}`, "POST", body);
      setBatch(d.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  async function remove(b: { id: string }) {
    if (!window.confirm("Delete this batch and its images? Anything Manus is still making is stopped.")) return;
    setBusy("delete");
    try {
      await call(`${BASE}/${b.id}`, "DELETE");
      if (batch?.id === b.id) {
        setBatch(null);
        remember(null);
      }
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deleting failed");
    } finally {
      setBusy(null);
    }
  }

  async function open(id: string) {
    setBusy(`open:${id}`);
    try {
      const d = await call<{ batch: PhotoBatchView }>(`${BASE}/${id}`, "GET");
      show(d.batch);
      setTimeout(() => document.getElementById("photo-batch")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opening failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <header className="lp-card flex justify-center pb-2 pt-8 sm:pt-12">
          <div className="flex w-full flex-col items-center gap-4">
            <StudioSwitch studio={studio} />
            <StudioTabs active="photos" studioKey={studio.key} />
          </div>
        </header>

        <div className="space-y-5 py-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              <SvgIcon d={SP.image} size={13} /> Photo Ads · Manus
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tighter text-white sm:text-5xl" style={SYNE}>
              One prompt.{" "}
              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400 bg-clip-text text-transparent">A wall of ads to test.</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
              Up to {PHOTO_MAX} at once. Claude writes the concepts, you give them a quick look, and Manus designs each one{" "}
              {client ? "with the presenter" : "with Daniela"} — headline on the image — in a Story (9:16) and a Feed (4:5) size.
            </p>
          </div>

          <AssistantCard accent="cyan" icon={SP.sparkles} title="What should the ads be about?" right={fromAds ? <Chip tone="blue">From your Ads analysis</Chip> : null}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={planning}
              placeholder={
                client
                  ? `e.g. Ads for ${studio.name}: who they help, the problem, and the call to action.`
                  : "e.g. CPA firm owners whose referrals dry up after tax season. Daniela in a bright office. Call to action: book a strategy call."
              }
              className={FIELD}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-300">How many</span>
                <div className="flex items-center rounded-full border border-white/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    className="flex h-10 w-10 items-center justify-center text-lg text-neutral-300 hover:text-white"
                    aria-label="Fewer"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-white" style={NUM_FONT}>
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.min(PHOTO_MAX, c + 1))}
                    className="flex h-10 w-10 items-center justify-center text-lg text-neutral-300 hover:text-white"
                    aria-label="More"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {QUICK_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`min-h-9 rounded-full px-3 text-xs font-semibold ${count === n ? "bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/40" : "bg-white/5 text-neutral-400 hover:text-white"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                {count} ads × 2 sizes = {count * 2} images
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={plan} disabled={planning || !prompt.trim()} className={CTA_CLASSES}>
                <SvgIcon d={SP.sparkles} size={15} /> Plan {count} photo ad{count > 1 ? "s" : ""}
              </button>
              <span className="text-xs text-neutral-500">Nothing goes to Manus until you&apos;ve checked the plan.</span>
            </div>
          </AssistantCard>

          {planning && <ThinkingCard accent="cyan" label={`Claude is writing ${count} different ad concepts…`} detail="Angles, headlines, scenes and looks" />}
          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          {batch && (
            <div id="photo-batch" className="scroll-mt-24">
              {batch.status === "planned" ? (
                <PlanReview
                  batch={batch}
                  edits={edits}
                  setEdits={setEdits}
                  removed={removed}
                  setRemoved={setRemoved}
                  busy={busy === "make"}
                  onMake={make}
                  onDiscard={() => void remove(batch)}
                />
              ) : (
                <BatchBoard
                  batch={batch}
                  busy={busy}
                  client={client}
                  onAct={act}
                  onZoom={(ad, size) => setZoom({ ad, size })}
                  onDelete={() => void remove(batch)}
                  onClose={() => {
                    setBatch(null);
                    remember(null);
                  }}
                />
              )}
            </div>
          )}

          {batches && batches.filter((b) => b.id !== batch?.id).length > 0 && (
            <AssistantCard accent="blue" icon={SP.image} title="Earlier photo ads">
              <div className="divide-y divide-white/5">
                {batches
                  .filter((b) => b.id !== batch?.id)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => void open(b.id)}
                      disabled={busy === `open:${b.id}`}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.03]"
                    >
                      <div className="flex shrink-0 -space-x-3">
                        {b.thumbs.length ? (
                          b.thumbs.slice(0, 3).map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                            <img key={i} src={u} alt="" className="h-12 w-10 rounded-md border border-[#020617] object-cover" />
                          ))
                        ) : (
                          <span className="flex h-12 w-10 items-center justify-center rounded-md bg-white/5 text-neutral-500">
                            <SvgIcon d={SP.image} size={14} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{b.prompt}</p>
                        <p className="text-[11px] text-neutral-500" style={NUM_FONT}>
                          {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                          {b.status === "planned" ? `${b.total} planned` : `${b.done}/${b.total} done`}
                          {b.working ? ` · ${b.working} in progress` : ""}
                          {b.failed ? ` · ${b.failed} failed` : ""}
                        </p>
                      </div>
                      <SvgIcon d={SP.arrowUp} size={14} />
                    </button>
                  ))}
              </div>
            </AssistantCard>
          )}
        </div>
      </div>
      {zoom && <Zoom ad={zoom.ad} size={zoom.size} onClose={() => setZoom(null)} onSize={(size) => setZoom({ ...zoom, size })} />}
    </StudioCanvas>
  );
}

/** The plan Claude wrote: change any headline, line, scene or look, drop any, then Make. */
function PlanReview({
  batch,
  edits,
  setEdits,
  removed,
  setRemoved,
  busy,
  onMake,
  onDiscard,
}: {
  batch: PhotoBatchView;
  edits: Edits;
  setEdits: React.Dispatch<React.SetStateAction<Edits>>;
  removed: string[];
  setRemoved: React.Dispatch<React.SetStateAction<string[]>>;
  busy: boolean;
  onMake: () => void;
  onDiscard: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const kept = batch.ads.filter((a) => !removed.includes(a.id));
  const value = (ad: PhotoAdView, f: keyof Edits[string]) => edits[ad.id]?.[f] ?? ad[f];
  const set = (ad: PhotoAdView, f: keyof Edits[string], v: string) => setEdits((e) => ({ ...e, [ad.id]: { ...e[ad.id], [f]: v } }));

  return (
    <AssistantCard
      accent="violet"
      icon={SP.script}
      title={`${batch.ads.length} ad concept${batch.ads.length > 1 ? "s" : ""} to check`}
      right={<Chip tone="amber">Review</Chip>}
    >
      <p className="mb-1 text-sm text-neutral-300">&ldquo;{batch.prompt}&rdquo;</p>
      {batch.notes && <p className="mb-3 text-xs text-neutral-500">{batch.notes}</p>}
      <div className="space-y-2">
        {batch.ads.map((ad) => {
          const gone = removed.includes(ad.id);
          const expanded = openId === ad.id;
          return (
            <div key={ad.id} className={`rounded-xl border p-3 ${gone ? "border-white/5 opacity-40" : "border-white/10 bg-black/20"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white" style={NUM_FONT}>
                  {ad.idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-400">{value(ad, "title")}</p>
                    <button
                      type="button"
                      onClick={() => setRemoved((r) => (gone ? r.filter((x) => x !== ad.id) : [...r, ad.id]))}
                      className="min-h-8 shrink-0 px-1 text-xs font-semibold text-neutral-500 hover:text-white"
                    >
                      {gone ? "Bring back" : "Remove"}
                    </button>
                  </div>
                  {!gone && (
                    <>
                      <input
                        value={value(ad, "headline")}
                        onChange={(e) => set(ad, "headline", e.target.value)}
                        maxLength={90}
                        aria-label="Headline on the image"
                        className={`${FIELD} font-bold`}
                      />
                      <input
                        value={value(ad, "subline")}
                        onChange={(e) => set(ad, "subline", e.target.value)}
                        maxLength={140}
                        placeholder="Small line under it (optional)"
                        aria-label="Small line"
                        className={FIELD}
                      />
                      {ad.angle && <p className="text-xs text-neutral-500">{ad.angle}</p>}
                      <button type="button" onClick={() => setOpenId(expanded ? null : ad.id)} className="min-h-8 text-xs font-semibold text-cyan-300 hover:underline">
                        {expanded ? "Hide the scene & look" : "Scene & look"}
                      </button>
                      {expanded && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-semibold text-neutral-400">
                            The photo
                            <textarea value={value(ad, "scene")} onChange={(e) => set(ad, "scene", e.target.value)} rows={3} className={`${FIELD} mt-1`} />
                          </label>
                          <label className="block text-[11px] font-semibold text-neutral-400">
                            The look
                            <input value={value(ad, "look")} onChange={(e) => set(ad, "look", e.target.value)} className={`${FIELD} mt-1`} />
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onMake} disabled={busy || kept.length === 0} className={CTA_CLASSES}>
          <SvgIcon d={SP.wand} size={15} /> {busy ? "Starting Manus…" : `Make ${kept.length} ad${kept.length === 1 ? "" : "s"} with Manus`}
        </button>
        <button type="button" onClick={onDiscard} className="min-h-10 px-2 text-xs font-semibold text-neutral-400 hover:text-white">
          Discard
        </button>
        <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
          {kept.length * 2} images · Manus makes a few at a time
        </span>
      </div>
    </AssistantCard>
  );
}

/** Save one image: a download on a computer, the share sheet ("Save Image") on a phone. */
function SaveImage({ url, name, className, children }: { url: string; name: string; className?: string; children: React.ReactNode }) {
  const touch = useIsTouch();
  const href = downloadHref(url, name);
  if (!touch) {
    return (
      <a href={href} download className={className}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], name, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
          else window.location.href = href;
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) window.location.href = href;
        }
      }}
    >
      {children}
    </button>
  );
}

function BatchBoard({
  batch,
  busy,
  client,
  onAct,
  onZoom,
  onDelete,
  onClose,
}: {
  batch: PhotoBatchView;
  busy: string | null;
  client: boolean;
  onAct: (ad: PhotoAdView, body: Record<string, unknown>) => Promise<void>;
  onZoom: (ad: PhotoAdView, size: "story" | "feed") => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const touch = useIsTouch();
  const [saving, setSaving] = useState<string | null>(null);
  const total = batch.ads.length;
  const done = batch.ads.filter((a) => a.status === "done").length;
  const failed = batch.ads.filter((a) => a.status === "failed").length;
  const needsYou = batch.ads.filter((a) => a.status === "waiting").length;
  const files = batch.ads.flatMap((a) =>
    a.status === "done"
      ? ([
          a.storyUrl ? { url: a.storyUrl, name: fileName(a, "story") } : null,
          a.feedUrl ? { url: a.feedUrl, name: fileName(a, "feed") } : null,
        ].filter(Boolean) as { url: string; name: string }[])
      : []
  );

  async function saveAll() {
    setSaving("Getting the images…");
    try {
      const got: { name: string; data: Uint8Array }[] = [];
      for (const f of files) {
        const r = await fetch(f.url);
        if (!r.ok) throw new Error(`Couldn't get ${f.name}`);
        got.push({ name: f.name, data: new Uint8Array(await r.arrayBuffer()) });
        setSaving(`Getting the images… ${got.length}/${files.length}`);
      }
      // Phones: straight into Photos through the share sheet when it takes several files.
      if (touch) {
        const asFiles = got.map((g) => new File([g.data as BlobPart], g.name, { type: "image/png" }));
        if (navigator.canShare?.({ files: asFiles })) {
          await navigator.share({ files: asFiles });
          return;
        }
      }
      const blob = zipFiles(got);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `photo-ads-${slug(batch.prompt).slice(0, 30)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) window.alert(err instanceof Error ? err.message : "Saving failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <AssistantCard
      accent="cyan"
      icon={SP.image}
      title={`${total} photo ad${total > 1 ? "s" : ""}`}
      right={
        <div className="flex items-center gap-1.5">
          {needsYou > 0 && <Chip tone="amber">{needsYou} need you</Chip>}
          {failed > 0 && <Chip tone="red">{failed} failed</Chip>}
          <Chip tone={done === total ? "green" : "blue"}>
            {done}/{total} done
          </Chip>
        </div>
      }
    >
      <p className="text-sm text-neutral-300">&ldquo;{batch.prompt}&rdquo;</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500" style={{ width: `${Math.max(4, (done / Math.max(1, total)) * 100)}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {files.length > 0 && (
          <button type="button" onClick={() => void saveAll()} disabled={Boolean(saving)} className={CTA_CLASSES}>
            <SvgIcon d={SP.download} size={15} /> {saving ?? (touch ? `Save all ${files.length} images` : `Download all ${files.length} (zip)`)}
          </button>
        )}
        <button type="button" onClick={onClose} className="min-h-10 px-2 text-xs font-semibold text-neutral-400 hover:text-white">
          Close
        </button>
        <button type="button" onClick={onDelete} className="min-h-10 px-2 text-xs font-semibold text-neutral-500 hover:text-rose-300">
          Delete batch
        </button>
      </div>
      {done < total && (
        <p className="mt-2 text-[11px] text-neutral-500">Manus makes a few at a time; each takes a few minutes. Keep this page open — the rest start as soon as there&apos;s room.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {batch.ads.map((ad) => (
          <AdCard key={ad.id} ad={ad} busy={busy === ad.id} client={client} onAct={onAct} onZoom={onZoom} />
        ))}
      </div>
    </AssistantCard>
  );
}

function AdCard({
  ad,
  busy,
  client,
  onAct,
  onZoom,
}: {
  ad: PhotoAdView;
  busy: boolean;
  client: boolean;
  onAct: (ad: PhotoAdView, body: Record<string, unknown>) => Promise<void>;
  onZoom: (ad: PhotoAdView, size: "story" | "feed") => void;
}) {
  const [redo, setRedo] = useState(false);
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState("");
  const st = STATUS[ad.status] ?? STATUS.queued;
  const working = WORKING.includes(ad.status);
  const hasImages = Boolean(ad.storyUrl || ad.feedUrl);

  const slot = (size: "story" | "feed") => {
    const url = size === "story" ? ad.storyUrl : ad.feedUrl;
    return (
      <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-black ${size === "story" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
        {url ? (
          <button type="button" onClick={() => onZoom(ad, size)} className="block h-full w-full" aria-label={`Open the ${size} version`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={url} alt={`${ad.headline} — ${size}`} className={`h-full w-full object-cover ${working ? "opacity-40" : ""}`} />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            {working ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/60 border-t-transparent" /> : <SvgIcon d={SP.image} size={18} />}
          </div>
        )}
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-neutral-300">
          {size === "story" ? "Story 9:16" : "Feed 4:5"}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-black/20 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-neutral-500" style={NUM_FONT}>
          #{ad.idx + 1}
        </span>
        <Chip tone={st.tone}>
          {working && ad.status !== "queued" && ad.status !== "waiting" && (
            <span className="mr-1 inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent align-middle" />
          )}
          {hasImages && working ? "Redoing…" : st.label}
        </Chip>
      </div>
      <div className="grid grid-cols-[9fr_12fr] items-end gap-2">
        {slot("story")}
        {slot("feed")}
      </div>
      <p className="mt-2 text-sm font-bold leading-snug text-white">{ad.headline}</p>
      {ad.subline && <p className="text-xs text-neutral-400">{ad.subline}</p>}
      {ad.status === "running" && ad.activity?.now && <p className="mt-1 truncate text-[11px] text-cyan-300/80">{ad.activity.now}</p>}
      {ad.error && <p className={`mt-1 text-[11px] ${ad.status === "failed" ? "text-rose-300" : "text-amber-300"}`}>{ad.error}</p>}

      {ad.status === "waiting" && ad.waiting && (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-100">
          <p className="max-h-24 overflow-y-auto whitespace-pre-wrap">{ad.waiting.prompt}</p>
          {ad.waiting.kind === "confirm" ? (
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void onAct(ad, { action: "allow" })} className="min-h-9 rounded-full bg-amber-300 px-3 font-bold text-black">
                Allow
              </button>
              <button type="button" disabled={busy} onClick={() => void onAct(ad, { action: "stop" })} className="min-h-9 px-2 font-semibold text-amber-200">
                Stop
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer Manus" className={`${FIELD} min-w-0 flex-1`} />
              <button
                type="button"
                disabled={busy || !answer.trim()}
                onClick={() => void onAct(ad, { action: "reply", text: answer }).then(() => setAnswer(""))}
                className="min-h-9 shrink-0 rounded-full bg-amber-300 px-3 font-bold text-black disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
        {ad.storyUrl && (
          <SaveImage url={ad.storyUrl} name={fileName(ad, "story")} className="min-h-9 font-semibold text-cyan-300 hover:underline">
            Story ↓
          </SaveImage>
        )}
        {ad.feedUrl && (
          <SaveImage url={ad.feedUrl} name={fileName(ad, "feed")} className="min-h-9 font-semibold text-cyan-300 hover:underline">
            Feed ↓
          </SaveImage>
        )}
        {(ad.status === "done" || ad.status === "failed") && (
          <button type="button" onClick={() => setRedo((r) => !r)} className="min-h-9 font-semibold text-neutral-400 hover:text-white">
            ↻ Redo
          </button>
        )}
        {working && ad.status !== "waiting" && (
          <button type="button" disabled={busy} onClick={() => void onAct(ad, { action: "stop" })} className="min-h-9 font-semibold text-neutral-500 hover:text-rose-300">
            Stop
          </button>
        )}
        {ad.taskUrl && (
          <a href={ad.taskUrl} target="_blank" rel="noreferrer" className="min-h-9 py-2 text-neutral-500 hover:text-white">
            Open in Manus
          </a>
        )}
      </div>
      {redo && (
        <div className="mt-2 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={client ? "What should change? (optional)" : "What should change? e.g. bigger headline, Daniela smiling"}
            className={FIELD}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onAct(ad, { action: "redo", note }).then(() => {
                setRedo(false);
                setNote("");
              })
            }
            className="min-h-9 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"
          >
            {busy ? "Sending…" : "Redo this ad"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Full-size look at one ad, switching between its Story and Feed versions. */
function Zoom({ ad, size, onClose, onSize }: { ad: PhotoAdView; size: "story" | "feed"; onClose: () => void; onSize: (s: "story" | "feed") => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const url = size === "story" ? ad.storyUrl : ad.feedUrl;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex gap-1 rounded-full bg-white/10 p-1" onClick={(e) => e.stopPropagation()}>
        {(["story", "feed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={!(s === "story" ? ad.storyUrl : ad.feedUrl)}
            onClick={() => onSize(s)}
            className={`min-h-9 rounded-full px-4 text-xs font-bold disabled:opacity-30 ${s === size ? "bg-white text-black" : "text-white"}`}
          >
            {s === "story" ? "Story 9:16" : "Feed 4:5"}
          </button>
        ))}
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img src={url} alt={ad.headline} className="max-h-[80dvh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      )}
      <button type="button" onClick={onClose} className="min-h-10 px-4 text-sm font-semibold text-neutral-300 hover:text-white">
        Close
      </button>
    </div>,
    document.body
  );
}
