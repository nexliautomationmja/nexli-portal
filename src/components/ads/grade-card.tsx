"use client";

import { useState } from "react";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { money, pct } from "@/lib/ads/format";
import { BAND, OUTCOME, RUBRIC_LABEL, type Band, type EvidenceRef, type GradeView } from "@/lib/ads/grader-shared";
import { Glass, Ico, Meter } from "@/components/ads/parts";
import { videosHref } from "@/components/ads/handoff";
import { VIZ } from "@/components/ads/viz";

/** One graded creative: the score, every line with its evidence, the closest past videos, the fixes, and how it does once it's live. */

export const BAND_COLOR: Record<Band, string> = { run: VIZ.status.good, fix: VIZ.status.warning, skip: VIZ.status.critical };
const BAND_INK: Record<Band, string> = { run: "#bbf7d0", fix: "#fde68a", skip: "#fecaca" };
const BAND_ICON: Record<Band, React.ReactNode> = {
  run: <path d="M20 6 9 17l-5-5" />,
  fix: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5Z" />,
  skip: <path d="M18 6 6 18M6 6l12 12" />,
};
const STATUS_TEXT: Record<string, string> = {
  queued: "Waiting to start…",
  watching: "Watching it — stills of the first 3 seconds and every word…",
  reading: "Reading what's in it…",
  grading: "Grading it against your videos and your niche (about a minute)…",
};
const EXT = <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />;

export function ScoreRing({ score, band, size = 64 }: { score: number; band: Band; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${score} out of 100 — ${BAND[band].label}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BAND_COLOR[band]} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={size * 0.32} fontWeight={700} style={NUM_FONT}>
        {score}
      </text>
    </svg>
  );
}

export function BandPill({ band, small }: { band: Band; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-black uppercase tracking-wide ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{ color: BAND_INK[band], borderColor: `${BAND_COLOR[band]}80`, background: `${BAND_COLOR[band]}22` }}
    >
      <Ico d={BAND_ICON[band]} size={small ? 10 : 12} />
      {BAND[band].label}
    </span>
  );
}

function refText(ref: string, e: (EvidenceRef & { frameUrl?: string | null }) | undefined): string {
  if (!e) return ref;
  if (e.kind === "ad") {
    const res = e.booked ? `${e.booked} booked${e.cpbCents ? ` at ${money(e.cpbCents)}` : ""}` : e.leads ? `${e.leads} leads${e.cplCents ? ` at ${money(e.cplCents)}` : ""}` : "no leads";
    return `“${e.name}” — ${OUTCOME[e.label].label.toLowerCase()}: ${res} on ${money(e.spendCents)}${e.hookRate !== null ? `, ${pct(e.hookRate)} watched 3 s` : ""}${e.ctr !== null ? `, CTR ${pct(e.ctr)}` : ""}`;
  }
  if (e.kind === "niche") return `${e.advertiser}${e.daysActive ? ` — running ${e.daysActive} days` : ""}: “${e.hook}”`;
  if (e.kind === "frame") return `The still at ${e.t} s`;
  return e.text;
}

function refShort(ref: string, e: EvidenceRef | undefined): string {
  if (!e) return ref;
  if (e.kind === "ad") return e.name.length > 28 ? `${e.name.slice(0, 27)}…` : e.name;
  if (e.kind === "niche") return e.advertiser.length > 24 ? `${e.advertiser.slice(0, 23)}…` : e.advertiser;
  if (e.kind === "frame") return `${e.t} s`;
  return ref.startsWith("S") ? "Your stats" : ref.startsWith("P") ? "Niche pattern" : "The file";
}

function EvidenceChip({ r, g, onJumpAd }: { r: { ref: string; point: string }; g: GradeView; onJumpAd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const e = g.refs[r.ref];
  const tone = e?.kind === "ad" ? "border-cyan-400/25 bg-cyan-500/[0.07] text-cyan-100" : e?.kind === "niche" ? "border-violet-400/25 bg-violet-500/[0.08] text-violet-100" : "border-white/10 bg-white/[0.05] text-neutral-200";
  return (
    <span className="inline-block max-w-full align-top">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`inline-flex min-h-7 max-w-full items-center gap-1 truncate rounded-full border px-2 text-[11px] font-semibold ${tone}`} aria-expanded={open}>
        {refShort(r.ref, e)}
      </button>
      {open && (
        <span className="mt-1 block rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] leading-snug text-neutral-300">
          <span className="block text-neutral-100">{r.point}</span>
          <span className="mt-1 block text-neutral-400">{refText(r.ref, e)}</span>
          {e?.kind === "ad" && e.adIds[0] && (
            <button type="button" onClick={() => onJumpAd(e.adIds[0])} className="mt-1 font-semibold text-cyan-300 hover:underline">
              Show this ad
            </button>
          )}
          {e?.kind === "niche" && e.url && (
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-violet-300 hover:underline">
              Open in the Ad Library <Ico d={EXT} size={10} />
            </a>
          )}
        </span>
      )}
    </span>
  );
}

