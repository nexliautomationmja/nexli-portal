"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Users } from "lucide-react";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  GradientText,
  InfoDisclosure,
  KpiGrid,
  KpiTile,
  MiniStat,
  Notice,
  PageColumn,
  PageHero,
  PeriodChip,
  RainmakerCanvas,
  Section,
  SectionNav,
  StatusDot,
  type Column,
} from "@/components/rainmaker";
import { moneyWhole } from "@/lib/format";
import { dueTone, npsView, planView, statusView, termView, updateView } from "./tracker-status";
import type { ClientRow, DueClient, Kpis } from "./tracker-types";

export interface TrackerViewProps {
  state: "loading" | "error" | "ready";
  loadError?: string | null;
  kpis: Kpis;
  clients: ClientRow[];
  dueClients: DueClient[];
  isAdmin: boolean;
  hasDemo: boolean;
  demoBusy: boolean;
  /** Email of the row whose dashboard is being connected. */
  connecting: string | null;
  actionError: string | null;
  onDismissError: () => void;
  onRetry: () => void;
  onCreateDemo: () => void;
  onRemoveDemo: () => void;
  onAnnualTest: () => void;
  onConnect: (c: ClientRow) => void;
  onOpenClient: (c: ClientRow) => void;
  /** The Ad analytics section (its own container: it fetches). */
  adAnalytics: React.ReactNode;
  /** The UTM link builder. */
  utm: React.ReactNode;
}

const SECTIONS = [
  { id: "scorecard", label: "Scorecard" },
  { id: "clients", label: "Clients" },
  { id: "ad-analytics", label: "Ad analytics" },
  { id: "utm", label: "UTM links" },
] as const;

const clientHref = (c: ClientRow) => `/dashboard/client-tracker/${c.clientUserId}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function ClientName({ c, linkable }: { c: ClientRow; linkable: boolean }) {
  const linked = linkable && Boolean(c.clientUserId);
  return (
    <div className="min-w-0">
      {linked ? (
        <Link
          href={clientHref(c)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-full items-center gap-1 font-semibold text-white hover:text-cyan-200 hover:underline"
        >
          <span className="truncate">{c.name}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-label="Dashboard connected" />
        </Link>
      ) : (
        <span className="block truncate font-semibold text-white">{c.name}</span>
      )}
      <div className="truncate text-[11px] text-neutral-400">{c.company || c.email}</div>
    </div>
  );
}

function PlanCell({ c }: { c: ClientRow }) {
  const plan = planView(c.billingPlan);
  const status = statusView(c.status);
  return (
    <div className="space-y-1">
      {plan ? <Chip tone={plan.tone} size="xs">{plan.label}</Chip> : <span className="text-neutral-500">—</span>}
      <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-neutral-400">
        <StatusDot tone={status.tone} />
        {status.label} · {plural(c.dealsCount, "deal")}
      </div>
    </div>
  );
}

function SuccessCell({ c }: { c: ClientRow }) {
  const u = updateView(c.update);
  if (!u) return <span className="text-[11px] text-neutral-500">Connect to track</span>;
  const n = npsView(c.nps);
  return (
    <div className="space-y-1.5">
      <div>
        <Chip tone={u.tone} size="xs" dot>
          {u.label}
        </Chip>
        <div className="mt-0.5 text-[10px] text-neutral-400">{u.sub}</div>
      </div>
      <div>
        <Chip tone={n.tone} size="xs">
          {n.label}
        </Chip>
        <div className="mt-0.5 text-[10px] text-neutral-400">{n.sub}</div>
      </div>
    </div>
  );
}

function ConnectButton({ c, busy, onConnect, short = false }: { c: ClientRow; busy: boolean; onConnect: (c: ClientRow) => void; short?: boolean }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      busy={busy}
      aria-label={`Connect ${c.name}'s dashboard`}
      onClick={(e) => {
        e.stopPropagation();
        onConnect(c);
      }}
    >
      {busy ? "Connecting…" : short ? "Connect" : "Connect dashboard"}
    </Button>
  );
}

