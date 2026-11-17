"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { money } from "@/lib/ads/format";
import { BAND, OUTCOME, type Band, type GraderState, type TrackRecord } from "@/lib/ads/grader-shared";
import type { DeckItem } from "@/lib/ads/ideas-shared";
import { Glass, Ico, Meter, Skeleton } from "@/components/ads/parts";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { BandPill, GradeCard } from "@/components/ads/grade-card";
import { VIZ } from "@/components/ads/viz";

/**
 * "Before you spend": drop a creative (or pick a finished one from On deck)
 * and get it scored out of 100 against your own videos' results and the
 * long-running ads in your niche — with the evidence, the fixes, and how
 * often the grader has been right on your past videos.
 */

const UPLOAD = <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />;
const ACCEPT = "video/mp4,video/quicktime,image/png,image/jpeg,image/webp";
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function AdGrader({
  studioKey,
  deck,
  videoAds,
  onJumpAd,
}: {
  studioKey: string;
  deck: DeckItem[];
  videoAds: { id: string; name: string }[];
  onJumpAd: (id: string) => void;
}) {
  const [state, setState] = useState<GraderState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loops = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/ads/grader", { cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.state) setState(d.state as GraderState);
      else if (!r.ok) setError(d?.error ?? "Couldn't load the grader.");
    } catch {
      setError("Couldn't reach the server for the grader.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  /** Keep calling `step` while the page is open and there's work left (the server stops each call in time). */
  const drive = useCallback(
    async (key: string, step: () => Promise<{ done: boolean; error?: string | null }>) => {
      if (loops.current.has(key)) return;
      loops.current.add(key);
      try {
        for (let i = 0; i < 40; i++) {
          if (document.visibilityState === "hidden") await new Promise((r) => setTimeout(r, 5000));
          const out = await step().catch(() => ({ done: false, error: "Connection dropped — retrying…" }));
          await load();
          if (out.done) break;
          if (out.error) await new Promise((r) => setTimeout(r, 4000));
        }
      } finally {
        loops.current.delete(key);
      }
    },
    [load]
  );

  const runGrade = useCallback(
    (id: string) =>
      drive(`grade-${id}`, async () => {
        const r = await post(`/api/dashboard/ads/grader/${id}`, { action: "run" });
        const d = await r.json().catch(() => null);
        return { done: !r.ok || d?.status === "done" || d?.status === "failed", error: r.ok ? null : (d?.error ?? null) };
      }),
    [drive]
  );
  const runLearn = useCallback(
    (first: boolean) =>
      drive("learn", async () => {
        const r = await post("/api/dashboard/ads/grader/learn", { action: first ? "start" : "step" });
        first = false;
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          setError(d?.error ?? "Couldn't learn the account right now.");
          return { done: true };
        }
        return { done: (d?.left ?? 0) === 0 };
      }),
    [drive]
  );
  const runBacktest = useCallback(
    (first: boolean) =>
      drive("backtest", async () => {
        const r = await post("/api/dashboard/ads/grader/learn", { action: first ? "backtest" : "backtest_step" });
        first = false;
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          setError(d?.error ?? "Couldn't check the grader right now.");
          return { done: true };
        }
        return { done: (d?.left ?? 0) === 0 };
      }),
    [drive]
  );

  // Pick up work that's already in flight (a grade or the learning started on another visit).
  useEffect(() => {
    if (!state) return;
    for (const g of state.grades) if (g.status !== "done" && g.status !== "failed" && Date.now() - new Date(g.createdAt).getTime() < 86_400_000) void runGrade(g.id);
    if (state.learn.status === "running") void runLearn(false);
    else if (state.backtest?.status === "running") void runBacktest(false);
  }, [state === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(file: File) {
    setError(null);
    const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!ACCEPT.split(",").includes(mime)) return setError("Drop an MP4 or MOV video (or a PNG, JPG or WebP image).");
    if (file.size > 200 * 1024 * 1024) return setError("That file is over 200 MB — export it at 1080p and try again.");
    setBusy(`Uploading ${file.name}…`);
    try {
      const sign = await post("/api/dashboard/ads/grader", { action: "sign", mime });
      const target = await sign.json().catch(() => null);
      if (!sign.ok || !target?.token) throw new Error(target?.error ?? "Couldn't start the upload.");
      await uploadToTarget(target, file, mime);
      const reg = await post("/api/dashboard/ads/grader", { action: "register", path: target.path, mime, title: file.name });
      const d = await reg.json().catch(() => null);
      if (!reg.ok || !d?.id) throw new Error(d?.error ?? "Couldn't register the upload.");
      await load();
      void runGrade(d.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function gradeRender(item: DeckItem) {
    setError(null);
    setBusy(`Starting “${item.title}”…`);
    try {
      const r = await post("/api/dashboard/ads/grader", { action: "render", projectId: item.projectId });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error(d?.error ?? "Couldn't start that one.");
      await load();
      void runGrade(d.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start that one.");
    } finally {
      setBusy(null);
    }
  }

  if (!state) return error ? <Glass className="p-4 text-sm text-neutral-300">{error}</Glass> : <Skeleton className="h-56" />;

  const ready = deck.filter((d) => d.stage === "ready");
  const graded = new Set(state.grades.map((g) => g.title));
  const atCap = state.today >= state.dailyCap;

  return (
    <div className="space-y-4">
      <LearnStrip state={state} onLearn={() => void runLearn(true)} onBacktest={() => void runBacktest(true)} />

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-100">
          {error}{" "}
          <button type="button" onClick={() => setError(null)} className="ml-1 font-semibold underline">
            OK
          </button>
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-cyan-300 bg-cyan-500/[0.08]" : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"} ${busy || atCap ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} disabled={Boolean(busy) || atCap} />
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
            <Ico d={UPLOAD} size={18} />
          </span>
          <span className="text-sm font-bold text-white">{busy ?? (atCap ? "Daily limit reached" : "Drop a video to grade")}</span>
          <span className="text-[11px] text-neutral-400">{atCap ? `${state.dailyCap} grades in 24 hours — more tomorrow.` : "MP4 or MOV up to 200 MB · about a minute · or tap to choose"}</span>
        </label>
        <Glass className="p-4">
          <p className="text-sm font-bold text-white">Or grade one from On deck</p>
          {ready.length ? (
            <ul className="mt-2 space-y-1.5">
              {ready.slice(0, 5).map((d) => (
                <li key={d.projectId} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{d.title}</span>
                  <button type="button" disabled={Boolean(busy) || atCap} onClick={() => void gradeRender(d)} className="min-h-9 shrink-0 rounded-full bg-white/10 px-3 text-[11px] font-bold text-white hover:bg-white/15 disabled:opacity-50">
                    {graded.has(d.title) ? "Grade again" : "Grade it"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">Finished videos from “Create new creatives” show up here.</p>
          )}
        </Glass>
      </div>

      {state.grades.length > 0 && (
        <div className="space-y-3">
          {state.grades.map((g, i) => (
            <GradeCard
              key={g.id}
              g={g}
              studioKey={studioKey}
              videoAds={videoAds}
              defaultOpen={i === 0}
              onJumpAd={onJumpAd}
              onLink={(id, adIds) => void post(`/api/dashboard/ads/grader/${id}`, { action: "link", adIds }).then(load)}
              onRetry={(id) => void post(`/api/dashboard/ads/grader/${id}`, { action: "retry" }).then(load).then(() => runGrade(id))}
              onDelete={(id) => {
                if (window.confirm("Remove this grade?")) void fetch(`/api/dashboard/ads/grader/${id}`, { method: "DELETE" }).then(load);
              }}
            />
          ))}
        </div>
      )}

      <TrackRecordPanel state={state} onBacktest={() => void runBacktest(true)} />
    </div>
  );
}

function LearnStrip({ state, onLearn, onBacktest }: { state: GraderState; onLearn: () => void; onBacktest: () => void }) {
  const l = state.learn;
  const bt = state.backtest;
  if (l.status === "never") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] px-4 py-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-cyan-50">
          <span className="font-bold">First, let it learn your account.</span> It watches up to 24 of your video ads that spent in the last 90 days — the first 3 seconds closely, every word — and lines them up with what each one did for leads and booked calls. Then it grades
          them blind to show you how often it&apos;s right.
        </p>
        <button type="button" onClick={onLearn} className="min-h-10 rounded-full bg-cyan-500 px-4 text-xs font-bold text-slate-950 hover:bg-cyan-400">
          Learn my account (~5 min, about $2)
        </button>
      </div>
    );
  }
  if (l.status === "running") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-white">
            Learning your account — watched {l.done} of {l.total} videos
          </span>
          <span className="text-neutral-400">keeps going if you leave</span>
        </div>
        <div className="mt-2">
          <Meter value={l.total ? l.done / l.total : 0} label="Videos watched" />
        </div>
        {l.failed > 0 && <p className="mt-1 text-[11px] text-neutral-500">{l.failed} couldn&apos;t be opened from Meta (left out).</p>}
      </div>
    );
  }
  const r = bt?.record;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs">
      <span className="font-bold text-white">Knows {l.judged} of your videos</span>
      {bt?.status === "running" ? (
        <span className="flex items-center gap-2 text-cyan-100">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
          Grading your past videos blind — {bt.done} of {bt.total}
        </span>
      ) : r ? (
        <a href="#grader-record" className="text-neutral-300 hover:text-white">
          Blind check: <span className="font-semibold text-white">{r.verdict === "useful" ? "it tells winners from flops" : r.verdict === "mixed" ? "leans right, not cleanly" : r.verdict === "too_few" ? "too few videos to prove it" : "not proven yet"}</span> →
        </a>
      ) : (
        <button type="button" onClick={onBacktest} className="font-semibold text-cyan-300 hover:underline">
          Check it on your past videos →
        </button>
      )}
    </div>
  );
}

const pctN = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

function RecordTable({ r }: { r: TrackRecord }) {
  return (
    <div className="cs-scroll -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[440px] text-left text-xs" style={NUM_FONT}>
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-1.5 pr-2 font-bold">It said</th>
            <th className="py-1.5 pr-2 font-bold">Videos</th>
            <th className="py-1.5 pr-2 font-bold">Produced</th>
            <th className="py-1.5 pr-2 font-bold">Flopped</th>
            <th className="py-1.5 font-bold">Spent</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.band} className="border-t border-white/5 text-neutral-200">
              <td className="py-1.5 pr-2">
                <BandPill band={row.band as Band} small />
              </td>
              <td className="py-1.5 pr-2">{row.n}</td>
              <td className="py-1.5 pr-2">{row.n ? `${row.produced} (${pctN(row.produced, row.n)})` : "—"}</td>
              <td className="py-1.5 pr-2">{row.n ? `${row.dud} (${pctN(row.dud, row.n)})` : "—"}</td>
              <td className="py-1.5">{money(row.spendCents)}</td>
            </tr>
          ))}
          <tr className="border-t border-white/10 text-neutral-400">
            <td className="py-1.5 pr-2">All of them</td>
            <td className="py-1.5 pr-2">{r.n}</td>
            <td className="py-1.5 pr-2">{Math.round(r.base.produced * 100)}%</td>
            <td className="py-1.5 pr-2">{Math.round(r.base.dud * 100)}%</td>
            <td className="py-1.5" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TrackRecordPanel({ state, onBacktest }: { state: GraderState; onBacktest: () => void }) {
  const [open, setOpen] = useState(false);
  const bt = state.backtest;
  const r = bt?.record ?? null;
  if (!r && !state.live) return null;
  return (
    <Glass id="grader-record" className="scroll-mt-28 p-4 md:scroll-mt-20">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="text-sm font-bold text-white">How often is it right?</span>
        <span className="text-xs font-semibold text-cyan-300">{open ? "Hide" : "Show"}</span>
      </button>
      {r && <p className="mt-1 text-xs leading-relaxed text-neutral-300">{r.verdictText}</p>}
      {open && (
        <div className="mt-3 space-y-4">
          {r && (
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Your past videos, graded blind{bt?.finishedAt ? ` · ${new Date(bt.finishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>
              <RecordTable r={r} />
              <p className="mt-2 text-[11px] text-neutral-400">
                {r.savedCents > 0 ? `It would have saved ${money(r.savedCents)} spent on videos it said not to run that never produced. ` : ""}
                {r.missed.length ? `It would have missed: ${r.missed.map((m) => `“${m.name}” (${OUTCOME[m.label].label.toLowerCase()}, scored ${m.score})`).join(", ")}.` : "It didn't wave off anything that went on to produce."}
                {r.rho !== null ? ` Rank match between its scores and the results: ${r.rho} (1 = perfect, 0 = none).` : ""}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Each video was graded with its own look-alikes left out and no names or results shown. Produced = booked a call or brought leads at your target. The niche research is newer than some of these videos, so it&apos;s a slightly kind test.
              </p>
              <ul className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2" style={NUM_FONT}>
                {r.items.map((it) => (
                  <li key={it.name} className="flex items-center gap-2 truncate text-neutral-300">
                    <span className="w-7 shrink-0 text-right font-bold" style={{ color: it.band === "run" ? VIZ.status.good : it.band === "fix" ? VIZ.status.warning : VIZ.status.critical }}>
                      {it.score}
                    </span>
                    <span className="truncate">{it.name}</span>
                    <span className="shrink-0 text-neutral-500">· {OUTCOME[it.label].label.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
              {bt && bt.newSince >= 3 && bt.status !== "running" && (
                <button type="button" onClick={onBacktest} className="mt-2 min-h-9 text-xs font-semibold text-cyan-300 hover:underline">
                  {bt.newSince} more videos since — check it again (about $5)
                </button>
              )}
            </div>
          )}
          {state.live && (
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Graded here, then run in Meta</p>
              <RecordTable r={state.live} />
            </div>
          )}
          <p className="text-[11px] text-neutral-500">{Object.values(BAND).map((b) => `${b.label}: ${b.blurb}`).join(" ")} Run it = 70+, Fix first = 50–69, Don&apos;t spend = under 50.</p>
        </div>
      )}
    </Glass>
  );
}
