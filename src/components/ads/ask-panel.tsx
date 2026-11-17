"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { SYNE } from "@/components/launch-pad";
import { ReportMarkdown } from "@/components/ads/report-markdown";
import { Ico } from "@/components/ads/parts";
import { CreateCreativesButton } from "@/components/ads/new-creatives";
import { VIZ } from "@/components/ads/viz";
import { count, decimal, money, pct } from "@/lib/ads/format";
import type { AdPlan } from "@/lib/ads/decide";
import { addText, takeLines, CHAT_MAX_MESSAGE, CHAT_MAX_USER_TURNS, type ChatBlock, type ChatEvent, type ChatView, type CreativeCardData, type DisplayTurn, type LeadRowData, type WindowNumbers } from "@/lib/ads/chat-shared";
import type { ChangeView } from "@/lib/ads/corrections-shared";

/**
 * "Ask about your ads" — the chat at the top of the Ads page. Marcel asks in
 * plain words; Claude answers from the same numbers as the page (streamed),
 * shows creative and lead cards, and puts any change it suggests on a card:
 * nothing changes until he taps Apply, and he can undo it.
 */

const SEND = <path d="M5 12h14M13 6l6 6-6 6" />;
const EXT = <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />;
const SPARK = <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />;

type Live = { user: DisplayTurn; turn: DisplayTurn } | null;

