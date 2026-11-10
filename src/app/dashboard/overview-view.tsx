"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, FileText, KanbanSquare, KeyRound, Megaphone, PenLine, Percent, Plus, Receipt, Rocket, Users, Wallet } from "lucide-react";
import {
  BIG_NUM,
  ButtonLink,
  Chip,
  EmptyState,
  GradientText,
  KpiGrid,
  KpiTile,
  List,
  ListRow,
  Notice,
  PageColumn,
  PageHero,
  PeriodChip,
  RainmakerCanvas,
  Section,
  SectionNav,
  Skeleton,
  Surface,
  type Tone,
} from "@/components/rainmaker";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import { moneyShort } from "@/lib/ads/format";
import { moneyWhole } from "@/lib/format";
import type { GHLData } from "@/lib/hooks/use-ghl";
import type { InvoiceAnalytics } from "@/lib/hooks/use-invoice-analytics";
import type { PortalActivityItem } from "@/lib/hooks/use-portal-activity";
import type { GHLMetricsData } from "@/lib/types/ghl-metrics";

export type OverviewRole = "admin" | "drs" | "foundation";
type Loadable<T> = { loading: boolean; data: T };

export interface OverviewViewProps {
  firstName: string;
  role: OverviewRole;
  ghlConnected: boolean;
  docStats: { total: number; new: number; reviewed: number; archived: number };
  ghl: Loadable<GHLData | null>;
  metrics: Loadable<GHLMetricsData | null>;
  analytics: Loadable<InvoiceAnalytics | null>;
  activity: Loadable<PortalActivityItem[]>;
  /** Open pipeline value; null while loading, undefined if it failed. */
  pipelineValueCents: number | null | undefined;
  /** Shown on the Conversion rate tile (currently Marcel's 2% placeholder). */
  conversionRate: number;
  /** DRS firms: pulse check + latest weekly update (server-rendered). */
  thisWeek?: React.ReactNode;
  /** DRS firms: campaign progress card. */
  campaign?: React.ReactNode;
  /** Foundation firms: their build tracker. */
  build?: React.ReactNode;
  /** Admin: the Meta ads section. */
  ads?: React.ReactNode;
}

const ACTIVITY: Record<PortalActivityItem["type"], { icon: React.ReactNode; tone: Tone }> = {
  payment: { icon: <Wallet className="h-4 w-4" aria-hidden="true" />, tone: "green" },
  document: { icon: <FileText className="h-4 w-4" aria-hidden="true" />, tone: "blue" },
  engagement: { icon: <PenLine className="h-4 w-4" aria-hidden="true" />, tone: "violet" },
  login: { icon: <KeyRound className="h-4 w-4" aria-hidden="true" />, tone: "cyan" },
};

