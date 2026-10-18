"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDrsTemplate } from "@/lib/engagement-defaults";
import {
  DRS_PRICING,
  SETUP_SCOPE,
  TOTAL_MONTHLY_CENTS,
  ANNUAL_UPFRONT_CENTS,
  RECURRING_START_DAYS,
  TERM_MONTHS,
  LAUNCH_TARGET_DAYS,
  type BillingPlan,
} from "@/lib/drs-pricing";
import {
  ACCENT,
  SYNE,
  CTA_CLASSES,
  SECONDARY_BTN,
  labelCls,
  Icon,
  PATHS,
  ProgressRing,
  LpCard,
  IconChip,
  Pill,
  ShimmerCard,
  LaunchPadShell,
  useForceDark,
  type Accent,
} from "@/components/launch-pad";

// Readability (Oct 2026 review): Syne's stylised numerals read oddly, so
// figures use Plus Jakarta Sans with lining, evenly spaced digits, and the
// long-form contract text uses it too. Syne stays on word headings only.
const READ_FONT: React.CSSProperties = {
  fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
};
const NUM_FONT: React.CSSProperties = {
  fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
  fontVariantNumeric: "lining-nums tabular-nums",
  letterSpacing: "-0.01em",
};

// ══════════════════════════════════════════════════════════
// /engage/preview — DESIGN PREVIEW of a redesigned engagement-letter
// signing page on the Launch Pad visual system. Nothing is saved or sent.
// The legal text is the real, unmodified output of buildDrsTemplate(plan);
// only the presentation changes (sections parsed out of the plain text).
// ══════════════════════════════════════════════════════════

// ─── Extra lucide icons (local to this preview) ────────────

const X = {
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  scale: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
  ),
  shield: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </>
  ),
  megaphone: (
    <>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),
  plusCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </>
  ),
  penLine: (
    <>
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </>
  ),
  logOut: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  gavel: (
    <>
      <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </>
  ),
  landmark: (
    <>
      <path d="M3 22h18" />
      <path d="M6 18v-7" />
      <path d="M10 18v-7" />
      <path d="M14 18v-7" />
      <path d="M18 18v-7" />
      <path d="M12 2 20 7H4z" />
    </>
  ),
  creditCard: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};

