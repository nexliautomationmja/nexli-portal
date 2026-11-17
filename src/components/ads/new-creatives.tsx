"use client";

import { useCallback, useEffect, useState } from "react";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { Button, Segmented, Sheet } from "@/components/rainmaker";
import { Glass, Ico } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";
import { DECK_STAGE, IDEAS_MAX, type CreativeIdea, type DeckItem, type IdeaSetView } from "@/lib/ads/ideas-shared";

/**
 * "Create new creatives": pick 1 or a batch of up to 5, Claude comes up with
 * fresh video ideas backed by what books calls for Marcel and what others
 * selling to CPA firms keep running, he keeps the ones he likes, and they go
 * to Creative Studio as one video or a batch. Until they're live in Meta
 * they sit "on deck", ready for the next time a creative gets cut.
 */

export interface DeckState {
  latest: IdeaSetView | null;
  deck: DeckItem[];
  live: DeckItem[];
  hasResearch: boolean;
}

const toDeck = (d: { latest?: IdeaSetView | null; deck?: DeckItem[]; live?: DeckItem[]; hasResearch?: boolean }): DeckState => ({ latest: d.latest ?? null, deck: d.deck ?? [], live: d.live ?? [], hasResearch: Boolean(d.hasResearch) });
const fetchDeck = () =>
  fetch("/api/dashboard/ads/ideas", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

export function useDeck() {
  const [state, setState] = useState<DeckState | null>(null);
  useEffect(() => {
    let live = true;
    void fetchDeck().then((d) => {
      if (live && d?.configured) setState(toDeck(d));
    });
    return () => {
      live = false;
    };
  }, []);
  const reload = useCallback(async () => {
    const d = await fetchDeck();
    if (d?.configured) setState(toDeck(d));
  }, []);
  return { deck: state, reloadDeck: reload };
}

const SPARK = <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />;

/** The button (opens the sheet). */
export function CreateCreativesButton({ onClick, label = "Create new creatives", tone = "primary" }: { onClick: () => void; label?: string; tone?: "primary" | "quiet" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === "primary"
          ? "inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-xl shadow-blue-600/20 transition-transform hover:brightness-110 active:scale-[0.98]"
          : "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10"
      }
    >
      <Ico d={SPARK} size={tone === "primary" ? 16 : 13} />
      {label}
    </button>
  );
}