const RATING: Record<"green" | "yellow" | "red", { tone: Tone; label: string }> = {
  green: { tone: "green", label: "Fast" },
  yellow: { tone: "amber", label: "Could be faster" },
  red: { tone: "red", label: "Too slow" },
};

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const n = (v: number) => v.toLocaleString("en-US");

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-neutral-300">{label}</span>
        <span className="font-bold text-white" style={BIG_NUM}>
          {n(value)} <span className="text-xs font-semibold text-neutral-400">{max > 0 ? `${pct}%` : ""}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all duration-700 motion-reduce:transition-none`} style={{ width: `${Math.max(value > 0 ? 4 : 0, pct)}%` }} />
      </div>
    </div>
  );
}

function ConnectGhl() {
  return (
    <Notice tone="info" title="Connect GoHighLevel">
      Add your Location ID in{" "}
      <Link href="/dashboard/settings" className="font-semibold underline">
        Settings
      </Link>{" "}
      to see your leads here.
    </Notice>
  );
}

export function OverviewView(p: OverviewViewProps) {
  const admin = p.role === "admin";
  const agency = p.role !== "foundation"; // Contacts, Pipeline and the Client Tracker are agency tools
  const stats = p.analytics.data?.stats;
  const conv = p.metrics.data?.conversion;
  const speed = p.metrics.data?.speedToLead;

  const sections = [
    ...(p.thisWeek ? [{ id: "this-week", label: "This week" }] : []),
    ...(p.build ? [{ id: "build", label: "Your build" }] : []),
    { id: "glance", label: "At a glance" },
    { id: "revenue", label: "Revenue" },
    ...(p.ads ? [{ id: "ads", label: "Meta ads" }] : []),
    ...(agency ? [{ id: "leads", label: "Leads" }] : []),
    { id: "recent", label: "Recent" },
  ];

  const contacts = !p.ghlConnected
    ? { value: "—", sub: "Connect GoHighLevel in Settings" }
    : p.ghl.loading
      ? { value: "", sub: undefined }
      : p.ghl.data
        ? { value: n(p.ghl.data.leadsCount), sub: "in GoHighLevel" }
        : { value: "—", sub: "Couldn't load right now" };

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          conic={admin ? "cool" : "warm"}
          pill={{ icon: <Rocket className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Digital Rainmaker System" }}
          title={
            <>
              Welcome back, <GradientText>{p.firstName}.</GradientText>
            </>
          }
          sub={
            admin
              ? "Your business at a glance: clients, revenue, pipeline and ads."
              : p.role === "drs"
                ? "What your Digital Rainmaker System is producing, and what's next."
                : "Your firm's portal at a glance."
          }
          actions={
            <>
              <ButtonLink href="/dashboard/engagements/new" variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New engagement letter
              </ButtonLink>
              <ButtonLink href="/dashboard/invoices" size="sm">
                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                Invoices
              </ButtonLink>
              <ButtonLink href="/dashboard/documents" size="sm">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Documents
              </ButtonLink>
              {agency && (
                <ButtonLink href="/dashboard/client-tracker" size="sm">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Client tracker
                </ButtonLink>
              )}
              {admin && (
                <ButtonLink href="/dashboard/ads" size="sm">
                  <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                  Ads command center
                </ButtonLink>
              )}
            </>
          }
        />

        <SectionNav sections={sections} />

        {p.thisWeek && (
          <Section id="this-week" eyebrow="This week" title="From your Nexli team">
            <div className="space-y-3">{p.thisWeek}</div>
          </Section>
        )}

        {p.build && (
          <Section id="build" eyebrow="Your build" title="Where your website and portal stand">
            {p.build}
          </Section>
        )}

        <Section id="glance" eyebrow="At a glance" title="Where things stand">
          {p.campaign && <div className="mb-3">{p.campaign}</div>}
          <KpiGrid>
            <KpiTile
              label="Documents"
              value={n(p.docStats.total)}
              href="/dashboard/documents"
              icon={<FileText className="h-4 w-4 text-blue-300" aria-hidden="true" />}
              chip={p.docStats.new > 0 ? <Chip tone="blue" size="xs">{p.docStats.new} new</Chip> : undefined}
              sub={p.docStats.new > 0 ? "waiting for review" : "all reviewed"}
            />
            <KpiTile
              label="Contacts"
              value={contacts.value}
              loading={p.ghlConnected && p.ghl.loading}
              href={agency ? "/dashboard/contacts" : undefined}
              icon={<Users className="h-4 w-4 text-cyan-300" aria-hidden="true" />}
              sub={contacts.sub}
            />
            <KpiTile
              label="Pipeline value"
              value={p.pipelineValueCents === undefined ? "—" : moneyShort(p.pipelineValueCents ?? 0)}
              loading={p.pipelineValueCents === null}
              href={agency ? "/dashboard/pipeline" : undefined}
              icon={<KanbanSquare className="h-4 w-4 text-violet-300" aria-hidden="true" />}
              sub={p.pipelineValueCents === undefined ? "Couldn't load right now" : "open deals"}
            />
            <KpiTile
              label="Conversion"
              value={`${p.conversionRate}%`}
              href={agency ? "/dashboard/contacts" : undefined}
              icon={<Percent className="h-4 w-4 text-amber-300" aria-hidden="true" />}
              sub="leads who become clients"
            />
          </KpiGrid>
        </Section>

        <Section id="revenue" eyebrow="Revenue" title="Money in, money owed" right={<PeriodChip>All time</PeriodChip>}>
          <KpiGrid>
            <KpiTile label="Collected" value={moneyWhole(stats?.totalCollected ?? 0)} tone="green" loading={p.analytics.loading} sub="paid invoices" />
            <KpiTile
              label="Outstanding"
              value={moneyWhole(stats?.totalOutstanding ?? 0)}
              tone={(stats?.totalOutstanding ?? 0) > 0 ? "amber" : "neutral"}
              loading={p.analytics.loading}
              sub="unpaid right now"
            />
            <KpiTile
              label="Overdue"
              value={n(stats?.overdueCount ?? 0)}
              tone={(stats?.overdueCount ?? 0) > 0 ? "red" : "neutral"}
              loading={p.analytics.loading}
              sub={(stats?.overdueCount ?? 0) === 1 ? "invoice past due" : "invoices past due"}
            />
            <KpiTile label="Avg days to pay" value={`${n(stats?.avgDaysToPay ?? 0)}d`} loading={p.analytics.loading} sub="from sent to paid" />
          </KpiGrid>
          <Surface className="mt-3 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white">Monthly revenue</h3>
              <PeriodChip>Last 12 months</PeriodChip>
            </div>
            {p.analytics.loading ? <Skeleton className="h-[240px]" /> : <RevenueChart data={p.analytics.data?.chartData || []} />}
          </Surface>
        </Section>

        {p.ads && (
          <section id="ads" className="rm-enter mb-10 scroll-mt-28 md:scroll-mt-20">
            {p.ads}
          </section>
        )}

        {agency && (
          <Section id="leads" eyebrow="Leads" title="How fast leads turn into calls" right={<PeriodChip>Last 7 days</PeriodChip>}>
            {!p.ghlConnected ? (
              <ConnectGhl />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Surface className="p-4 sm:p-5">
                  <h3 className="mb-4 text-sm font-bold text-white">Lead funnel</h3>
                  {p.metrics.loading ? (
                    <Skeleton className="h-32" />
                  ) : conv ? (
                    <div className="space-y-4">
                      <FunnelBar label="New leads" value={conv.totalLeads} max={conv.totalLeads} color="bg-blue-500" />
                      <FunnelBar label="Responded" value={conv.respondedLeads} max={conv.totalLeads} color="bg-cyan-400" />
                      <FunnelBar label="Booked a call" value={conv.bookedConsultations} max={conv.totalLeads} color="bg-emerald-400" />
                    </div>
                  ) : (
                    <Notice tone="error">Couldn&apos;t load lead data right now.</Notice>
                  )}
                </Surface>
                <Surface className="p-4 sm:p-5">
                  <h3 className="mb-4 text-sm font-bold text-white">Speed to lead</h3>
                  {p.metrics.loading ? (
                    <Skeleton className="h-32" />
                  ) : speed && speed.totalMeasured > 0 ? (
                    <>
                      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                        <div>
                          <div className="text-3xl font-extrabold leading-none text-white" style={BIG_NUM}>
                            {n(speed.averageResponseMinutes)}
                            <span className="ml-1 text-sm font-semibold text-neutral-400">min</span>
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">average reply</div>
                        </div>
                        <div>
                          <div className="text-3xl font-extrabold leading-none text-white" style={BIG_NUM}>
                            {n(speed.medianResponseMinutes)}
                            <span className="ml-1 text-sm font-semibold text-neutral-400">min</span>
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">median reply</div>
                        </div>
                        <Chip tone={RATING[speed.performanceRating].tone} dot>
                          {RATING[speed.performanceRating].label}
                        </Chip>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <Chip tone="green" size="xs">Under 5 min: {n(speed.distribution.under5min)}</Chip>
                        <Chip tone="amber" size="xs">5–30 min: {n(speed.distribution.from5to30min)}</Chip>
                        <Chip tone="red" size="xs">Over 30 min: {n(speed.distribution.over30min)}</Chip>
                      </div>
                    </>
                  ) : speed ? (
                    <p className="text-sm text-neutral-400">No replies measured yet this week. Speed shows here once your team answers new leads.</p>
                  ) : (
                    <Notice tone="error">Couldn&apos;t load reply times right now.</Notice>
                  )}
                </Surface>
              </div>
            )}
          </Section>
        )}

        <Section id="recent" eyebrow="Recent" title="What just happened">
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-white">Portal activity</h3>
              {p.activity.loading ? (
                <Skeleton className="h-56" />
              ) : p.activity.data.length === 0 ? (
                <EmptyState icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} title="Quiet so far" body="Payments, documents, signatures and client sign-ins show up here." />
              ) : (
                <List>
                  {p.activity.data.slice(0, 8).map((a, i) => (
                    <ListRow
                      key={`${a.timestamp}-${i}`}
                      icon={ACTIVITY[a.type]?.icon}
                      tone={ACTIVITY[a.type]?.tone}
                      title={
                        <span className="whitespace-normal">
                          {a.actorName && <span className="font-semibold">{a.actorName} </span>}
                          <span className="font-normal text-neutral-300">{a.description}</span>
                        </span>
                      }
                      right={timeAgo(a.timestamp)}
                    />
                  ))}
                </List>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Recent leads</h3>
                {agency && p.ghlConnected && (
                  <ButtonLink href="/dashboard/contacts" variant="ghost" size="sm">
                    View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </ButtonLink>
                )}
              </div>
              {!p.ghlConnected ? (
                <ConnectGhl />
              ) : p.ghl.loading ? (
                <Skeleton className="h-56" />
              ) : (p.ghl.data?.recentLeads?.length ?? 0) === 0 ? (
                <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="No leads yet" body="New contacts from GoHighLevel show up here." />
              ) : (
                <List>
                  {p.ghl.data!.recentLeads.slice(0, 5).map((lead) => (
                    <ListRow
                      key={lead.id}
                      title={[lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || lead.phone || "Unnamed lead"}
                      sub={lead.email || lead.phone}
                      right={lead.source ? <Chip size="xs">{lead.source}</Chip> : timeAgo(lead.dateAdded)}
                    />
                  ))}
                </List>
              )}
            </div>
          </div>
        </Section>
      </PageColumn>
    </RainmakerCanvas>
  );
}
