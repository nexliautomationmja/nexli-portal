"use client";

// ─── <EngagementLetterView> ────────────────────────────────
// The hero-less letter body on the Launch Pad design: parties card, one card
// per numbered section (verbatim text, optional plain-English summary), and
// the section navigation (desktop side TOC + mobile chips).

import { useEffect, useMemo, useState } from "react";
import { LpCard } from "@/components/launch-pad";
import type { BillingPlan } from "@/lib/drs-pricing";
import { drsLetterTerms } from "@/lib/engagement-defaults";
import { isPerformanceLetter, performanceLetterTerms } from "@/lib/drs-performance-letter";
import type { EnterpriseTier } from "@/lib/enterprise-pricing";
import { parseLetter } from "./parse";
import { Paragraph } from "./bodies";
import { SectionCard } from "./section-card";
import { SectionNav, useSectionNav } from "./section-nav";
import { DRS_PERFORMANCE_SECTION_META, FALLBACK_META, SECTION_META_BY_KIND, type LetterKind } from "./section-meta";

export function EngagementLetterView({
  content,
  kind,
  plan = "monthly",
  tier = "core",
  showSummaries = true,
  onReadProgress,
  signHref = "#sign",
}: {
  content: string;
  kind: LetterKind;
  plan?: BillingPlan;
  tier?: EnterpriseTier;
  /** False for older stored revisions: hides every summary strip. */
  showSummaries?: boolean;
  /** Reading progress (0–100, never decreases) for the page's hero ring. */
  onReadProgress?: (pct: number) => void;
  signHref?: string;
}) {
  const { preamble, sections } = useMemo(() => parseLetter(content), [content]);
  // DRS: the Setup Fee and bonus come from the letter itself (two pricing versions).
  const terms = useMemo(() => drsLetterTerms(content), [content]);
  // DRS on the Nov 19 2026 pricing (Agency Fee + Performance Pay) has its own summaries and figures.
  const agency = useMemo(() => (kind === "drs" && isPerformanceLetter(content) ? performanceLetterTerms(content) : null), [kind, content]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { active, readPct, listRef, registerRef } = useSectionNav(sections, expanded);

  useEffect(() => {
    onReadProgress?.(readPct);
  }, [readPct, onReadProgress]);

  const metaMap = agency ? DRS_PERFORMANCE_SECTION_META : SECTION_META_BY_KIND[kind];
  const [titleLines, ...preambleRest] = preamble;
  // Re-key cards when the letter variant changes so their entrance animates.
  const variantKey = kind === "enterprise" ? tier : agency ? `agency-${agency.billing}` : kind === "drs" ? plan : kind;

  return (
    <>
      <SectionNav sections={sections} active={active} readPct={readPct} variant="side" signHref={signHref} />
      <SectionNav sections={sections} active={active} readPct={readPct} variant="chips" />

      <div ref={listRef} className="space-y-4">
        {/* Parties (preamble, verbatim) */}
        {titleLines && (
          <LpCard className="lp-card" style={{ animationDelay: "0.12s" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 whitespace-pre-line">
              {titleLines}
            </p>
            <div className="mt-3 space-y-3">
              {preambleRest.map((p, i) => (
                <Paragraph key={i} text={p} />
              ))}
            </div>
          </LpCard>
        )}

        {sections.map((s, i) => {
          const base = metaMap[s.heading] ?? FALLBACK_META;
          const summary = showSummaries ? (base.summary?.({ plan, tier, ...terms, ...(agency ? { agency } : {}) }) ?? "") : "";
          // A clause is only tucked away behind its summary — never on its own.
          const meta = summary ? base : { ...base, collapsed: false };
          return (
            <SectionCard
              key={`${variantKey}-${s.num}`}
              section={s}
              meta={meta}
              summary={summary}
              index={i}
              expanded={!!expanded[s.num]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [s.num]: !prev[s.num] }))}
              registerRef={registerRef(s.num)}
            />
          );
        })}
      </div>
    </>
  );
}
