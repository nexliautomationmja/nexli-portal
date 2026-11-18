"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { AssistantCard, Chip, ErrorStrip, HOOK_ICON, SP, StudioCanvas, SvgIcon, ThinkingCard } from "@/components/creative-studio/canvas";
import { StudioSwitch } from "@/components/creative-studio/home";
import { studioHref } from "@/components/creative-studio/client";
import { HOOK_KINDS, type HookIdeaView, type HookTestView } from "@/lib/creative-studio/hook-shared";
import type { StudioView } from "@/lib/creative-studio/studios";

/**
 * One hook test: the video and the hook it has now, the hooks Claude wrote,
 * and — for a video made here — each hook's clip from Kling. Picking a clip
 * makes a new video (that clip, then the original's own clips), which opens
 * on its normal page for the auto-cut and the Remotion edit.
 */

type StudioProp = Pick<StudioView, "key" | "kind" | "name">;

const RANK_LABEL: Record<number, string> = { 1: "Best bet", 2: "Runner-up", 3: "Wild card" };

const fmt = (n: number) => n.toLocaleString("en-US");

export function HookTest({ studio, testId }: { studio: StudioProp; testId: string }) {
  const router = useRouter();
  const url = `/api/dashboard/creative-studio/hook-tests/${testId}`;
  const [test, setTest] = useState<HookTestView | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [rewrite, setRewrite] = useState<{ id: string; note: string } | null>(null);
  const [needsKling, setNeedsKling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef(false);
  // The reading stopped after repeated failures (kick restarts it).
  const [stalled, setStalled] = useState(false);
  const [kick, setKick] = useState(0);

  const act = useCallback(
    async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          if (d?.needsKling) setNeedsKling(true);
          setError(d?.error || `That didn't work (${r.status}).`);
          return null;
        }
        if (d?.test) setTest(d.test as HookTestView);
        return d;
      } catch {
        setError("Network error. Check your connection and try again.");
        return null;
      }
    },
    [url]
  );

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (r.status === 404) setGone(true);
        else if (d?.test) setTest(d.test);
        else setError(d?.error || "Couldn't load this hook test.");
      })
      .catch(() => alive && setError("Couldn't load this hook test."));
    return () => {
      alive = false;
    };
  }, [url]);

  // Drive the reading: one request at a time. If another tab has it, look again in a few
  // seconds; after a few failures in a row, stop and offer "Try again".
  const waiting = test?.status === "new" || test?.status === "reading";
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      let failures = 0;
      while (alive) {
        if (!running.current) {
          running.current = true;
          const d = await act({ action: "run" });
          running.current = false;
          if (!alive) return;
          const t = d?.test as HookTestView | undefined;
          if (t && t.status !== "new" && t.status !== "reading") return;
          if (!d && ++failures >= 3) return setStalled(true);
        }
        await pause(failures ? 15_000 : 6_000);
      }
    })();
    return () => {
      alive = false;
    };
  }, [waiting, act, kick]);

  // Kling: check the clips every 20 seconds while any is rendering.
  const rendering = Boolean(test?.hooks.some((h) => h.take?.status === "rendering"));
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(() => void act({ action: "poll" }), 20_000);
    return () => clearInterval(t);
  }, [rendering, act]);

  if (gone) {
    return (
      <StudioCanvas>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm text-neutral-300">That hook test isn&apos;t here any more.</p>
          <Link href={studioHref(studio.key, "hooks")} className="mt-4 inline-block text-sm font-bold text-cyan-300 hover:text-white">
            ← Back to Hook Tester
          </Link>
        </div>
      </StudioCanvas>
    );
  }

  const made = test?.source === "project";
  const canKling = Boolean(made && test?.project?.exists && test.project.ready);
  // Hooks Kling can still make a clip for.
  const open = (test?.hooks ?? []).filter((h) => !h.video && (!h.take || h.take.status === "failed" || h.take.status === "blocked"));
  const chosen = open.filter((h) => !skip.has(h.id));
  const cost = chosen.reduce((s, h) => s + h.credits, 0);
  const current = (test?.hooks ?? []).filter((h) => h.rank > 0);
  const earlier = (test?.hooks ?? []).filter((h) => h.rank === 0);

  async function makeClips(ids: string[]) {
    setConfirm(false);
    setError(null);
    setNotice(null);
    setNeedsKling(false);
    setBusy(`Sending ${ids.length} hook clip${ids.length === 1 ? "" : "s"} to Kling…`);
    const d = await act({ action: "kling", hookIds: ids });
    setBusy(null);
    const report = d?.report as { message?: string | null; failed?: number } | undefined;
    if (report?.message) setNotice(report.message);
  }

  async function askAgain(hookId?: string, text?: string) {
    setError(null);
    setNotice(null);
    const d = await act({ action: "again", note: text ?? note, ...(hookId ? { hookId } : {}) });
    if (d) {
      setNote("");
      setRewrite(null);
    }
  }

  async function makeVideo(h: HookIdeaView) {
    setError(null);
    setBusy(made ? "Building the new video: your hook, then the original's clips…" : "Setting up the new video…");
    const d = await act({ action: made ? "video" : "recreate", hookId: h.id });
    if (d?.projectId) router.push(`/dashboard/creative-studio/${d.projectId}`);
    else setBusy(null);
  }

  const basis = test?.basis;
  const basisLine = !test?.read
    ? null
    : basis && (basis.judged || basis.market)
      ? `Judged against ${[basis.judged ? `${basis.judged} of your own ads` : "", basis.market ? `${basis.market} long-running ads in your niche${basis.researchAgeDays !== null ? ` (research ${basis.researchAgeDays} days old)` : ""}` : ""].filter(Boolean).join(" and ")}, plus your Kling framework.`
      : studio.kind === "client"
        ? "Judged on craft with the Kling framework. Ad results aren't linked to this firm's studio."
        : "Judged on craft with your Kling framework. There are no ad results to lean on yet: run “Learn my account” on the Ads page to add them.";

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <header className="lp-card flex flex-wrap items-center justify-between gap-3 pb-2 pt-6 sm:pt-10">
          <Link href={studioHref(studio.key, "hooks")} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-neutral-300 hover:text-white">
            <SvgIcon d={SP.chevronLeft} size={16} /> Hook Tester
          </Link>
          <StudioSwitch studio={studio} compact />
        </header>

        <div className="space-y-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">Hook test</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-white sm:text-4xl" style={SYNE}>
              {test?.title ?? "…"}
            </h1>
          </div>

          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}
          {needsKling && (
            <div className="lp-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Kling isn&apos;t connected, so the clips can&apos;t be made yet.
              <a href={`/api/dashboard/creative-studio/kling/connect?returnTo=${encodeURIComponent(`${studioHref(studio.key, "hooks")}/${testId}`)}`} className="font-bold text-white underline underline-offset-4">
                Connect Kling
              </a>
            </div>
          )}

          {!test ? (
            <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
          ) : (
            <>
              <AssistantCard accent="blue" icon={SP.film} title="The video" right={<Chip>{made ? "Made here" : "Dropped in"}</Chip>}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className={`mx-auto shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black ${test.video.vertical ? "w-40 sm:w-44" : "w-full sm:w-80"}`}>
                    {test.video.url ? (
                      <video src={`${test.video.url}#t=0.1`} controls playsInline preload="metadata" className={`w-full ${test.video.vertical ? "aspect-[9/16]" : "aspect-video"} object-contain`} />
                    ) : (
                      <div className={`flex ${test.video.vertical ? "aspect-[9/16]" : "aspect-video"} items-center justify-center text-xs text-neutral-500`}>No video to play</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {test.read ? (
                      <>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">The hook it has now</p>
                          <p className="mt-1 text-[15px] font-semibold leading-snug text-white">“{test.read.said || test.replacing?.lines.join(" ") || "…"}”</p>
                          {test.read.kind !== "none" && (
                            <span className="mt-1.5 inline-block">
                              <Chip>{HOOK_KINDS[test.read.kind]}</Chip>
                            </span>
                          )}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">Where it falls short</p>
                          <p className="mt-1 text-sm leading-relaxed text-neutral-200">{test.read.currentHook}</p>
                        </div>
                        {test.read.summary && <p className="text-xs leading-relaxed text-neutral-400">{test.read.summary}</p>}
                        {made && test.replacing && (
                          <p className="text-xs leading-relaxed text-neutral-400">
                            A new hook replaces {test.replacing.lines.length === 1 ? "clip 1" : `clips 1–${test.replacing.lines.length}`}
                            {test.replacing.next ? (
                              <>
                                {" "}
                                and runs straight into: <span className="text-neutral-200">“{test.replacing.next}”</span>
                              </>
                            ) : null}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-neutral-400">{test.status === "failed" ? "The video couldn't be read." : made ? "Reading the script and the frame…" : "Watching the video…"}</p>
                    )}
                  </div>
                </div>
              </AssistantCard>

              {made && test.project && !test.project.exists && <ErrorStrip>The original video was deleted, so new clips and videos can&apos;t be made from this test.</ErrorStrip>}

              {waiting && stalled && (
                <div className="lp-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <span className="min-w-0 flex-1">This is taking longer than it should.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStalled(false);
                      setError(null);
                      setKick((k) => k + 1);
                    }}
                    className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20"
                  >
                    Try again
                  </button>
                </div>
              )}
              {waiting && !stalled && (
                <ThinkingCard
                  label={!made && !test.read ? "Watching the video, then writing the hooks…" : test.hooks.length ? "Claude is writing new hooks…" : "Claude is writing the hooks…"}
                  detail={
                    !made && !test.read
                      ? "Stills from its first three seconds and every word with its time, then three hooks. A minute or two."
                      : "Three different kinds of opening, ranked, each one checked against your framework's rules. Under a minute."
                  }
                />
              )}

              {test.status === "failed" && (
                <div className="lp-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  <span className="min-w-0 flex-1">{test.error || "Writing the hooks failed."}</span>
                  <button type="button" onClick={() => void askAgain(undefined, "")} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20">
                    Try again
                  </button>
                </div>
              )}
              {test.status === "ready" && test.error && <ErrorStrip>{test.error}</ErrorStrip>}

              {test.hooks.length > 0 && (
                <AssistantCard
                  accent="violet"
                  icon={HOOK_ICON}
                  title={current.length === 3 ? "Three hooks to test" : `${current.length || test.hooks.length} hook${(current.length || test.hooks.length) === 1 ? "" : "s"} to test`}
                  right={rendering ? <Chip tone="blue">Kling is rendering…</Chip> : null}
                  delay={0.05}
                >
                  {basisLine && <p className="mb-4 text-xs leading-relaxed text-neutral-400">{basisLine}</p>}
                  {test.read?.notes && (
                    <p className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">{test.read.notes}</p>
                  )}
                  <div className="space-y-3">
                    {current.map((h) => (
                      <HookCard
                        key={h.id}
                        hook={h}
                        made={Boolean(made)}
                        refs={basis?.refs ?? {}}
                        canKling={canKling}
                        picked={!skip.has(h.id)}
                        onPick={(on) =>
                          setSkip((s) => {
                            const n = new Set(s);
                            if (on) n.delete(h.id);
                            else n.add(h.id);
                            return n;
                          })
                        }
                        busy={Boolean(busy) || waiting}
                        onRetry={() => void makeClips([h.id])}
                        onUse={() => void makeVideo(h)}
                        rewrite={rewrite?.id === h.id ? rewrite.note : null}
                        onRewrite={(v) => setRewrite(v === null ? null : { id: h.id, note: v })}
                        onRewriteGo={() => void askAgain(h.id, rewrite?.note ?? "")}
                      />
                    ))}
                  </div>
                  {earlier.length > 0 && (
                    <>
                      <p className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">From earlier rounds</p>
                      <div className="space-y-3">
                        {earlier.map((h) => (
                          <HookCard key={h.id} hook={h} made={Boolean(made)} refs={basis?.refs ?? {}} canKling={canKling} picked={false} onPick={() => {}} busy={Boolean(busy) || waiting} onRetry={() => void makeClips([h.id])} onUse={() => void makeVideo(h)} rewrite={null} onRewrite={() => {}} onRewriteGo={() => {}} />
                        ))}
                      </div>
                    </>
                  )}

                  {busy && (
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-cyan-200">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
                      {busy}
                    </p>
                  )}
                  {notice && <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{notice}</p>}

                  {made && open.length > 0 && !busy && (
                    <div className="mt-5 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] p-4">
                      {!canKling ? (
                        <p className="text-sm text-neutral-300">
                          {test.project?.exists ? "The original still has clips rendering. Kling can make hook clips once they're all done." : "The original video is gone, so Kling can't make these."}
                        </p>
                      ) : confirm ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="min-w-0 flex-1 text-sm text-white">
                            Make {chosen.length} hook clip{chosen.length === 1 ? "" : "s"} on Kling for about{" "}
                            <b style={NUM_FONT}>{fmt(cost)} credits</b>? Nothing else in the video is re-made.
                          </p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void makeClips(chosen.map((h) => h.id))} className={`${CTA_CLASSES} !px-5 !py-2.5`}>
                              Yes, make {chosen.length === 1 ? "it" : "them"}
                            </button>
                            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-bold text-neutral-200 hover:text-white">
                              Not yet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">Make the hook clips on Kling</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
                              Same presenter, same frame as the original&apos;s hook. Then watch them side by side and pick the strongest.
                            </p>
                          </div>
                          <button type="button" disabled={chosen.length === 0 || waiting} onClick={() => setConfirm(true)} className={`${CTA_CLASSES} !px-5 !py-2.5`}>
                            Make {chosen.length} clip{chosen.length === 1 ? "" : "s"}
                            <span className="font-semibold opacity-80" style={NUM_FONT}>
                              · ~{fmt(cost)} credits
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!waiting && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <label htmlFor="hook-note" className="text-sm font-bold text-white">
                        Not these?
                      </label>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        Say what to try and I&apos;ll write three new ones{test.hooks.some((h) => h.take || h.video) ? ". Hooks that already have a clip stay." : "."}
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          id="hook-note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !busy && void askAgain()}
                          maxLength={600}
                          placeholder="e.g. more aggressive, lead with the $240,000 number, call out firm owners doing $1M+"
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-base text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
                        />
                        <button type="button" disabled={Boolean(busy)} onClick={() => void askAgain()} className="min-h-11 shrink-0 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
                          Write new hooks
                        </button>
                      </div>
                    </div>
                  )}
                </AssistantCard>
              )}

              {test.hooks.length > 0 && (
                <div className="lp-card grid gap-2 text-xs leading-relaxed text-neutral-400 sm:grid-cols-3">
                  {(made
                    ? [
                        ["1 · Kling makes the hook only", "One short clip per hook, from the frame the original's hook was made from."],
                        ["2 · You pick the strongest", "Watch the clips here. Make a video from one, or from each of them to run against each other."],
                        ["3 · It becomes a new video", "Your hook, then the original's other clips with their trims. Auto-cut, then the same Remotion edit in one tap. The original stays as it is."],
                      ]
                    : [
                        ["1 · Pick a hook", "These are written for a presenter talking to camera, leading into what the video says next."],
                        ["2 · Re-make the video with it", "A new video opens, set up to recreate this one with your hook as its first line."],
                        ["3 · Add the frame", "Paste the presenter's frame there. Claude writes the script, Kling renders it, Remotion edits it."],
                      ]
                  ).map(([t, d]) => (
                    <div key={t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="font-bold text-white">{t}</p>
                      <p className="mt-1">{d}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </StudioCanvas>
  );
}

function HookCard({
  hook,
  made,
  refs,
  canKling,
  picked,
  onPick,
  busy,
  onRetry,
  onUse,
  rewrite,
  onRewrite,
  onRewriteGo,
}: {
  hook: HookIdeaView;
  made: boolean;
  refs: Record<string, string>;
  canKling: boolean;
  picked: boolean;
  onPick: (on: boolean) => void;
  busy: boolean;
  onRetry: () => void;
  onUse: () => void;
  rewrite: string | null;
  onRewrite: (v: string | null) => void;
  onRewriteGo: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const take = hook.take;
  const done = take?.status === "done" && take.videoUrl;
  const failed = take?.status === "failed" || take?.status === "blocked";
  const untouched = !take && !hook.video;
  const best = hook.rank === 1;
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${best ? "border-cyan-400/40 bg-cyan-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {hook.rank > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${best ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white" : "bg-white/10 text-neutral-200"}`} style={NUM_FONT}>
                #{hook.rank} · {RANK_LABEL[hook.rank] ?? "Hook"}
              </span>
            )}
            <Chip tone="blue">{HOOK_KINDS[hook.kind]}</Chip>
            <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
              ~{hook.durationS} s{made ? ` · ${fmt(hook.credits)} credits` : ""}
            </span>
          </div>
          <p className="mt-2.5 text-[17px] font-semibold leading-snug text-white sm:text-lg">“{hook.line}”</p>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
            <span className="font-bold text-white">Why test it: </span>
            {hook.why}
          </p>
          {hook.evidence.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hook.evidence.map((e) => (
                <span key={e} className="max-w-full truncate rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-neutral-300" title={refs[e] ?? e}>
                  {refs[e] ?? e}
                </span>
              ))}
            </div>
          )}
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-neutral-400 sm:grid-cols-2">
            {hook.title && (
              <div className="min-w-0">
                <dt className="inline font-bold text-neutral-300">On-screen title: </dt>
                <dd className="inline uppercase tracking-wide text-neutral-200">{hook.title}</dd>
              </div>
            )}
            {(hook.register || hook.action) && (
              <div className="min-w-0">
                <dt className="inline font-bold text-neutral-300">Delivery: </dt>
                <dd className="inline">{[hook.register, hook.action].filter(Boolean).join(" · ")}</dd>
              </div>
            )}
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {hook.video ? (
              <Link href={`/dashboard/creative-studio/${hook.video.id}`} className={`${CTA_CLASSES} !px-5 !py-2.5`}>
                Open the video →
              </Link>
            ) : made ? (
              done ? (
                <button type="button" disabled={busy} onClick={onUse} className={`${CTA_CLASSES} !px-5 !py-2.5`}>
                  Make the video with this hook →
                </button>
              ) : untouched && canKling ? (
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-200">
                  <input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
                  Make this clip
                </label>
              ) : null
            ) : (
              <button type="button" disabled={busy} onClick={onUse} className={`${CTA_CLASSES} !px-5 !py-2.5`}>
                Re-make the video with this hook →
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(hook.line).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white"
            >
              <SvgIcon d={SP.copy} size={14} /> {copied ? "Copied" : "Copy line"}
            </button>
            {(untouched || (failed && !hook.video)) && hook.rank > 0 && rewrite === null && (
              <button type="button" disabled={busy} onClick={() => onRewrite("")} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white disabled:opacity-50">
                <SvgIcon d={SP.pen} size={14} /> Rewrite this one
              </button>
            )}
          </div>
          {hook.video && <p className="mt-2 text-xs text-emerald-300">✓ Video made: “{hook.video.title}”</p>}
          {rewrite !== null && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                value={rewrite}
                onChange={(e) => onRewrite(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRewriteGo();
                  if (e.key === "Escape") onRewrite(null);
                }}
                maxLength={600}
                placeholder="What should change? (leave empty for a fresh take)"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-base text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
              />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={onRewriteGo} className="min-h-11 rounded-full bg-cyan-600 px-4 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
                  Rewrite
                </button>
                <button type="button" onClick={() => onRewrite(null)} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-bold text-neutral-300 hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {made && take && (
          <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              {done ? (
                <video src={`${take.videoUrl}#t=0.1`} controls playsInline preload="metadata" className="aspect-[9/16] w-full object-contain" />
              ) : (
                <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 px-3 text-center">
                  {take.status === "rendering" || take.status === "draft" ? (
                    <>
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
                      <span className="text-[11px] font-semibold text-neutral-300">Kling is making this clip. A few minutes.</span>
                    </>
                  ) : failed ? (
                    <>
                      <span className="text-[11px] font-bold text-rose-300">{take.status === "blocked" ? "Kling blocked this line" : "Kling couldn't make it"}</span>
                      <span className="line-clamp-4 text-[10px] text-neutral-400">{take.error}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-400">The clip is done but its file is missing.</span>
                  )}
                </div>
              )}
            </div>
            {failed && canKling && (
              <button type="button" disabled={busy} onClick={onRetry} className="mt-2 min-h-10 w-full rounded-full border border-white/15 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50">
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
