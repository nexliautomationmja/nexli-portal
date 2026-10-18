// ─── "At a glance" cards ───────────────────────────────────
// The short version of the deal, shown above the letter. Convenience copy
// only; hidden for older stored revisions (showSummaries=false).

import { ACCENT, Icon, IconChip, LpCard, PATHS, SYNE, labelCls, type Accent } from "@/components/launch-pad";
import {
  RECURRING_START_DAYS,
  TERM_MONTHS,
  LAUNCH_TARGET_DAYS,
  type BillingPlan,
} from "@/lib/drs-pricing";
import {
  ENTERPRISE,
  ENTERPRISE_TIERS,
  renewalCents,
  type EnterpriseTier,
} from "@/lib/enterprise-pricing";
import { LETTER_ICONS as X } from "./icons";
import { StatTile } from "./bodies";
import { usd } from "./parse";
import { DRS_FIGURES, type LetterKind } from "./section-meta";

interface Tile {
  label: string;
  value: string;
  sub: string;
  accent: Accent;
}

interface Step {
  n: number;
  title: string;
  sub: string;
}

function GlanceCard({ tiles, steps }: { tiles: Tile[]; steps: Step[] }) {
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
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} accent={t.accent} />
        ))}
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

export function DrsAtAGlance({ plan }: { plan: BillingPlan }) {
  const { setup, upkeep, adBudget, totalMonthly, annualPrepaid, annualUpfront } = DRS_FIGURES;
  const steps: Step[] = [
    { n: 1, title: "Pay the setup fee", sub: plan === "annual" ? `${annualUpfront} at signing` : `${setup} at signing` },
    { n: 2, title: "Launch Pad opens", sub: "Submit your items within 5 days" },
    { n: 3, title: "Build & launch", sub: `Live within ${LAUNCH_TARGET_DAYS} days of your materials` },
  ];
  const tiles: Tile[] = [
    { label: "Setup fee", value: setup, sub: "one-time · due at signing", accent: "blue" },
    plan === "annual"
      ? {
          label: "Due at signing",
          value: annualUpfront,
          sub: `setup + ${annualPrepaid} prepaid year · then ${adBudget}/mo ad budget from day ${RECURRING_START_DAYS}`,
          accent: "emerald",
        }
      : {
          label: "Monthly",
          value: `${totalMonthly}/mo`,
          sub: `starts day ${RECURRING_START_DAYS} · ${upkeep} upkeep + ${adBudget} ad budget`,
          accent: "emerald",
        },
    {
      label: "Initial term",
      value: `${TERM_MONTHS[plan]} months`,
      sub: plan === "annual" ? "then renews annually" : "then month-to-month",
      accent: "violet",
    },
    {
      label: "Launch",
      value: `${LAUNCH_TARGET_DAYS} days`,
      sub: "within 21 days of receiving your materials",
      accent: "cyan",
    },
  ];
  return <GlanceCard tiles={tiles} steps={steps} />;
}

export function EnterpriseAtAGlance({ tier }: { tier: EnterpriseTier }) {
  const info = ENTERPRISE_TIERS[tier];
  const fee = usd(info.priceCents);
  const E = ENTERPRISE;
  const tiles: Tile[] = [
    { label: `${info.label} license fee`, value: fee, sub: "ACH or wire only, due at signing", accent: "blue" },
    {
      label: "Annual renewal",
      value: `${usd(renewalCents(tier))}/yr`,
      sub: `optional, after the first ${E.LICENSE_MONTHS} months · ${E.RENEWAL_PERCENT}% of the fee`,
      accent: "emerald",
    },
    {
      label: "Implementation",
      value: `${E.IMPLEMENTATION_MONTHS} months`,
      sub: `${E.IMPLEMENTATION_MONTHS}-month implementation inside a ${E.LICENSE_MONTHS}-month license`,
      accent: "violet",
    },
    {
      label: "Kickoff",
      value: `${E.KICKOFF_SCHEDULING_BUSINESS_DAYS} business days`,
      sub: `scheduled within ${E.KICKOFF_SCHEDULING_BUSINESS_DAYS} business days after funds clear`,
      accent: "cyan",
    },
  ];
  const steps: Step[] = [
    { n: 1, title: "Pay by ACH/wire", sub: `${fee} due at signing` },
    { n: 2, title: "Funds clear", sub: "Then the agreement takes effect" },
    { n: 3, title: "On-site kickoff week", sub: `Scheduled within ${E.KICKOFF_SCHEDULING_BUSINESS_DAYS} business days` },
  ];
  return <GlanceCard tiles={tiles} steps={steps} />;
}

/** The kind's at-a-glance card, or nothing (Foundation has none). */
export function LetterAtAGlance({
  kind,
  plan = "monthly",
  tier = "core",
}: {
  kind: LetterKind;
  plan?: BillingPlan;
  tier?: EnterpriseTier;
}) {
  if (kind === "drs") return <DrsAtAGlance plan={plan} />;
  if (kind === "enterprise") return <EnterpriseAtAGlance tier={tier} />;
  return null;
}