export function TrackerView(p: TrackerViewProps) {
  const { kpis, clients, isAdmin } = p;
  const ready = p.state === "ready";
  const loading = p.state === "loading";
  const active = clients.filter((c) => c.status === "active").length;
  const unpaid = clients.filter((c) => c.outstanding > 0).length;
  const updatesDue = kpis.updatesDue || p.dueClients.length;
  const byId = new Map(clients.map((c) => [c.clientUserId, c]));

  const columns: Column<ClientRow>[] = [
    { key: "client", header: "Client", sticky: true, className: "min-w-[170px] max-w-[220px]", cell: (c) => <ClientName c={c} linkable={isAdmin} /> },
    { key: "plan", header: "Plan", cell: (c) => <PlanCell c={c} /> },
    {
      key: "term",
      header: "Term",
      className: "whitespace-nowrap",
      cell: (c) => {
        const t = termView(c);
        return (
          <div className="space-y-0.5 text-[11px]">
            <div className="text-neutral-300">Started {t.started}</div>
            <div className={t.atLaunch ? "text-cyan-300" : "text-neutral-400"}>{t.atLaunch ? t.ends : `Ends ${t.ends}`}</div>
          </div>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            key: "theirs",
            header: "Their revenue",
            align: "right" as const,
            className: "whitespace-nowrap",
            cell: (c: ClientRow) =>
              c.clientUserId ? (
                <span className="font-semibold text-cyan-300">{moneyWhole(c.theirRevenue ?? 0)}</span>
              ) : (
                <ConnectButton c={c} busy={p.connecting === c.email} onConnect={p.onConnect} short />
              ),
          },
        ]
      : []),
    {
      key: "collected",
      header: "You collected",
      align: "right",
      className: "whitespace-nowrap",
      cell: (c) => (
        <div>
          <div className="font-semibold text-white">{moneyWhole(c.revenue)}</div>
          {(c.adSpendCollected ?? 0) > 0 && <div className="text-[10px] text-neutral-400">+ {moneyWhole(c.adSpendCollected ?? 0)} ad budget</div>}
        </div>
      ),
    },
    { key: "mrr", header: "Your MRR", align: "right", className: "whitespace-nowrap", cell: (c) => (c.mrr > 0 ? <span className="text-white">{moneyWhole(c.mrr)}/mo</span> : <span className="text-neutral-500">—</span>) },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      className: "whitespace-nowrap",
      cell: (c) => (c.outstanding > 0 ? <span className="font-semibold text-rose-300">{moneyWhole(c.outstanding)}</span> : <span className="text-neutral-500">—</span>),
    },
    ...(isAdmin ? [{ key: "success", header: "Client success", cell: (c: ClientRow) => <SuccessCell c={c} /> }] : []),
  ];

  const card = (c: ClientRow) => {
    const plan = planView(c.billingPlan);
    const status = statusView(c.status);
    const t = termView(c);
    const u = isAdmin ? updateView(c.update) : null;
    const n = isAdmin && u ? npsView(c.nps) : null;
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <ClientName c={c} linkable={isAdmin} />
          <div className="flex shrink-0 flex-col items-end gap-1">
            {plan && <Chip tone={plan.tone} size="xs">{plan.label}</Chip>}
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <StatusDot tone={status.tone} />
              {status.label}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Collected" value={moneyWhole(c.revenue)} />
          <MiniStat label="Your MRR" value={c.mrr > 0 ? `${moneyWhole(c.mrr)}/mo` : "—"} />
          <MiniStat label="Outstanding" value={c.outstanding > 0 ? moneyWhole(c.outstanding) : "—"} tone={c.outstanding > 0 ? "red" : "neutral"} />
        </div>
        <div className="mt-3 text-[11px] leading-relaxed text-neutral-400">
          Started {t.started} · {t.atLaunch ? <span className="text-cyan-300">term starts at launch</span> : `ends ${t.ends}`} · {plural(c.dealsCount, "deal")}
          {(c.adSpendCollected ?? 0) > 0 && ` · + ${moneyWhole(c.adSpendCollected ?? 0)} ad budget`}
        </div>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            {c.clientUserId ? (
              <span className="text-xs text-neutral-400">
                Their revenue <span className="font-semibold text-cyan-300">{moneyWhole(c.theirRevenue ?? 0)}</span>
              </span>
            ) : (
              <ConnectButton c={c} busy={p.connecting === c.email} onConnect={p.onConnect} />
            )}
            {u && (
              <Chip tone={u.tone} size="xs" dot>
                {u.label}
              </Chip>
            )}
            {n && (
              <Chip tone={n.tone} size="xs">
                {n.label}
              </Chip>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          conic={isAdmin ? "cool" : "warm"}
          pill={{ icon: <BarChart3 className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Client tracker" }}
          title={
            <>
              Every client, <GradientText>every dollar.</GradientText>
            </>
          }
          sub={
            isAdmin
              ? "Who's signed, what they pay you, and what their own dashboards are producing. Open a connected client to see inside."
              : "Everyone who's signed and paid: what they've paid you, what recurs each month, and what's still owed."
          }
          meta={
            ready ? (
              <>
                <span className="font-semibold text-neutral-200">{plural(kpis.totalClients, "client")}</span>
                <span>{active.toLocaleString("en-US")} active</span>
                <span>{plural(kpis.totalDeals, "deal")} closed</span>
                {p.hasDemo && (
                  <Chip tone="amber" size="xs">
                    Demo data
                  </Chip>
                )}
              </>
            ) : undefined
          }
        />

        <div className="mb-6 space-y-3">
          {p.actionError && (
            <Notice tone="error" onClose={p.onDismissError}>
              {p.actionError}
            </Notice>
          )}
          {ready && p.hasDemo && (
            <Notice
              tone="warn"
              title="You're looking at demo clients"
              action={
                <Button variant="secondary" size="sm" busy={p.demoBusy} onClick={p.onRemoveDemo}>
                  {p.demoBusy ? "Removing…" : "Remove demo data"}
                </Button>
              }
            >
              Sample data so you can see how the tracker works. Remove it before real clients come in.
            </Notice>
          )}
          {isAdmin && updatesDue > 0 && (
            <Notice
              tone="warn"
              title={`${plural(updatesDue, "weekly update")} due`}
              action={p.dueClients.map((d) => (
                <Link key={d.clientUserId} href={`/dashboard/client-tracker/${d.clientUserId}`} className="inline-flex min-h-9 items-center">
                  <Chip tone={dueTone(byId.get(d.clientUserId))} dot>
                    {d.name}
                  </Chip>
                </Link>
              ))}
            >
              Every client gets one a week. Open a client to write theirs.
            </Notice>
          )}
        </div>

        <SectionNav sections={SECTIONS} />

        <Section id="scorecard" eyebrow="Scorecard" title="Your book at a glance">
          <KpiGrid>
            <KpiTile
              size="hero"
              label="Your MRR"
              value={`${moneyWhole(kpis.totalMrr)}/mo`}
              loading={loading}
              chip={<PeriodChip>Right now</PeriodChip>}
              sub={ready ? `${active} of ${plural(kpis.totalClients, "client")} on a recurring plan` : undefined}
            />
            <KpiTile label="You collected" value={moneyWhole(kpis.totalRevenue)} loading={loading} sub="All time · ad budget not included" />
            <KpiTile
              label="Outstanding"
              value={moneyWhole(kpis.totalOutstanding)}
              tone={kpis.totalOutstanding > 0 ? "red" : "neutral"}
              loading={loading}
              sub={kpis.totalOutstanding > 0 ? `${plural(unpaid, "client")} with an open balance` : "All paid up"}
            />
          </KpiGrid>
          <KpiGrid cols={isAdmin ? 4 : 3} className="mt-3">
            {isAdmin && <KpiTile size="sm" label="Their revenue" tone="cyan" value={moneyWhole(kpis.totalClientRevenue || 0)} loading={loading} sub="what their dashboards collected" />}
            <KpiTile size="sm" label="Clients" value={kpis.totalClients.toLocaleString("en-US")} loading={loading} sub={`${active} active`} />
            <KpiTile size="sm" label="Deals closed" value={kpis.totalDeals.toLocaleString("en-US")} loading={loading} sub="signed engagements" />
            <KpiTile size="sm" label="Ad spend" value={moneyWhole(kpis.totalAdSpend || 0)} loading={loading} sub="collected, passed through to ads" />
          </KpiGrid>
        </Section>

        <Section
          id="clients"
          eyebrow="Book of business"
          title="Clients"
          sub={isAdmin ? "Open a connected client to see inside their dashboard." : "Everyone who has signed and paid you."}
          right={
            isAdmin && ready ? (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <Button variant="secondary" size="sm" busy={p.demoBusy} onClick={p.onAnnualTest}>
                  {p.demoBusy ? "Working…" : "Test client: $74K annual, unpaid"}
                </Button>
                <span className="text-[11px] text-neutral-400">Creates a signed annual test client and opens its unpaid invoice</span>
              </div>
            ) : undefined
          }
        >
          {p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't load your clients"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              {p.loadError || "Something went wrong reaching the server."}
            </Notice>
          ) : (
            <>
              <DataTable
                caption="Clients"
                columns={columns}
                rows={clients}
                rowKey={(c) => c.email}
                card={card}
                cardGrid
                breakpoint="xl"
                loading={loading}
                onRowClick={isAdmin ? (c) => c.clientUserId && p.onOpenClient(c) : undefined}
                empty={
                  <EmptyState
                    icon={<Users className="h-5 w-5" aria-hidden="true" />}
                    title="No clients yet"
                    body="A client appears here once they've signed an engagement and paid their invoice."
                    action={
                      !p.hasDemo ? (
                        <Button busy={p.demoBusy} onClick={p.onCreateDemo}>
                          {p.demoBusy ? "Creating…" : "Create demo clients"}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              {ready && clients.length > 0 && (
                <InfoDisclosure summary="How to read this table" className="mt-3">
                  <p>
                    <b className="text-neutral-200">Started</b> is the day the client started with you (the engagement&apos;s execution date). Letters signed from Nov 9, 2026 count
                    the term from launch, so they show <span className="text-cyan-300">Starts at launch</span> until then.
                  </p>
                  <p>
                    <b className="text-neutral-200">You collected</b> is what they&apos;ve paid you, without ad budget: the ad budget is passed through to the ads, so it isn&apos;t
                    revenue. <b className="text-neutral-200">Your MRR</b> is their recurring plan per month (annual upkeep counts as a twelfth a month).{" "}
                    <b className="text-neutral-200">Outstanding</b> is what&apos;s still open on their invoices.
                  </p>
                  {isAdmin && (
                    <p>
                      <b className="text-neutral-200">Their revenue</b> is what their own dashboard has collected from their clients. <b className="text-neutral-200">Client success</b>{" "}
                      shows the weekly update (due after 7 days, overdue after 10) and the latest NPS from the every-other-Monday survey.
                    </p>
                  )}
                </InfoDisclosure>
              )}
            </>
          )}
        </Section>

        {p.adAnalytics}

        <Section
          id="utm"
          eyebrow="Tracking"
          title="UTM link builder"
          sub="Build a tracked link for an ad or campaign. Campaign is the angle, Content is the specific ad; both show up in Ad analytics above."
        >
          {p.utm}
        </Section>
      </PageColumn>
    </RainmakerCanvas>
  );
}