export function AskPanel({
  plan,
  onChanged,
  onCreate,
  onJumpAd,
}: {
  plan: AdPlan | null;
  /** A change was applied or undone: reload the numbers (and Goals when they changed). */
  onChanged: (o: { goals: boolean }) => void;
  onCreate: (count: number, note: string) => void;
  onJumpAd: (id: string) => void;
}) {
  const [chat, setChat] = useState<ChatView | null>(null);
  const [changes, setChanges] = useState<Record<string, ChangeView>>({});
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<Live>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/ads/chat", { cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.configured) {
        setChat(d.chat ?? null);
        setChanges(Object.fromEntries(((d.changes ?? []) as ChangeView[]).map((c) => [c.id, c])));
      }
    } catch {
      /* the page works without it */
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Follow the answer as it streams in, unless Marcel scrolled up to read.
  const turns = useMemo(() => [...(chat?.turns ?? []), ...(live ? [live.user, live.turn] : [])], [chat, live]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  async function send(text0?: string) {
    const text = (text0 ?? input).trim();
    if (!text || sending) return;
    if (text.length > CHAT_MAX_MESSAGE) {
      setError(`Keep it under ${CHAT_MAX_MESSAGE.toLocaleString()} characters.`);
      return;
    }
    setSending(true);
    setError(null);
    setInput("");
    stick.current = true;
    const at = new Date().toISOString();
    const user: DisplayTurn = { role: "user", at, items: [{ type: "text", text }] };
    let turn: DisplayTurn = { role: "assistant", at, items: [] };
    let chatId = chat?.id ?? null;
    let finished = false;
    let started = false;
    setLive({ user, turn });
    try {
      const res = await fetch("/api/dashboard/ads/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, message: text }) });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Couldn't send it (${res.status}).`);
      }
      started = true;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const handle = (e: ChatEvent) => {
        if (e.t === "chat") chatId = e.id;
        else if (e.t === "text") turn = { ...turn, items: addText(turn.items, e.d) };
        else if (e.t === "tool") turn = { ...turn, items: [...turn.items, { type: "tool", label: e.label }] };
        else if (e.t === "block") turn = { ...turn, items: [...turn.items, { type: "block", block: e.block }] };
        else if (e.t === "change") setChanges((m) => ({ ...m, [e.change.id]: e.change }));
        else if (e.t === "done") {
          turn = e.turn;
          finished = true;
        } else if (e.t === "error") turn = { ...turn, error: e.message };
        if (e.t !== "ping" && e.t !== "change") setLive({ user, turn });
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const { lines, rest } = takeLines(buf);
        buf = rest;
        for (const line of lines) {
          try {
            handle(JSON.parse(line) as ChatEvent);
          } catch {
            /* a broken line — skip it */
          }
        }
      }
      if (!finished && !turn.error) turn = { ...turn, error: "The connection dropped before the answer finished. Reload in a minute to see the rest." };
    } catch (err) {
      if (!started) {
        setError(err instanceof Error ? err.message : "Couldn't reach the server — check your connection.");
        setInput(text);
      } else turn = { ...turn, error: "The connection dropped before the answer finished. Reload in a minute to see the rest." };
    } finally {
      if (started) {
        const id = chatId;
        setChat((c) => {
          const all = [...(c?.turns ?? []), user, turn];
          const users = all.filter((t) => t.role === "user").length;
          return { id: id ?? c?.id ?? "", turns: all, userTurns: users, full: users >= CHAT_MAX_USER_TURNS, updatedAt: new Date().toISOString() };
        });
      }
      setLive(null);
      setSending(false);
      setTimeout(() => box.current?.focus(), 0);
    }
  }

  async function newChat() {
    if (sending) return;
    const r = await fetch("/api/dashboard/ads/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "new" }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (d?.chat) {
      setChat(d.chat);
      setError(null);
    } else setError("Couldn't start a new chat — try again.");
  }

  const act = useCallback(
    async (id: string, action: "apply" | "dismiss" | "undo"): Promise<string | null> => {
      try {
        const r = await fetch(`/api/dashboard/ads/changes/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
        const d = await r.json().catch(() => null);
        if (!r.ok) return d?.error || "That didn't work — try again.";
        if (d?.change) setChanges((m) => ({ ...m, [d.change.id]: d.change }));
        if (action !== "dismiss") {
          onChanged({ goals: Boolean(d?.goalsChanged) });
          // Applying can close older changes (a newer call on the same creative, a whole-lead fix) — refresh the list.
          void fetch("/api/dashboard/ads/changes", { cache: "no-store" })
            .then((x) => x.json())
            .then((x) => x?.changes && setChanges(Object.fromEntries((x.changes as ChangeView[]).map((c) => [c.id, c]))))
            .catch(() => {});
        }
        return null;
      } catch {
        return "Couldn't reach the server — check your connection.";
      }
    },
    [onChanged]
  );

  const chips = useMemo(() => {
    const out = ["Is any creative's tracking off?"];
    if (plan?.counts.cut) out.push("Explain today's cuts");
    const testing = plan?.calls.find((c) => c.call === "keep" && c.tag === "testing");
    if (testing) out.push(`Should I keep “${testing.name.length > 40 ? `${testing.name.slice(0, 38)}…` : testing.name}”?`);
    out.push("What should I make next?");
    return out;
  }, [plan]);

  const list = useMemo(() => Object.values(changes).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [changes]);
  const empty = turns.length === 0;
  const full = Boolean(chat?.full);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {empty ? (
          <div className="px-4 pb-2 pt-5 sm:px-6">
            <p className="text-sm leading-relaxed text-neutral-300">
              Ask in plain words, the way you&apos;d ask Manus — it answers in seconds. Claude reads the same numbers as this page, can open a creative&apos;s leads one by one, and can suggest fixes: a lead or
              booked call that didn&apos;t really happen, your own Cut or Keep on a creative, new targets.{" "}
              <span className="font-semibold text-white">Nothing changes until you tap Apply.</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!loaded || sending}
                  onClick={() => void send(c)}
                  className="min-h-10 rounded-full border border-cyan-400/25 bg-cyan-500/[0.07] px-3.5 text-left text-xs font-semibold text-cyan-50 transition-colors hover:bg-cyan-500/15 disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="cs-scroll max-h-[620px] space-y-4 overflow-y-auto px-3 py-4 sm:px-5"
            aria-live="polite"
          >
            {turns.map((t, i) => (
              <Turn key={i} t={t} streaming={Boolean(live) && i === turns.length - 1} changes={changes} onAct={act} onCreate={onCreate} onJumpAd={onJumpAd} />
            ))}
          </div>
        )}

        <div className="border-t border-white/10 bg-black/20 p-2.5 sm:p-3">
          {full ? (
            <div className="flex flex-wrap items-center gap-2 px-1 py-1 text-xs text-neutral-300">
              <span className="min-w-0 flex-1">This chat is full. Start a new one — your corrections stay.</span>
              <button type="button" onClick={() => void newChat()} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15">
                New chat
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={box}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={CHAT_MAX_MESSAGE}
                disabled={!loaded}
                placeholder={sending ? "Claude is answering…" : "Ask about any ad or number…"}
                className="min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-base leading-snug text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
                aria-label="Ask about your ads"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 transition-transform active:scale-95 disabled:opacity-40"
                aria-label="Send"
              >
                {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" /> : <Ico d={SEND} size={18} />}
              </button>
            </form>
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-neutral-500">
            <span>Claude · reads Meta and your CRM · changes only on your Apply · never changes Meta</span>
            {!empty && !full && (
              <button type="button" onClick={() => void newChat()} disabled={sending} className="min-h-8 font-semibold text-neutral-300 hover:text-white disabled:opacity-50">
                New chat
              </button>
            )}
          </div>
          {error && <p className="mt-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p>}
        </div>
      </div>

      <Corrections list={list} onAct={act} />
    </div>
  );
}

// ── A turn ───────────────────────────────────────────────

function Turn({
  t,
  streaming,
  changes,
  onAct,
  onCreate,
  onJumpAd,
}: {
  t: DisplayTurn;
  streaming: boolean;
  changes: Record<string, ChangeView>;
  onAct: (id: string, action: "apply" | "dismiss" | "undo") => Promise<string | null>;
  onCreate: (count: number, note: string) => void;
  onJumpAd: (id: string) => void;
}) {
  if (t.role === "user") {
    const text = t.items.map((i) => (i.type === "text" ? i.text : "")).join("");
    return (
      <div className="flex justify-end">
        <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-cyan-600/30 to-blue-600/30 px-3.5 py-2.5 text-sm text-white ring-1 ring-cyan-400/20">{text}</p>
      </div>
    );
  }
  const lastTool = t.items.reduce((n, it, i) => (it.type === "tool" ? i : n), -1);
  return (
    <div className="max-w-full space-y-2 sm:max-w-[92%]">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
        <Ico d={SPARK} size={11} /> Claude
      </p>
      {t.items.length === 0 && streaming && <Dots label="Reading your numbers" />}
      {t.items.map((it, i) =>
        it.type === "text" ? (
          <div key={i} className="[&_p]:text-[13.5px] [&_li]:text-[13.5px]">
            <ReportMarkdown text={it.text} />
          </div>
        ) : it.type === "tool" ? (
          streaming && i === lastTool && i === t.items.length - 1 ? (
            <Dots key={i} label={it.label} />
          ) : (
            <p key={i} className="text-[11px] text-neutral-500">
              {it.label}
            </p>
          )
        ) : (
          <BlockView key={i} b={it.block} changes={changes} onAct={onAct} onCreate={onCreate} onJumpAd={onJumpAd} />
        )
      )}
      {t.error && <p className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100">{t.error}</p>}
    </div>
  );
}

function Dots({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-neutral-400">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
      {label}…
    </p>
  );
}

function BlockView({
  b,
  changes,
  onAct,
  onCreate,
  onJumpAd,
}: {
  b: ChatBlock;
  changes: Record<string, ChangeView>;
  onAct: (id: string, action: "apply" | "dismiss" | "undo") => Promise<string | null>;
  onCreate: (count: number, note: string) => void;
  onJumpAd: (id: string) => void;
}) {
  if (b.kind === "creative") return <CreativeBlock c={b.card} onJumpAd={onJumpAd} />;
  if (b.kind === "leads") return <LeadsBlock b={b} />;
  if (b.kind === "change") {
    const c = changes[b.changeId];
    return c ? <ChangeCard c={c} onAct={onAct} /> : <p className="text-[11px] text-neutral-500">That suggestion was closed.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
      <p className="min-w-0 flex-1 text-xs text-violet-50">
        <span className="font-bold">
          {b.count} new creative{b.count === 1 ? "" : "s"}
        </span>
        {b.note ? ` — ${b.note}` : ""}
      </p>
      <CreateCreativesButton tone="quiet" onClick={() => onCreate(b.count, b.note)} />
    </div>
  );
}

// ── Creative card ────────────────────────────────────────

function CreativeBlock({ c, onJumpAd }: { c: CreativeCardData; onJumpAd: (id: string) => void }) {
  const cut = c.call?.call === "cut";
  const color = !c.call ? VIZ.inkMuted : cut ? (c.call.done ? VIZ.inkMuted : VIZ.status.critical) : c.call.tag === "tiring" ? VIZ.status.warning : VIZ.status.good;
  const label = !c.call ? (c.live ? "Running" : "Off") : `${cut ? (c.call.done ? "Cut · done" : "Cut") : `Keep${c.call.tag ? ` · ${c.call.tag[0].toUpperCase()}${c.call.tag.slice(1)}` : ""}`}${c.call.yours ? " · yours" : ""}`;
  const rows: { k: string; f: (w: WindowNumbers) => string }[] = [
    { k: "Spent", f: (w) => money(w.spendCents) },
    { k: "Leads (CRM)", f: (w) => (w.crmLeads === null ? "—" : count(w.crmLeads)) },
    { k: "Meta's leads", f: (w) => count(w.metaLeads) },
    { k: "Booked calls", f: (w) => (w.booked === null ? "—" : count(w.booked)) },
    { k: "Per lead", f: (w) => money(w.cplCents) },
    { k: "Per booked call", f: (w) => money(w.cpbCents) },
    { k: "Clicked", f: (w) => pct(w.ctr) },
    { k: "Frequency", f: (w) => decimal(w.frequency, 1) },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex gap-3">
        <span className="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 text-sm font-bold text-white">{c.name}</p>
            <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ color: "#e5e7eb", borderColor: `${color}80`, background: `${color}22` }}>
              {label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {[c.adsetName, c.ageDays !== null ? `${c.ageDays} days old` : null, c.hasUtm === false ? "no utm_content — the CRM can't credit it" : null].filter(Boolean).join(" · ")}
          </p>
          {c.call && <p className="mt-1 text-xs leading-snug text-neutral-300">{c.call.reason}</p>}
          {c.fixes && (c.fixes.leads > 0 || c.fixes.bookings > 0) && (
            <p className="mt-0.5 text-[11px] font-semibold text-cyan-300/90">
              {[c.fixes.leads ? `${c.fixes.leads} lead${c.fixes.leads === 1 ? "" : "s"}` : null, c.fixes.bookings ? `${c.fixes.bookings} booked call${c.fixes.bookings === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ")} you marked not real left out
            </p>
          )}
        </div>
      </div>
      <div className="cs-scroll mt-2.5 overflow-x-auto">
        <table className="w-full min-w-[300px] text-xs" style={NUM_FONT}>
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="py-1 pr-2 text-left font-bold" />
              <th className="py-1 pr-2 text-right font-bold">Last 7 days</th>
              <th className="py-1 text-right font-bold">Last 30 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-t border-white/5">
                <td className="py-1 pr-2 text-neutral-400">{r.k}</td>
                <td className="py-1 pr-2 text-right text-neutral-200">{c.w7 ? r.f(c.w7) : "—"}</td>
                <td className="py-1 text-right font-semibold text-white">{c.w30 ? r.f(c.w30) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.fatigue.reasons.length > 0 && <p className="mt-2 text-[11px] text-neutral-500">Wear: {c.fatigue.reasons.join(" · ")}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={() => onJumpAd(c.adId)} className="min-h-9 text-xs font-semibold text-cyan-300 hover:underline">
          See it on the page
        </button>
        <a href={c.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline">
          Ads Manager <Ico d={EXT} size={11} />
        </a>
      </div>
    </div>
  );
}

// ── Leads list ───────────────────────────────────────────

function LeadsBlock({ b }: { b: Extract<ChatBlock, { kind: "leads" }> }) {
  const [all, setAll] = useState(false);
  const rows = all ? b.rows : b.rows.slice(0, 8);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs font-bold text-white">
        {b.total} lead{b.total === 1 ? "" : "s"} credited to “{b.adName}” <span className="font-semibold text-neutral-400">· last {b.days} days · {b.booked} booked</span>
      </p>
      {b.rows.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400">No CRM leads credited to it in that time.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {rows.map((r) => (
            <LeadRow key={r.contactId || r.at} r={r} />
          ))}
        </ul>
      )}
      {b.rows.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 min-h-9 text-xs font-semibold text-cyan-300 hover:underline">
          {all ? "Show fewer" : `Show all ${b.rows.length}`}
        </button>
      )}
      {b.total > b.rows.length && <p className="mt-1 text-[11px] text-neutral-500">Showing the newest {b.rows.length}.</p>}
    </div>
  );
}