// ─── Formatting ────────────────────────────────────────────

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const SMALL_WORDS = new Set(["of", "and", "the", "a", "an", "to", "in", "for", "on", "or"]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// ─── Parsing the plain-text letter ─────────────────────────

const HEADING_RE = /^(\d+)\. ([A-Z0-9 ,&'’\-\/()]+)$/gm;
const CLAUSE_RE = /^([a-z])\) /;
const AMOUNT_RE = /\$[\d,]+\.\d{2}/;
const GROUP_TITLES = new Set(SETUP_SCOPE.map((g) => g.title));

interface Section {
  num: number;
  heading: string; // exact heading text, e.g. "SCOPE OF SERVICES"
  title: string; // title case
  paragraphs: string[];
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseLetter(text: string): { preamble: string[]; sections: Section[] } {
  const matches = [...text.matchAll(HEADING_RE)];
  const preamble = splitParagraphs(matches.length ? text.slice(0, matches[0].index) : text);
  const sections = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    return {
      num: Number(m[1]),
      heading: m[2].trim(),
      title: titleCase(m[2].trim()),
      paragraphs: splitParagraphs(text.slice(start, end)),
    };
  });
  return { preamble, sections };
}

interface Clause {
  letter: string;
  label: string | null; // text before the first " — " or ":" (when short)
  sep: string; // the separator exactly as written
  rest: string;
}

/** Splits "a) Label: rest" / "a) Label — rest" without changing any wording. */
function parseClause(p: string): Clause | null {
  const m = p.match(CLAUSE_RE);
  if (!m) return null;
  const body = p.slice(m[0].length);
  const dash = body.indexOf(" — ");
  const colon = body.indexOf(":");
  const candidates = [dash, colon].filter((n) => n > 0);
  const at = candidates.length ? Math.min(...candidates) : -1;
  // Only treat it as a label when it's a short lead-in, not a long sentence.
  if (at > 0 && at <= 60) {
    const sep = at === dash ? " — " : ":";
    return { letter: m[1], label: body.slice(0, at), sep, rest: body.slice(at + sep.length) };
  }
  return { letter: m[1], label: null, sep: "", rest: body };
}

// ─── Section presentation config ───────────────────────────

interface SectionMeta {
  icon: React.ReactNode;
  accent: Accent;
  collapsed?: boolean;
  summary: (plan: BillingPlan) => string;
}

const setup = usd(DRS_PRICING.SETUP_FEE_CENTS);
const upkeep = usd(DRS_PRICING.MONTHLY_CENTS);
const adBudget = usd(DRS_PRICING.AD_SPEND_MONTHLY_CENTS);
const totalMonthly = usd(TOTAL_MONTHLY_CENTS);
const annualPrepaid = usd(DRS_PRICING.ANNUAL_CENTS);
const annualUpfront = usd(ANNUAL_UPFRONT_CENTS);

const SECTION_META: Record<string, SectionMeta> = {
  "SCOPE OF SERVICES": {
    icon: PATHS.rocket,
    accent: "blue",
    summary: () =>
      `Nexli builds your complete system once (Phase 1, covered by the Setup Fee) — website, funnel, client portal, CRM, automations, launch ad creative and ad engineering — and launches it within ${LAUNCH_TARGET_DAYS} days of receiving your materials. After launch, Nexli hosts, maintains and runs it all every month (Phase 2).`,
  },
  "FEE STRUCTURE": {
    icon: PATHS.circleDollar,
    accent: "emerald",
    summary: (plan) =>
      plan === "annual"
        ? `${annualUpfront} is due at signing (${setup} one-time Setup Fee + ${annualPrepaid} for a prepaid year of platform operation). Separately, the ${adBudget}/month ad budget is billed monthly starting ${RECURRING_START_DAYS} days after signing. Initial term: ${TERM_MONTHS.annual} months.`
        : `A one-time ${setup} Setup Fee is due at signing. Then ${totalMonthly}/month (${upkeep} platform + ${adBudget} ad budget) on one invoice, starting ${RECURRING_START_DAYS} days after signing. Initial term: ${TERM_MONTHS.monthly} months.`,
  },
  "AD MANAGEMENT": {
    icon: X.megaphone,
    accent: "violet",
    summary: () =>
      `Running your ads is included. Your ${adBudget}/month ad budget goes to Meta, Google, etc. at no markup; any unspent budget rolls forward to later months (it isn't refunded). Nexli takes no revenue share, bonus or performance fee — every dollar of revenue the ads produce is yours.`,
  },
  "PAYMENT TERMS": {
    icon: X.creditCard,
    accent: "cyan",
    summary: (plan) =>
      `Pay by ACH (the listed price) or card (the card price, shown at checkout). Fees are non-refundable, and work starts once ${plan === "annual" ? `the ${annualUpfront} due at signing is` : `the ${setup} Setup Fee is`} received. You can give 30 days' notice any time, but it takes effect no earlier than the end of the ${TERM_MONTHS[plan]}-month initial term; after that the agreement ${plan === "annual" ? "renews annually" : "continues month-to-month"}.`,
  },
  "PROJECT TIMELINE & CLIENT COOPERATION": {
    icon: X.calendar,
    accent: "amber",
    summary: () =>
      `Submit your Launch Pad items within 5 days of getting the link. Launch is targeted ${LAUNCH_TARGET_DAYS} days after Nexli has everything, and setup wraps within 30 days of signing. If required access or materials aren't provided in that 30-day window, setup is treated as complete.`,
  },
  "INTELLECTUAL PROPERTY": {
    icon: X.shield,
    accent: "violet",
    summary: () =>
      "Your website content, brand assets and domain stay yours. Nexli's software, automations and dashboard stay Nexli's — you get a license to use them while your subscription is active, and may not copy or resell them.",
  },
  "ADDITIONAL SERVICES": {
    icon: X.plusCircle,
    accent: "blue",
    summary: () =>
      "Anything beyond the Section 1 scope — major redesigns, new features, custom development — is quoted separately under its own written agreement.",
  },
  "LIMITATION OF LIABILITY": {
    icon: X.scale,
    accent: "amber",
    collapsed: true,
    summary: () =>
      "Nexli's liability is capped at the fees you paid in the prior 12 months and excludes indirect losses. Results (leads, revenue, ROI) are not guaranteed, and outages at third parties like Stripe or DNS providers aren't Nexli's liability.",
  },
  INDEMNIFICATION: {
    icon: X.shield,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "If a claim arises from your use of the system, a legal violation on your side, or materials you provided, you cover Nexli's resulting costs.",
  },
  CONFIDENTIALITY: {
    icon: PATHS.lock,
    accent: "emerald",
    collapsed: true,
    summary: () =>
      "Both sides keep each other's proprietary information confidential — including after the agreement ends.",
  },
  TERMINATION: {
    icon: X.logOut,
    accent: "amber",
    summary: () =>
      "Either side can end the agreement with 30 days' written notice, effective no earlier than the end of the initial term. Nexli can suspend access for non-payment or misuse. You keep your website and content; access to Nexli's systems ends.",
  },
  "DISPUTE RESOLUTION": {
    icon: X.gavel,
    accent: "violet",
    collapsed: true,
    summary: () =>
      "Disputes go to binding arbitration in Florida under American Arbitration Association rules; each side pays its own costs and attorneys' fees.",
  },
  "GOVERNING LAW": {
    icon: X.landmark,
    accent: "blue",
    collapsed: true,
    summary: () => "Florida law governs this agreement.",
  },
  "ENTIRE AGREEMENT": {
    icon: X.fileText,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "This document is the whole deal: it replaces anything discussed before, and changes must be in writing signed by both sides.",
  },
  "ELECTRONIC SIGNATURES": {
    icon: X.penLine,
    accent: "emerald",
    collapsed: true,
    summary: () =>
      "Signing electronically is legally binding, under the federal ESIGN Act and UETA.",
  },
};

const FALLBACK_META: SectionMeta = {
  icon: X.fileText,
  accent: "blue",
  summary: () => "",
};

const GROUP_META: Record<string, { icon: React.ReactNode; accent: Accent }> = {
  "Platform Build": { icon: PATHS.monitor, accent: "blue" },
  Automations: { icon: PATHS.bot, accent: "violet" },
  "Content Front-Load": { icon: PATHS.zap, accent: "cyan" },
  "Advertising Engineering": { icon: X.megaphone, accent: "amber" },
};

// ─── Clause renderers ──────────────────────────────────────

function LetterBadge({ letter }: { letter: string }) {
  return (
    <span className="mt-0.5 w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px] font-black text-neutral-300 bg-white/5 border border-white/10">
      {letter}
    </span>
  );
}

function ClauseText({ c }: { c: Clause }) {
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

function ClauseRow({ c }: { c: Clause }) {
  return (
    <div className="flex items-start gap-3">
      <LetterBadge letter={c.letter} />
      <div className="flex-1 min-w-0">
        <ClauseText c={c} />
      </div>
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-[13px] sm:text-sm leading-relaxed text-neutral-300 whitespace-pre-line">
      {text}
    </p>
  );
}

function GenericBody({ paragraphs }: { paragraphs: string[] }) {
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
function FeeBody({ paragraphs }: { paragraphs: string[] }) {
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

function PhaseCallout({ text, accent }: { text: string; accent: Accent }) {
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
function ScopeBody({ paragraphs }: { paragraphs: string[] }) {
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

// ─── Section card ──────────────────────────────────────────

function SectionCard({
  section,
  plan,
  index,
  expanded,
  onToggle,
  registerRef,
}: {
  section: Section;
  plan: BillingPlan;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const meta = SECTION_META[section.heading] ?? FALLBACK_META;
  const summary = meta.summary(plan);
  const collapsible = !!meta.collapsed;
  const showBody = !collapsible || expanded;
  const bodyId = `sec-${section.num}-body`;

  let body: React.ReactNode;
  if (section.heading === "SCOPE OF SERVICES") body = <ScopeBody paragraphs={section.paragraphs} />;
  else if (section.heading === "FEE STRUCTURE") body = <FeeBody paragraphs={section.paragraphs} />;
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
              <p className="text-[15px] leading-relaxed text-white" style={READ_FONT}>{summary}</p>
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
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
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

// ─── At a glance ───────────────────────────────────────────

function StatTile({
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

function AtAGlance({ plan }: { plan: BillingPlan }) {
  const steps = [
    { n: 1, title: "Pay the setup fee", sub: plan === "annual" ? `${annualUpfront} at signing` : `${setup} at signing` },
    { n: 2, title: "Launch Pad opens", sub: "Submit your items within 5 days" },
    { n: 3, title: "Build & launch", sub: `Live within ${LAUNCH_TARGET_DAYS} days of your materials` },
  ];
  return (
    <LpCard className="lp-card" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center gap-3 mb-4">
        <IconChip accent="emerald">
          <Icon d={PATHS.circleDollar} size={22} className={ACCENT.emerald.icon} />
        </IconChip>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">The short version</p>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight" style={SYNE}>
            At a glance
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-3">
        <StatTile label="Setup fee" value={setup} sub="one-time · due at signing" accent="blue" />
        {plan === "annual" ? (
          <StatTile
            label="Due at signing"
            value={annualUpfront}
            sub={`setup + ${annualPrepaid} prepaid year · then ${adBudget}/mo ad budget from day ${RECURRING_START_DAYS}`}
            accent="emerald"
          />
        ) : (
          <StatTile
            label="Monthly"
            value={`${totalMonthly}/mo`}
            sub={`starts day ${RECURRING_START_DAYS} · ${upkeep} upkeep + ${adBudget} ad budget`}
            accent="emerald"
          />
        )}
        <StatTile
          label="Initial term"
          value={`${TERM_MONTHS[plan]} months`}
          sub={plan === "annual" ? "then renews annually" : "then month-to-month"}
          accent="violet"
        />
        <StatTile
          label="Launch"
          value={`${LAUNCH_TARGET_DAYS} days`}
          sub="within 21 days of receiving your materials"
          accent="cyan"
        />
      </div>

      <div className="mt-6">
        <p className={labelCls}>What happens after you sign</p>
        <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2">
          {steps.map((s, i) => (
            <li key={s.n} className="flex sm:flex-1 items-center gap-2">
              <div className="flex-1 flex items-center gap-3 rounded-xl px-3 py-3 bg-white/[0.03] border border-white/10 h-full">
                <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-black text-white bg-gradient-to-br from-blue-500 to-cyan-500">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white leading-tight">{s.title}</p>
                  <p className="text-xs text-neutral-300 leading-snug">{s.sub}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <Icon d={X.arrowRight} size={14} className="hidden sm:block text-neutral-600 shrink-0" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </LpCard>
  );
}

// ─── Main ──────────────────────────────────────────────────

export function EngagePreviewClient() {
  // /engage/layout.tsx forces LIGHT mode in its own effect, which runs after
  // ours (parent effects fire after child effects) — so force dark here and
  // re-apply it on the next frame. The shell paints its own dark canvas anyway.
  useForceDark();
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add("dark"));
    return () => cancelAnimationFrame(id);
  }, []);

  const [plan, setPlan] = useState<BillingPlan>("monthly");
  const letter = useMemo(() => buildDrsTemplate(plan), [plan]);
  const { preamble, sections } = useMemo(() => parseLetter(letter), [letter]);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [active, setActive] = useState<number>(1);
  const [readPct, setReadPct] = useState(0);

  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [burst, setBurst] = useState(0);

  const sectionEls = useRef<Map<number, HTMLElement>>(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  // Active section + reading progress, from scroll position (rAF-throttled).
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      let current = sections[0]?.num ?? 1;
      for (const s of sections) {
        const el = sectionEls.current.get(s.num);
        if (el && el.getBoundingClientRect().top <= vh * 0.3) current = s.num;
      }
      setActive(current);
      const list = listRef.current;
      if (list) {
        const r = list.getBoundingClientRect();
        const atBottom =
          window.scrollY + vh >= document.documentElement.scrollHeight - 4;
        const pct = atBottom
          ? 100
          : Math.round(Math.min(1, Math.max(0, (vh - r.top) / Math.max(1, r.height))) * 100);
        setReadPct((prev) => Math.max(prev, pct));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections, expanded]);

  const canSign = name.trim().length > 1 && agreed;

  function sign() {
    if (!canSign) return;
    setSigned(true);
    setBurst((b) => b + 1);
    requestAnimationFrame(() =>
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }

  const badgeIcon = <Icon d={X.fileText} size={14} className="text-cyan-400" />;
  const [titleLines, ...preambleRest] = preamble;

  const tocLink = (s: Section, variant: "side" | "chip") => {
    const isActive = s.num === active;
    const cls =
      variant === "side"
        ? `flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12px] leading-snug transition-colors ${
            isActive ? "bg-white/10 text-white font-bold" : "text-neutral-500 hover:text-neutral-200"
          }`
        : `shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap border transition-colors ${
            isActive
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
          }`;
    return (
      <a key={s.num} href={`#sec-${s.num}`} aria-current={isActive ? "location" : undefined} className={cls}>
        <span className={variant === "side" ? "w-4 shrink-0 text-right tabular-nums text-neutral-600" : "mr-1 opacity-60"}>
          {s.num}
        </span>
        <span>{s.title}</span>
      </a>
    );
  };

  return (
    <LaunchPadShell maxWidth="3xl" badge="Engagement Agreement" badgeIcon={badgeIcon} burst={burst}>
      {/* Desktop table of contents — fixed in the left gutter (the shell's
          overflow-x-hidden wrapper would defeat position: sticky). */}
      <nav
        aria-label="Agreement sections"
        className="hidden xl:block fixed top-28 w-[208px] max-h-[calc(100vh-8rem)] overflow-y-auto z-20"
        style={{ left: "max(16px, calc(50% - 384px - 232px))" }}
      >
        <p className={`${labelCls} px-2.5`}>Sections · {readPct}% read</p>
        <div className="space-y-0.5">{sections.map((s) => tocLink(s, "side"))}</div>
        <a
          href="#sign"
          className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-blue-400 hover:text-blue-300"
        >
          <Icon d={X.penLine} size={13} /> Sign
        </a>
      </nav>

      {/* ─── Preview controls ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lp-card">
        <p className="inline-flex items-center gap-2 self-start rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Design preview — nothing here is saved or sent
        </p>
        <div
          role="group"
          aria-label="Preview billing plan"
          className="inline-flex self-start rounded-full p-1 bg-white/5 border border-white/10"
        >
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              aria-pressed={plan === p}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                plan === p ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-neutral-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Digital Rainmaker System
            </p>
            <h1
              className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1"
              style={SYNE}
            >
              Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                Service Agreement
              </span>
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-neutral-300">
              Prepared for <span className="font-semibold text-white">Sample Client</span> · Nexli Automation LLC
            </p>
            <p className="text-xs mt-2 text-neutral-500">
              {sections.length} sections · each one starts with a plain-English summary. Sign at the bottom.
            </p>
          </div>
          <ProgressRing percent={readPct} />
        </div>
      </section>

      <AtAGlance plan={plan} />

      {/* ─── Mobile / tablet section chips ─── */}
      <nav aria-label="Agreement sections" className="xl:hidden -mx-4 sm:-mx-6">
        <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {sections.map((s) => tocLink(s, "chip"))}
        </div>
      </nav>

      {/* ─── The agreement ─── */}
      <div ref={listRef} className="space-y-4">
        {/* Parties (preamble, verbatim) */}
        {titleLines && (
          <LpCard className="lp-card" style={{ animationDelay: "0.12s" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 whitespace-pre-line">
              {titleLines}
            </p>
            <div className="mt-3 space-y-3">
              {preambleRest.map((p, i) => (
                <Paragraph key={i} text={p} />
              ))}
            </div>
          </LpCard>
        )}

        {sections.map((s, i) => (
          <SectionCard
            key={`${plan}-${s.num}`}
            section={s}
            plan={plan}
            index={i}
            expanded={!!expanded[s.num]}
            onToggle={() => setExpanded((prev) => ({ ...prev, [s.num]: !prev[s.num] }))}
            registerRef={(el) => {
              if (el) sectionEls.current.set(s.num, el);
              else sectionEls.current.delete(s.num);
            }}
          />
        ))}
      </div>

      {/* ─── Signature ─── */}
      <div id="sign" ref={successRef} style={{ scrollMarginTop: 24 }}>
        {signed ? (
          <ShimmerCard className="lp-card">
            <div className="text-3xl mb-1">🎉</div>
            <h2 className="text-xl font-black text-white" style={SYNE}>
              Signed — welcome aboard
            </h2>
            <p className="text-sm mt-1 text-neutral-300">
              Next: your {setup} setup invoice and your Launch Pad link arrive by email.
            </p>
            <p className="text-[11px] mt-3 text-amber-300/80">(Preview — nothing was saved)</p>
          </ShimmerCard>
        ) : (
          <LpCard className="lp-card">
            <div className="flex items-start gap-3">
              <IconChip accent="blue">
                <Icon d={X.penLine} size={22} className={ACCENT.blue.icon} />
              </IconChip>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white flex-1 min-w-0" style={SYNE}>
                    Sign the agreement
                  </h2>
                  {canSign ? (
                    <Pill tone="done" accent="blue">
                      Ready to sign ✓
                    </Pill>
                  ) : (
                    <Pill tone="neutral">Required</Pill>
                  )}
                </div>
                <p className="text-sm mt-1 leading-relaxed text-neutral-300">
                  Type your full legal name. Your typed name is your electronic signature (Section 15).
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="sig-name" className={labelCls}>
                  Full name
                </label>
                <input
                  id="sig-name"
                  type="text"
                  autoComplete="name"
                  className="lp-input"
                  placeholder="e.g. Jordan Sample"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <p className={labelCls}>Signature preview</p>
                <div className="rounded-xl px-4 py-4 min-h-[76px] flex items-end bg-white/[0.03] border border-dashed border-white/15">
                  <span
                    className={`text-3xl sm:text-4xl leading-none truncate ${name.trim() ? "text-white" : "text-white/20"}`}
                    style={{ fontFamily: "var(--font-signature), cursive" }}
                    aria-live="polite"
                  >
                    {name.trim() || "Your signature"}
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                />
                <span className="text-sm text-neutral-300">
                  I&apos;ve read and agree to the agreement above.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <button type="button" onClick={sign} disabled={!canSign} className={CTA_CLASSES}>
                  <Icon d={X.penLine} size={16} /> Sign agreement
                </button>
                <button
                  type="button"
                  aria-disabled="true"
                  title="Available on the real page"
                  onClick={(e) => e.preventDefault()}
                  className={`${SECONDARY_BTN} inline-flex items-center justify-center gap-2 opacity-50 cursor-not-allowed hover:bg-white/5 hover:text-neutral-400`}
                >
                  <Icon d={X.download} size={15} /> Download PDF
                </button>
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-neutral-500">Secured e-signature</span>
                </div>
              </div>
            </div>
          </LpCard>
        )}
      </div>

      <footer className="text-center pb-6 space-y-2">
        <p className="text-[11px] text-neutral-500">
          Questions before you sign? Your Nexli team is one message away.
        </p>
        <p className="text-[10px] text-neutral-600">
          Nexli Automation LLC • Powered by the Digital Rainmaker System
        </p>
      </footer>
    </LaunchPadShell>
  );
}