export function GradeCard({
  g,
  studioKey,
  videoAds,
  defaultOpen,
  onJumpAd,
  onLink,
  onRetry,
  onDelete,
}: {
  g: GradeView;
  studioKey: string;
  videoAds: { id: string; name: string }[];
  defaultOpen?: boolean;
  onJumpAd: (id: string) => void;
  onLink: (id: string, adIds: string[]) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [copied, setCopied] = useState(false);
  const [pick, setPick] = useState("");
  const gr = g.grade;
  const thumb = (
    <span className="relative flex h-24 w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {g.thumb ? <img src={g.thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Ico d={<path d="m22 8-6 4 6 4V8ZM2 6h14v12H2z" />} size={16} className="text-neutral-500" />}
    </span>
  );

  if (!gr || g.status !== "done") {
    return (
      <Glass className="flex gap-3 p-3.5">
        {thumb}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{g.title}</p>
          {g.status === "failed" ? (
            <>
              <p className="mt-1 text-xs text-rose-200">{g.error ?? "It stopped before it finished."}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onRetry(g.id)} className="min-h-9 rounded-full bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15">
                  Try again
                </button>
                <button type="button" onClick={() => onDelete(g.id)} className="min-h-9 px-2 text-xs font-semibold text-neutral-400 hover:text-white">
                  Remove
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-xs text-cyan-100">
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
              {STATUS_TEXT[g.status] ?? "Working…"}
            </p>
          )}
          {g.status !== "failed" && g.error && <p className="mt-1 text-[11px] text-amber-200/80">{g.error}</p>}
        </div>
      </Glass>
    );
  }

  const href = gr.fixedBrief ? videosHref(studioKey, gr.fixedBrief, 1) : null;
  return (
    <Glass className="p-3.5 sm:p-4">
      <div className="flex gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white sm:text-base" style={SYNE}>
                {g.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <BandPill band={gr.band} />
                <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                  {new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {g.durationS ? ` · ${Math.round(g.durationS)} s` : ""} · {gr.confidence} confidence
                </span>
              </div>
            </div>
            <ScoreRing score={gr.score} band={gr.band} />
          </div>
          <p className="mt-2 text-sm leading-snug text-neutral-100">{gr.verdictLine}</p>
        </div>
      </div>

      {gr.caps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {gr.caps.map((c) => (
            <span key={c.key} className="rounded-full border border-rose-400/30 bg-rose-500/[0.1] px-2.5 py-1 text-[11px] font-semibold text-rose-100" title={c.why}>
              Capped at {c.max}: {c.label}
            </span>
          ))}
        </div>
      )}

      {gr.fixes.length > 0 && (
        <div className="mt-3 rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-200">Make it better</p>
            {gr.fixedScore > gr.score && (
              <span className="flex items-center gap-1.5 text-[11px] text-neutral-300" style={NUM_FONT}>
                Fixed version ≈ <span className="font-bold text-white">{gr.fixedScore}</span> <BandPill band={gr.fixedBand} small />
              </span>
            )}
          </div>
          <ol className="mt-2 space-y-2">
            {gr.fixes.map((f, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-neutral-200">
                <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white" style={NUM_FONT}>
                  {f.points > 0 ? `+${f.points}` : "±0"}
                </span>
                <span className="min-w-0">
                  <span className="font-bold text-white">{f.title}</span> — {f.what}
                </span>
              </li>
            ))}
          </ol>
          {gr.upsideWhy && (
            <p className="mt-2 text-[11px] text-neutral-400">
              Upside: <span className="font-semibold text-neutral-200">{gr.upside}</span> — {gr.upsideWhy}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {href && (
              <a href={href} className="inline-flex min-h-10 items-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500">
                Make the fixed version
              </a>
            )}
            {gr.fixedBrief && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(gr.fixedBrief).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="min-h-10 px-2 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                {copied ? "Copied" : "Copy the brief"}
              </button>
            )}
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 min-h-9 text-xs font-semibold text-cyan-300 hover:underline" aria-expanded={open}>
        {open ? "Hide the breakdown" : "See why — line by line, with the evidence"}
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          <ul className="space-y-3">
            {gr.subs.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white">{RUBRIC_LABEL[s.key]}</span>
                  <span className="text-neutral-400" style={NUM_FONT}>
                    {Math.round(s.points)} / {s.weight}
                  </span>
                </div>
                <div className="mt-1">
                  <Meter value={s.score / 10} color={s.score >= 7 ? VIZ.status.good : s.score >= 5 ? VIZ.current : VIZ.status.critical} label={`${RUBRIC_LABEL[s.key]} ${s.score} of 10`} />
                </div>
                <p className="mt-1 text-xs leading-snug text-neutral-300">{s.why}</p>
                {s.noEvidence && <p className="mt-0.5 text-[11px] text-amber-200/80">No evidence cited — held to 5 of 10 and judged on craft alone.</p>}
                {s.evidence.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.evidence.map((r, i) => (
                      <EvidenceChip key={`${r.ref}-${i}`} r={r} g={g} onJumpAd={onJumpAd} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {g.nearest.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Closest of your videos</p>
              <div className="flex gap-2">
                {g.nearest.map((n) => (
                  <button
                    key={n.ref}
                    type="button"
                    onClick={() => {
                      const e = g.refs[n.ref];
                      if (e?.kind === "ad" && e.adIds[0]) onJumpAd(e.adIds[0]);
                    }}
                    className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-1.5 text-left hover:bg-white/[0.05]"
                    style={{ width: "31%", maxWidth: 132 }}
                  >
                    <span className="block aspect-[9/16] w-full overflow-hidden rounded-md bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {n.frameUrl && <img src={n.frameUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-white">{n.name}</span>
                    <span className="block text-[10px] text-neutral-400">
                      {OUTCOME[n.label].label} · {Math.round(n.similarity * 100)}% alike
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-neutral-500">{gr.caveat}</p>
        </div>
      )}

      {/* Once it's live */}
      <div className="mt-3 border-t border-white/5 pt-3">
        {g.linked ? (
          <div className="text-xs text-neutral-300">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-white">Live:</span> {g.linked.names.join(", ")}
              {g.linked.call && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{g.linked.call}</span>}
            </p>
            <p className="mt-1 text-neutral-400" style={NUM_FONT}>
              {money(g.linked.spendCents)} spent · {g.linked.impressions.toLocaleString("en-US")} views · {g.linked.hookRate !== null ? `${pct(g.linked.hookRate)} watched 3 s · ` : ""}CTR {pct(g.linked.ctr)} · {g.linked.leads} lead{g.linked.leads === 1 ? "" : "s"} · {g.linked.booked ?? "?"} booked — {OUTCOME[g.linked.label].label}
              {g.linked.rankings?.quality ? ` · Meta quality ranking: ${g.linked.rankings.quality.toLowerCase()}` : ""}
            </p>
            <button type="button" onClick={() => onLink(g.id, [])} className="mt-1 min-h-8 text-[11px] font-semibold text-neutral-500 hover:text-white">
              Unlink
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {g.suggestions[0] && (
              <button type="button" onClick={() => onLink(g.id, [g.suggestions[0].id])} className="min-h-9 rounded-full border border-cyan-400/30 bg-cyan-500/[0.08] px-3 font-semibold text-cyan-100 hover:bg-cyan-500/[0.15]">
                Live as “{g.suggestions[0].name}”? Link it
              </button>
            )}
            <select
              value={pick}
              onChange={(e) => {
                setPick(e.target.value);
                if (e.target.value) onLink(g.id, [e.target.value]);
              }}
              className="min-h-9 max-w-full rounded-full border border-white/10 bg-white/[0.05] px-3 text-base text-neutral-200 sm:text-xs"
              aria-label="Which live ad is this?"
            >
              <option value="">{g.suggestions[0] ? "Or pick the ad…" : "Running in Meta? Pick the ad to track it…"}</option>
              {videoAds.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onDelete(g.id)} className="ml-auto min-h-9 px-1 text-[11px] font-semibold text-neutral-500 hover:text-white">
              Remove
            </button>
          </div>
        )}
      </div>
    </Glass>
  );
}