function LeadRow({ r }: { r: LeadRowData }) {
  const when = new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${r.removed === "lead" ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-semibold text-white ${r.removed === "lead" ? "line-through" : ""}`}>{r.name}</p>
        <p className="truncate text-[11px] text-neutral-500">
          {r.email ?? "no email"} · {when}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {r.booked && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.removed === "booking" ? "bg-white/5 text-neutral-500 line-through" : "bg-emerald-500/15 text-emerald-200"}`}>Booked</span>}
        {r.won && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">Won</span>}
        {r.removed && <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-100">{r.removed === "lead" ? "Not counted" : "Booking not counted"}</span>}
        {r.ghlUrl && (
          <a href={r.ghlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 px-1 text-[11px] font-semibold text-cyan-300 hover:underline">
            CRM <Ico d={EXT} size={10} />
          </a>
        )}
      </div>
    </li>
  );
}

// ── A change Claude suggested ────────────────────────────

const KIND_LABEL: Record<ChangeView["kind"], string> = {
  lead_not_real: "Fix tracking",
  booking_not_real: "Fix tracking",
  call_override: "Your call",
  goals: "Goals",
};

function ChangeCard({ c, onAct, compact = false }: { c: ChangeView; onAct: (id: string, action: "apply" | "dismiss" | "undo") => Promise<string | null>; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (action: "apply" | "dismiss" | "undo") => {
    setBusy(action);
    setErr(null);
    setErr(await onAct(c.id, action));
    setBusy(null);
  };
  const tone =
    c.status === "proposed" ? "border-cyan-400/35 bg-cyan-500/[0.07]" : c.status === "applied" ? "border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03] opacity-70";
  return (
    <div className={`rounded-2xl border ${compact ? "p-2.5" : "p-3"} ${tone}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-200">
            {KIND_LABEL[c.kind]}
            <span className="ml-2 font-bold normal-case tracking-normal text-neutral-400">
              {c.status === "proposed" ? "· waiting for you" : c.status === "applied" ? `· applied${c.appliedAt ? ` ${new Date(c.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}` : c.status === "undone" ? "· undone" : "· dismissed"}
            </span>
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{c.summary}</p>
          {c.reason && !compact && <p className="mt-0.5 text-xs text-neutral-400">Why: {c.reason}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {c.status === "proposed" && (
            <>
              <button type="button" disabled={Boolean(busy)} onClick={() => void run("apply")} className="min-h-10 rounded-full bg-cyan-500 px-4 text-xs font-bold text-[#04121a] hover:bg-cyan-400 disabled:opacity-50">
                {busy === "apply" ? "Applying…" : "Apply"}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void run("dismiss")} className="min-h-10 rounded-full px-3 text-xs font-semibold text-neutral-300 hover:text-white disabled:opacity-50">
                Not now
              </button>
            </>
          )}
          {c.status === "applied" && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("undo")} className="min-h-10 rounded-full border border-white/15 px-4 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50">
              {busy === "undo" ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      </div>
      {c.status === "applied" && c.kind === "call_override" && !compact && <p className="mt-1.5 text-[11px] text-neutral-400">On Today&apos;s plan now. Cutting still means turning it off in Ads Manager.</p>}
      {c.status === "applied" && (c.kind === "lead_not_real" || c.kind === "booking_not_real") && !compact && (
        <p className="mt-1.5 text-[11px] text-neutral-400">Left out of the plan, the cards and the scorecard now; the morning email counts it from tomorrow.</p>
      )}
      {err && <p className="mt-1.5 text-xs text-rose-200">{err}</p>}
    </div>
  );
}

// ── Everything Marcel changed ────────────────────────────

function Corrections({ list, onAct }: { list: ChangeView[]; onAct: (id: string, action: "apply" | "dismiss" | "undo") => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const waiting = list.filter((c) => c.status === "proposed");
  const applied = list.filter((c) => c.status === "applied");
  if (!waiting.length && !applied.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-4 text-left">
        <span className="text-sm font-bold text-white" style={SYNE}>
          Your corrections
        </span>
        <span className="text-xs text-neutral-400" style={NUM_FONT}>
          {[applied.length ? `${applied.length} in force` : null, waiting.length ? `${waiting.length} waiting for you` : null].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto text-xs font-semibold text-cyan-300">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {[...waiting, ...applied].map((c) => (
            <ChangeCard key={c.id} c={c} onAct={onAct} compact />
          ))}
        </div>
      )}
    </div>
  );
}
