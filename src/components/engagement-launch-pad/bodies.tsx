// ─── Section body renderers ────────────────────────────────
// Every paragraph is rendered verbatim; these only change the layout.

import { ACCENT, Icon, IconChip, PATHS, labelCls, type Accent } from "@/components/launch-pad";
import { LETTER_ICONS as X } from "./icons";
import { READ_FONT, NUM_FONT } from "./styles";
import { AMOUNT_RE, GROUP_TITLES, parseClause, type Clause } from "./parse";

const GROUP_META: Record<string, { icon: React.ReactNode; accent: Accent }> = {
  "Platform Build": { icon: PATHS.monitor, accent: "blue" },
  Automations: { icon: PATHS.bot, accent: "violet" },
  "Content Front-Load": { icon: PATHS.zap, accent: "cyan" },
  "Advertising Engineering": { icon: X.megaphone, accent: "amber" },
};

// ─── Clause renderers ──────────────────────────────────────

export function LetterBadge({ letter }: { letter: string }) {
  return (
    <span className="mt-0.5 w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px] font-black text-neutral-300 bg-white/5 border border-white/10">
      {letter}
    </span>
  );
}

export function ClauseText({ c }: { c: Clause }) {
  return (
    <p className="text-[15px] leading-7 text-neutral-200 whitespace-pre-line" style={READ_FONT}>
      {c.label && (
        <strong className="font-bold text-white">
          {c.label}
          {c.sep === ":" ? ":" : ""}
        </strong>
      )}
      {c.label && c.sep === " — " ? " — " : ""}
      {c.rest}
    </p>
  );
}

export function ClauseRow({ c }: { c: Clause }) {
  return (
    <div className="flex items-start gap-3">
      <LetterBadge letter={c.letter} />
      <div className="flex-1 min-w-0">
        <ClauseText c={c} />
      </div>
    </div>
  );
}

export function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-[13px] sm:text-sm leading-relaxed text-neutral-300 whitespace-pre-line">
      {text}
    </p>
  );
}

export function GenericBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => {
        if (GROUP_TITLES.has(p)) {
          return (
            <h4 key={i} className="pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {p}
            </h4>
          );
        }
        const c = parseClause(p);
        return c ? <ClauseRow key={i} c={c} /> : <Paragraph key={i} text={p} />;
      })}
    </div>
  );
}

/** Section 2: clause rows with the dollar amount pulled out to the right. */
export function FeeBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="divide-y divide-white/10">
      {paragraphs.map((p, i) => {
        const c = parseClause(p);
        if (!c) {
          return (
            <div key={i} className="py-3">
              <Paragraph text={p} />
            </div>
          );
        }
        const amount = p.match(AMOUNT_RE)?.[0] ?? null;
        const afterAmount = amount ? p.slice(p.indexOf(amount) + amount.length, p.indexOf(amount) + amount.length + 20) : "";
        const unit = /USD\/month/.test(afterAmount)
          ? "/month"
          : /USD\/year/.test(afterAmount)
            ? "/year"
            : /one-time/.test(afterAmount)
              ? "one-time"
              : "";
        return (
          <div key={i} className="py-4 first:pt-0 last:pb-0 flex flex-col-reverse sm:flex-row sm:items-start gap-3 sm:gap-5">
            <div className="flex-1 min-w-0">
              <ClauseRow c={c} />
            </div>
            {amount && (
              <div className="sm:text-right shrink-0 pl-9 sm:pl-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-white" style={NUM_FONT}>
                  {amount.replace(/\.00$/, "")}
                </div>
                {unit && (
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    {unit}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PhaseCallout({ text, accent }: { text: string; accent: Accent }) {
  // "Phase 1 — Implementation (covered by …). Launched within …" → bold lead-in.
  const cut = text.indexOf(". ");
  const lead = cut > 0 ? text.slice(0, cut + 1) : text;
  const rest = cut > 0 ? text.slice(cut + 1) : "";
  return (
    <div className={`rounded-xl px-4 py-3 ${ACCENT[accent].noteStrip}`}>
      <p className="text-[13px] sm:text-sm leading-relaxed text-neutral-300">
        <strong className="font-bold text-white">{lead}</strong>
        {rest}
      </p>
    </div>
  );
}

/** Section 1: Phase callouts + SETUP_SCOPE groups as a 2-column sub-card grid. */
export function ScopeBody({ paragraphs }: { paragraphs: string[] }) {
  const intro: string[] = [];
  const phase1: string[] = [];
  const phase2: string[] = [];
  const tail: string[] = [];
  const groups: { title: string; clauses: Clause[] }[] = [];
  for (const p of paragraphs) {
    if (p.startsWith("Phase 1 — ")) phase1.push(p);
    else if (p.startsWith("Phase 2 — ")) phase2.push(p);
    else if (GROUP_TITLES.has(p)) groups.push({ title: p, clauses: [] });
    else {
      const c = parseClause(p);
      if (c && groups.length) groups[groups.length - 1].clauses.push(c);
      else if (!groups.length && !phase1.length) intro.push(p);
      else tail.push(p); // anything unexpected still renders, verbatim
    }
  }
  return (
    <div className="space-y-4">
      {intro.map((p, i) => (
        <Paragraph key={`i${i}`} text={p} />
      ))}
      {phase1.map((p, i) => (
        <PhaseCallout key={`p1${i}`} text={p} accent="blue" />
      ))}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g, gi) => {
          const meta = GROUP_META[g.title] ?? { icon: PATHS.check, accent: "blue" as Accent };
          return (
            <div key={g.title} className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="scale-75 origin-left -mr-2">
                  <IconChip accent={meta.accent} delay={`${gi * 0.3}s`}>
                    <Icon d={meta.icon} size={22} className={ACCENT[meta.accent].icon} />
                  </IconChip>
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{g.title}</h4>
              </div>
              <ul className="space-y-2.5">
                {g.clauses.map((c) => (
                  <li key={c.letter} className="flex items-start gap-2">
                    <Icon d={PATHS.check} size={14} className={`mt-1 shrink-0 ${ACCENT[meta.accent].check}`} />
                    <p className="text-sm leading-6 text-neutral-300 min-w-0" style={READ_FONT}>
                      <span className="text-[10px] font-black text-neutral-600 mr-1">{c.letter})</span>
                      {c.label ? (
                        <>
                          <strong className="font-bold text-white">
                            {c.label}
                            {c.sep === ":" ? ":" : ""}
                          </strong>
                          {c.sep === " — " ? " — " : ""}
                        </>
                      ) : null}
                      {c.rest}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {phase2.map((p, i) => (
        <PhaseCallout key={`p2${i}`} text={p} accent="violet" />
      ))}
      {tail.map((p, i) => (
        <Paragraph key={`t${i}`} text={p} />
      ))}
    </div>
  );
}

// ─── Stat tile (at-a-glance cards) ─────────────────────────

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: Accent;
}) {
  return (
    <div className={`rounded-xl p-4 ${ACCENT[accent].noteStrip}`}>
      <p className={labelCls}>{label}</p>
      <p className="text-2xl font-extrabold text-white leading-none" style={NUM_FONT}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-neutral-300">{sub}</p>
    </div>
  );
}
