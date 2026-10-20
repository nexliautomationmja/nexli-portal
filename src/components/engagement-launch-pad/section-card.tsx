// ─── Section card ──────────────────────────────────────────

import { ACCENT, Icon, IconChip, LpCard, SYNE } from "@/components/launch-pad";
import { LETTER_ICONS as X } from "./icons";
import { READ_FONT } from "./styles";
import { FeeBody, GenericBody, ScopeBody } from "./bodies";
import type { Section } from "./parse";
import type { SectionMeta } from "./section-meta";

export function SectionCard({
  section,
  meta,
  summary,
  index,
  expanded,
  onToggle,
  registerRef,
}: {
  section: Section;
  meta: SectionMeta;
  /** Plain-English summary; empty string hides the strip. */
  summary: string;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const collapsible = !!meta.collapsed;
  const showBody = !collapsible || expanded;
  const bodyId = `sec-${section.num}-body`;

  let body: React.ReactNode;
  if (meta.body === "scope") body = <ScopeBody paragraphs={section.paragraphs} />;
  else if (meta.body === "fee") body = <FeeBody paragraphs={section.paragraphs} />;
  else body = <GenericBody paragraphs={section.paragraphs} />;

  return (
    <section
      id={`sec-${section.num}`}
      ref={registerRef}
      aria-labelledby={`sec-${section.num}-title`}
      style={{ scrollMarginTop: 24 }}
    >
      <LpCard className="lp-card" style={{ animationDelay: `${Math.min(0.05 * index, 0.4)}s` }}>
        <div className="flex items-start gap-3">
          <IconChip accent={meta.accent} delay={`${(index % 5) * 0.35}s`}>
            <Icon d={meta.icon} size={22} className={ACCENT[meta.accent].icon} />
          </IconChip>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Section {section.num}
            </p>
            <h2
              id={`sec-${section.num}-title`}
              className="text-lg sm:text-xl font-extrabold text-white tracking-tight"
              style={SYNE}
            >
              {section.title}
            </h2>
          </div>
        </div>

        {summary && (
          <div className="mt-4">
            <div className="rounded-xl px-4 py-3 bg-cyan-500/10 border border-cyan-500/25">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 mb-1">
                In plain English
              </p>
              <p className="text-[15px] leading-relaxed text-white [overflow-wrap:anywhere]" style={READ_FONT}>{summary}</p>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              Summary for convenience — the full text below is what you&apos;re agreeing to.
            </p>
          </div>
        )}

        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="mt-4 min-h-11 sm:min-h-0 inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? "Hide full clause" : "Read full clause"}
            <Icon
              d={X.chevronDown}
              size={14}
              className="transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        )}

        <div id={bodyId} hidden={!showBody} className="mt-4 pt-4 border-t border-white/10">
          {body}
        </div>
      </LpCard>
    </section>
  );
}
