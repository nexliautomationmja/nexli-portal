"use client";

import { Rocket, Signature } from "lucide-react";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  GradientText,
  KpiGrid,
  KpiTile,
  List,
  MiniStat,
  Notice,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  NUM_FONT,
  type Column,
} from "@/components/rainmaker";
import {
  clientNameFor,
  formatDate,
  itemsOutstanding,
  itemsToReview,
  phaseCounts,
  progressPercent,
  rowDue,
  type EngagementRow,
  type RawOnboardingState,
} from "./onboarding-types";

export interface OnboardingViewProps {
  state: "loading" | "error" | "ready";
  /** Engagements with a Launch Pad. */
  active: EngagementRow[];
  /** Signed engagements without one yet. */
  startable: EngagementRow[];
  /** Engagement whose Launch Pad is being started. */
  starting: string | null;
  onOpen: (engagementId: string) => void;
  onStart: (engagementId: string) => void;
  onRetry: () => void;
}

const ob = (e: EngagementRow) => e.metadata!.onboarding as RawOnboardingState;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${percent}%` }} />
    </div>
  );
}

function ProgressCell({ e }: { e: EngagementRow }) {
  const s = ob(e);
  const pct = progressPercent(s);
  const { done, total } = phaseCounts(s);
  return (
    <div className="w-36">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-white" style={NUM_FONT}>
          {pct}%
        </span>
        <span className="text-[10px] text-neutral-400">
          {done}/{total} phases
        </span>
      </div>
      <ProgressBar percent={pct} />
    </div>
  );
}

/** What the client owes / sent, in words. */
function ItemsCell({ e }: { e: EngagementRow }) {
  const s = ob(e);
  const review = itemsToReview(s);
  const owed = itemsOutstanding(s);
  return (
    <div className="flex flex-wrap gap-1">
      {review > 0 && (
        <Chip tone="amber" size="xs" dot>
          {review} to review
        </Chip>
      )}
      {owed > 0 ? (
        <Chip size="xs">{plural(owed, "item")} owed</Chip>
      ) : (
        review === 0 && (
          <Chip tone="green" size="xs" dot>
            All in
          </Chip>
        )
      )}
    </div>
  );
}

function DueCell({ e }: { e: EngagementRow }) {
  const s = ob(e);
  const due = rowDue(s);
  return (
    <div className="space-y-1">
      <div className="whitespace-nowrap text-neutral-200">{formatDate(s.clientDueAt)}</div>
      {due && due.label !== "All in" && (
        <Chip tone={due.tone} size="xs" dot>
          {due.label}
        </Chip>
      )}
    </div>
  );
}

function LaunchCell({ e }: { e: EngagementRow }) {
  const s = ob(e);
  return (
    <div className="space-y-1">
      <div className="whitespace-nowrap text-neutral-200">{formatDate(s.targetLaunchDate)}</div>
      {s.campaignLaunchedAt && (
        <Chip tone="green" size="xs" dot>
          Ads live {formatDate(s.campaignLaunchedAt)}
        </Chip>
      )}
    </div>
  );
}

function ClientCell({ e, onOpen }: { e: EngagementRow; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen(e.id);
      }}
      className="block max-w-full text-left"
    >
      <span className="block truncate font-semibold text-white hover:text-cyan-200 hover:underline">{clientNameFor(e)}</span>
      <span className="block truncate text-[11px] text-neutral-400">{e.subject}</span>
    </button>
  );
}

/** Phones and tablets: one card per Launch Pad. */
function LaunchPadCard({ e, onOpen }: { e: EngagementRow; onOpen: (id: string) => void }) {
  const s = ob(e);
  const pct = progressPercent(s);
  const { done, total } = phaseCounts(s);
  const due = rowDue(s);
  return (
    <button type="button" onClick={() => onOpen(e.id)} className="block w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{clientNameFor(e)}</div>
          <div className="truncate text-[11px] text-neutral-400">{e.subject}</div>
        </div>
        <span className="shrink-0 text-lg font-bold text-white" style={NUM_FONT}>
          {pct}%
        </span>
      </div>
      <div className="mt-2.5">
        <ProgressBar percent={pct} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <MiniStat label="Phases" value={`${done}/${total}`} />
        <MiniStat label="Items due" value={formatDate(s.clientDueAt)} tone={due?.tone === "red" ? "red" : due?.tone === "amber" ? "amber" : "neutral"} sub={due && due.label !== "All in" ? due.label : undefined} />
        <MiniStat label="Launch" value={formatDate(s.targetLaunchDate)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <ItemsCell e={e} />
        {s.campaignLaunchedAt && (
          <Chip tone="green" size="xs" dot>
            Ads live {formatDate(s.campaignLaunchedAt)}
          </Chip>
        )}
      </div>
    </button>
  );
}

export function OnboardingView(p: OnboardingViewProps) {
  const loading = p.state === "loading";
  const states = p.active.map(ob);
  const kpis = {
    active: p.active.length,
    review: states.reduce((n, s) => n + itemsToReview(s), 0),
    overdue: states.filter((s) => rowDue(s)?.tone === "red").length,
    live: states.filter((s) => s.campaignLaunchedAt).length,
  };

  const columns: Column<EngagementRow>[] = [
    { key: "client", header: "Client", sticky: true, className: "max-w-[260px]", cell: (e) => <ClientCell e={e} onOpen={p.onOpen} /> },
    { key: "progress", header: "Progress", cell: (e) => <ProgressCell e={e} /> },
    { key: "items", header: "Client items", cell: (e) => <ItemsCell e={e} /> },
    { key: "due", header: "Items due", cell: (e) => <DueCell e={e} /> },
    { key: "launch", header: "Launch", cell: (e) => <LaunchCell e={e} /> },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      align: "right",
      cell: (e) => (
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Open ${clientNameFor(e)}'s Launch Pad`}
          onClick={(ev) => {
            ev.stopPropagation();
            p.onOpen(e.id);
          }}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <Rocket className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Onboarding" }}
          title={
            <>
              Every build, <GradientText>on track.</GradientText>
            </>
          }
          sub="Each client's Launch Pad: where the build stands, what they've sent in, and what's still owed."
        />

        <Section
          id="launch-pads"
          eyebrow="Launch Pads"
          title="Where every build stands"
          sub="Open one to move a phase along, review what the client sent, or post an update they'll see."
        >
          <KpiGrid className="mb-4">
            <KpiTile label="Launch Pads" value={kpis.active} loading={loading} sub="in progress" />
            <KpiTile label="To review" value={kpis.review} tone={kpis.review > 0 ? "amber" : "neutral"} loading={loading} sub="items clients sent in" />
            <KpiTile label="Past due" value={kpis.overdue} tone={kpis.overdue > 0 ? "red" : "neutral"} loading={loading} sub="clients with items still owed" />
            <KpiTile label="Ads live" value={kpis.live} tone={kpis.live > 0 ? "green" : "neutral"} loading={loading} sub="campaigns launched" />
          </KpiGrid>

          {p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't load your Launch Pads"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              The connection may have dropped. Nothing was changed.
            </Notice>
          ) : (
            <DataTable
              caption="Active Launch Pads"
              columns={columns}
              rows={p.active}
              rowKey={(e) => e.id}
              onRowClick={(e) => p.onOpen(e.id)}
              card={(e) => <LaunchPadCard e={e} onOpen={p.onOpen} />}
              loading={loading}
              cardGrid
              empty={
                <EmptyState
                  icon={<Rocket className="h-5 w-5" aria-hidden="true" />}
                  title="No Launch Pads yet"
                  body={p.startable.length ? "Start one for a signed client below." : "A Launch Pad opens once a client signs (DRS: once the setup invoice is paid)."}
                />
              }
            />
          )}
        </Section>

        {p.state === "ready" && p.startable.length > 0 && (
          <Section id="ready" eyebrow="Signed" title="Ready to onboard" sub="Signed letters whose Launch Pad hasn't started yet.">
            <List>
              {p.startable.map((e) => {
                const auto = e.metadata?.billingPlan === "monthly" || e.metadata?.billingPlan === "annual";
                return (
                  <div key={e.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/15 text-emerald-300 sm:flex">
                      <Signature className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{clientNameFor(e)}</div>
                      <div className="truncate text-xs text-neutral-400">{e.subject}</div>
                      {auto && <div className="mt-1 text-[11px] text-cyan-300">Opens by itself when the setup invoice is paid</div>}
                    </div>
                    <Button
                      variant={auto ? "secondary" : "primary"}
                      size="sm"
                      busy={p.starting === e.id}
                      disabled={Boolean(p.starting) && p.starting !== e.id}
                      onClick={() => p.onStart(e.id)}
                      className="self-start sm:self-center"
                    >
                      <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.starting === e.id ? "Starting…" : auto ? "Start now anyway" : "Start onboarding"}
                    </Button>
                  </div>
                );
              })}
            </List>
          </Section>
        )}
      </PageColumn>
    </RainmakerCanvas>
  );
}