const COUNT_OPTIONS = Array.from({ length: IDEAS_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const DAY = 86400000;

/** Mounted when opened (so it starts fresh each time): the last ideas if they weren't made yet (from the last day), else a new pick. */
export function NewCreativesSheet({
  onClose,
  defaultCount,
  studioKey,
  deck,
  onMade,
  defaultNote = "",
}: {
  onClose: () => void;
  defaultCount: number;
  studioKey: string;
  deck: DeckState | null;
  onMade: () => void;
  /** A note to start from (the Ask chat's suggestion) — then it's always a new pick. */
  defaultNote?: string;
}) {
  const [unmade] = useState<IdeaSetView | null>(() => {
    if (defaultNote) return null;
    const last = deck?.latest;
    return last && last.projectIds.every((p) => !p) && Date.now() - new Date(last.createdAt).getTime() < DAY ? last : null;
  });
  const [count, setCount] = useState(String(Math.max(1, Math.min(IDEAS_MAX, defaultCount))));
  const [note, setNote] = useState(defaultNote);
  const [set, setSet] = useState<IdeaSetView | null>(unmade);
  const [picked, setPicked] = useState<boolean[]>(() => (unmade ? unmade.ideas.map(() => true) : []));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function think() {
    setBusy(`Claude is going through what books your calls${deck?.hasResearch ? " and what's running in the Ad Library" : ""}…`);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/ads/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: Number(count), note }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.set) throw new Error(d?.error || "Couldn't come up with ideas right now.");
      setSet(d.set as IdeaSetView);
      setPicked((d.set as IdeaSetView).ideas.map(() => true));
      onMade();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't come up with ideas right now.");
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    if (!set) return;
    const chosen = set.ideas.map((idea, i) => ({ idea, i })).filter((x) => picked[x.i]);
    if (!chosen.length) return;
    const qs = `?studio=${encodeURIComponent(studioKey)}`;
    const ids: (string | null)[] = set.ideas.map(() => null);
    setError(null);
    try {
      if (chosen.length === 1) {
        setBusy("Creating the video in Creative Studio…");
        const { idea, i } = chosen[0];
        const r = await fetch(`/api/dashboard/creative-studio/projects${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: idea.title, brief: { direction: idea.direction }, format: "ad_9x16" }),
        });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.id) throw new Error(d?.error || "Couldn't create the video.");
        ids[i] = d.id;
        await link(set.id, ids, null);
        window.location.href = `/dashboard/creative-studio/${d.id}?start=1`;
        return;
      }
      setBusy(`Creating ${chosen.length} videos in Creative Studio…`);
      const r = await fetch(`/api/dashboard/creative-studio/batches${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "ad_9x16",
          brief: set.note || `New creatives from the Ads Command Center — backed by ${set.backing?.ours ?? "your results"}${set.backing?.market ? ` and ${set.backing.market}` : ""}.`,
          items: chosen.map(({ idea }) => ({ title: idea.title, direction: idea.direction, shot: idea.shot, frame: null })),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error(d?.error || "Couldn't create the batch.");
      for (const p of (d.projects ?? []) as { id: string; index: number }[]) {
        const c = chosen[p.index];
        if (c) ids[c.i] = p.id;
      }
      await link(set.id, ids, d.id);
      window.location.href = `/dashboard/creative-studio/batch/${d.id}`;
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Couldn't create the videos.");
    }
  }

  const chosenN = picked.filter(Boolean).length;
  return (
    <Sheet
      open
      onClose={() => !busy && onClose()}
      size="lg"
      fullOnPhone
      title="Create new creatives"
      sub={set ? `${set.ideas.length} idea${set.ideas.length === 1 ? "" : "s"} · keep the ones you like` : "Fresh video ideas, backed by what books your calls and what works in your space"}
      footer={
        set ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="secondary" onClick={() => setSet(null)} disabled={Boolean(busy)}>
              New ideas
            </Button>
            <Button onClick={() => void create()} disabled={!chosenN} busy={Boolean(busy)}>
              {busy ?? (chosenN === 1 ? "Make this video in Creative Studio" : `Make ${chosenN} videos in Creative Studio`)}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button onClick={() => void think()} busy={Boolean(busy)}>
              {busy ? "Thinking…" : `Come up with ${count === "1" ? "1 idea" : `${count} ideas`}`}
            </Button>
          </div>
        )
      }
    >
      {error && <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {!set ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">How many</p>
            <Segmented value={count} options={COUNT_OPTIONS} onChange={setCount} ariaLabel="How many ideas" numeric />
            <p className="mt-1.5 text-xs text-neutral-400">{count === "1" ? "One video." : `A batch of ${count} different videos — each its own hook, scene and opening frame.`}</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Anything in mind? (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="e.g. lean into tax season, or try a proof angle with a client story"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[16px] text-white placeholder:text-neutral-500 focus:border-blue-400/50 focus:outline-none sm:text-sm"
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-neutral-300">
            <p className="font-bold text-white">What the ideas are backed by</p>
            <p className="mt-1 flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: VIZ.status.good }} />
              Your results: which creative types and ads book calls, at what cost — and which ones to stop making.
            </p>
            <p className="mt-1 flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: deck?.hasResearch ? VIZ.status.good : VIZ.inkMuted }} />
              {deck?.hasResearch ? (
                "Your space: ads others selling to CPA firms have kept running 30+ days, and the patterns and gaps from your Ad Library research."
              ) : (
                <span>
                  Your space: no Ad Library research from the last 60 days yet —{" "}
                  <a href="#research" onClick={onClose} className="font-semibold text-cyan-300 hover:underline">
                    run it
                  </a>{" "}
                  to add what others in your space are running.
                </span>
              )}
            </p>
          </div>
          {busy && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-400/25 bg-blue-500/[0.07] px-4 py-3">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" aria-hidden="true" />
              <p className="text-sm text-blue-50">{busy} About a minute.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {set.backing && (
            <p className="text-[11px] text-neutral-400" style={NUM_FONT}>
              Backed by {set.backing.ours}
              {set.backing.market ? ` · ${set.backing.market}` : " · no Ad Library research yet"}
            </p>
          )}
          {set.ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} n={i + 1} on={Boolean(picked[i])} onToggle={() => setPicked((p) => p.map((v, k) => (k === i ? !v : v)))} />
          ))}
          <p className="text-[11px] text-neutral-500">Creative Studio writes each script from its idea and makes the opening frame — you review before anything goes to Kling.</p>
        </div>
      )}
    </Sheet>
  );
}

async function link(id: string, projectIds: (string | null)[], batchId: string | null) {
  await fetch(`/api/dashboard/ads/ideas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds, batchId }) }).catch(() => {});
}

function IdeaCard({ idea, n, on, onToggle }: { idea: CreativeIdea; n: number; on: boolean; onToggle: () => void }) {
  const [more, setMore] = useState(false);
  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${on ? "border-blue-400/35 bg-blue-500/[0.07]" : "border-white/10 bg-white/[0.02] opacity-60"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={on ? `Leave out idea ${n}` : `Keep idea ${n}`}
          onClick={onToggle}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-blue-400 bg-blue-600 text-white" : "border-white/25 text-transparent"}`}
        >
          <Ico d={<path d="M20 6 9 17l-5-5" />} size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400" style={NUM_FONT}>
            Idea {n} · {idea.typeLabel}
          </p>
          <h4 className="mt-0.5 text-base font-bold text-white" style={SYNE}>
            {idea.title}
          </h4>
          {idea.hook && <p className="mt-1 text-sm font-semibold text-cyan-100">“{idea.hook}”</p>}
          <p className="mt-1 text-xs leading-relaxed text-neutral-300">{idea.concept}</p>
          {(idea.whyOurs || idea.whyMarket) && (
            <ul className="mt-2 space-y-1">
              {idea.whyOurs && (
                <li className="flex gap-2 text-[11px] leading-snug text-emerald-100/90">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: VIZ.status.good }} />
                  <span>
                    <span className="font-bold">Your results:</span> {idea.whyOurs}
                  </span>
                </li>
              )}
              {idea.whyMarket && (
                <li className="flex gap-2 text-[11px] leading-snug text-violet-100/90">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  <span>
                    <span className="font-bold">Your space:</span> {idea.whyMarket}
                    {idea.marketRefs.filter((m) => m.url).map((m, k) => (
                      <a key={k} href={m.url ?? undefined} target="_blank" rel="noopener noreferrer" className="ml-1.5 font-semibold text-cyan-300 hover:underline">
                        {m.advertiser} ↗
                      </a>
                    ))}
                  </span>
                </li>
              )}
            </ul>
          )}
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-1.5 min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
            {more ? "Hide the direction" : "Read the full direction"}
          </button>
          {more && (
            <div className="mt-1 space-y-1.5 rounded-lg bg-black/30 p-2.5 text-xs leading-relaxed text-neutral-200">
              <p className="whitespace-pre-wrap">{idea.direction}</p>
              {idea.shot && (
                <p className="text-neutral-400">
                  <span className="font-semibold text-neutral-300">Opening frame:</span> {idea.shot}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Creatives on deck: made from ideas, not live in Meta yet — the next ones to upload when something gets cut. */
export function OnDeck({ deck, onCreate, onLive }: { deck: DeckState | null; onCreate: () => void; onLive: (item: DeckItem, live: boolean) => void }) {
  const items = deck?.deck ?? [];
  const ready = items.filter((i) => i.stage === "ready").length;
  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-white" style={SYNE}>
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
            On deck
            <span className="text-sm font-semibold text-neutral-400" style={NUM_FONT}>
              {items.length}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            {items.length
              ? `${ready} ready to upload${items.length > ready ? `, ${items.length - ready} still being made` : ""} — when a creative gets cut, put one of these live in its place.`
              : "Nothing waiting yet. Make a few now so a fresh creative is ready the moment one gets cut."}
          </p>
        </div>
        <CreateCreativesButton onClick={onCreate} tone="quiet" label={items.length ? "Make more" : "Create new creatives"} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.slice(0, 10).map((it) => (
            <li key={it.projectId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${it.stage === "ready" ? "bg-emerald-400" : "bg-neutral-500"}`} />
              <div className="min-w-0 flex-1">
                <a href={`/dashboard/creative-studio/${it.projectId}`} className="block truncate text-sm font-bold text-white hover:underline">
                  {it.title}
                </a>
                <p className="truncate text-[11px] text-neutral-400">
                  <span className={it.stage === "ready" ? "font-semibold text-emerald-200" : ""}>{DECK_STAGE[it.stage]}</span>
                  {it.typeLabel ? ` · ${it.typeLabel}` : ""}
                </p>
              </div>
              {(it.stage === "ready" || it.stage === "clips") && (
                <button type="button" onClick={() => onLive(it, true)} className="min-h-9 shrink-0 rounded-full bg-emerald-500/15 px-3 text-[11px] font-bold text-emerald-100 hover:bg-emerald-500/25">
                  It&apos;s live
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(deck?.live.length ?? 0) > 0 && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Went live recently: {deck!.live.slice(0, 4).map((i) => i.title).join(" · ")}
        </p>
      )}
    </Glass>
  );
}
