"use client";

import { Globe, KeyRound, LayoutDashboard, Magnet, PenLine, Receipt, Users, Wallet } from "lucide-react";
import {
  ButtonLink,
  Chip,
  EmptyState,
  FeatureCard,
  GradientText,
  KpiGrid,
  KpiTile,
  List,
  ListRow,
  MiniStat,
  Notice,
  PageColumn,
  PageHero,
  PeriodChip,
  RainmakerCanvas,
  Section,
  SectionNav,
  type Tone,
} from "@/components/rainmaker";
import { moneyWhole, relativeDay } from "@/lib/format";
import { timeAgo } from "./detail-status";
import { SetupPanel } from "./setup-panel";
import { SuccessPanel } from "./success-panel";
import { WeeklyUpdatePanel } from "./weekly-update";
import type { ActivityType, DetailData, WeeklyUpdateItem } from "./detail-types";

const SECTIONS = [
  { id: "glance", label: "At a glance" },
  { id: "book", label: "Book & activity" },
  { id: "update", label: "Weekly update" },
  { id: "success", label: "Pulse check" },
  { id: "setup", label: "Setup" },
] as const;

const ACTIVITY: Record<ActivityType, { icon: React.ReactNode; tone: Tone }> = {
  payment: { icon: <Wallet className="h-4 w-4" aria-hidden="true" />, tone: "green" },
  invoice: { icon: <Receipt className="h-4 w-4" aria-hidden="true" />, tone: "blue" },
  engagement: { icon: <PenLine className="h-4 w-4" aria-hidden="true" />, tone: "violet" },
  lead: { icon: <Magnet className="h-4 w-4" aria-hidden="true" />, tone: "amber" },
  portal_login: { icon: <KeyRound className="h-4 w-4" aria-hidden="true" />, tone: "cyan" },
};

const n = (v: number) => v.toLocaleString("en-US");

export function DetailView({
  data,
  onWebsiteSaved,
  onUpdatesChange,
}: {
  data: DetailData;
  onWebsiteSaved: (url: string | null) => void;
  onUpdatesChange: (updates: WeeklyUpdateItem[]) => void;
}) {
  const { client, theirBook, traffic, youCollect, activity, campaign } = data;
  const displayName = client.name || client.email.split("@")[0];
  const site = client.websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          size="compact"
          back={{ href: "/dashboard/client-tracker", label: "Client tracker" }}
          pill={{ icon: <LayoutDashboard className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Client dashboard" }}
          title={
            client.company ? (
              <>
                {displayName} · <GradientText>{client.company}</GradientText>
              </>
            ) : (
              displayName
            )
          }
          sub="Inside their dashboard: what their Digital Rainmaker System is producing."
          meta={
            <>
              {site && (
                <a href={client.websiteUrl as string} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-cyan-300 hover:underline">
                  <Globe className="h-3 w-3" aria-hidden="true" />
                  {site}
                </a>
              )}
              <span>{client.lastLoginAt ? `Last signed in ${relativeDay(client.lastLoginAt)}` : "Hasn't signed in yet"}</span>
              <span>{client.email}</span>
            </>
          }
          actions={
            <ButtonLink href={`/dashboard/admin?client=${client.id}`} size="sm">
              Full analytics
            </ButtonLink>
          }
        />

        {!client.websiteUrl && (
          <Notice tone="info" title="Finish their setup" className="mb-6" action={<ButtonLink href="#setup" size="sm">Go to setup</ButtonLink>}>
            Add their website so visits report here, and paste the tracking snippet when you build it.
          </Notice>
        )}

        <SectionNav sections={SECTIONS} />

        <Section id="glance" eyebrow="At a glance" title="What their system is producing">
          <KpiGrid>
            <KpiTile
              size="hero"
              label="Their revenue"
              value={moneyWhole(theirBook.kpis.totalRevenue)}
              chip={<PeriodChip>All time</PeriodChip>}
              sub={`from ${n(theirBook.kpis.totalClients)} client${theirBook.kpis.totalClients === 1 ? "" : "s"} · ${n(theirBook.kpis.totalDeals)} deal${theirBook.kpis.totalDeals === 1 ? "" : "s"} closed`}
            />
            <KpiTile label="Their MRR" value={`${moneyWhole(theirBook.kpis.totalMrr)}/mo`} tone="cyan" sub="recurring, right now" />
            <KpiTile label="Their clients" value={n(theirBook.kpis.totalClients)} sub="signed and paid" />
          </KpiGrid>
          <KpiGrid cols={campaign ? 4 : 3} className="mt-3">
            <KpiTile size="sm" label="Leads" value={n(data.leads30d)} sub="last 30 days" />
            {campaign && (
              <KpiTile
                size="sm"
                label="Leads since launch"
                value={n(campaign.leads)}
                chip={
                  <Chip tone={campaign.status === "live" ? "green" : "neutral"} size="xs" dot>
                    {campaign.status === "live" ? `${campaign.daysSinceLaunch} ${campaign.daysSinceLaunch === 1 ? "day" : "days"} live` : "Not launched"}
                  </Chip>
                }
              />
            )}
            <KpiTile size="sm" label="Site visitors" value={n(traffic.uniqueVisitors30d)} sub="last 30 days" />
            <KpiTile size="sm" label="Page views" value={n(traffic.pageViews30d)} sub="last 30 days" />
          </KpiGrid>
          {youCollect && (
            <FeatureCard tone="blue" eyebrow="Your side" title={`What ${displayName} pays you`} className="mt-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MiniStat label="Collected" value={moneyWhole(youCollect.revenue)} sub="all time" />
                <MiniStat label="Recurring" value={youCollect.mrr > 0 ? `${moneyWhole(youCollect.mrr)}/mo` : "—"} />
                <MiniStat label="Outstanding" value={youCollect.outstanding > 0 ? moneyWhole(youCollect.outstanding) : "All paid"} tone={youCollect.outstanding > 0 ? "red" : "green"} />
                <MiniStat label="Ad spend" value={moneyWhole(youCollect.adSpendCollected ?? 0)} sub="passed through to ads" />
              </div>
            </FeatureCard>
          )}
        </Section>

        <Section id="book" eyebrow="Their book & activity" title="Who they serve, what's happening">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-white">Their book of business</h3>
              {theirBook.topClients.length === 0 ? (
                <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="No clients yet" body="No signed-and-paid clients in their dashboard yet." />
              ) : (
                <List>
                  {theirBook.topClients.map((c) => (
                    <ListRow
                      key={c.email}
                      title={c.name}
                      sub={c.company || c.email}
                      right={
                        <>
                          <div className="font-semibold text-white">{moneyWhole(c.revenue)}</div>
                          {c.mrr > 0 && <div className="text-cyan-300">{moneyWhole(c.mrr)}/mo</div>}
                        </>
                      }
                    />
                  ))}
                </List>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Dashboard activity</h3>
                <PeriodChip>{n(traffic.pageViews30d)} site views · 30 days</PeriodChip>
              </div>
              {activity.length === 0 ? (
                <EmptyState icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />} title="Quiet so far" body="No activity in their dashboard yet." />
              ) : (
                <List>
                  {activity.map((a, i) => (
                    <ListRow key={`${a.at}-${i}`} icon={ACTIVITY[a.type].icon} tone={ACTIVITY[a.type].tone} title={<span className="whitespace-normal">{a.message}</span>} right={timeAgo(a.at)} />
                  ))}
                </List>
              )}
            </div>
          </div>
        </Section>

        <Section id="update" eyebrow="Customer success" title="Weekly update" sub="Emailed to them and shown on their Overview. One a week keeps them in the loop.">
          <WeeklyUpdatePanel
            clientId={client.id}
            clientLabel={displayName}
            clientEmail={client.email}
            updates={data.weeklyUpdates || []}
            status={data.status?.update ?? null}
            onChange={onUpdatesChange}
          />
        </Section>

        <Section id="success" eyebrow="Customer success" title="Pulse check" sub="The every-other-Monday survey: NPS, whether they're getting value, and what they wrote.">
          <SuccessPanel surveys={data.surveys || []} status={data.status?.nps ?? null} />
        </Section>

        <Section id="setup" eyebrow="Setup" title="Snippet, website & login">
          <SetupPanel client={client} onWebsiteSaved={onWebsiteSaved} />
        </Section>
      </PageColumn>
    </RainmakerCanvas>
  );
}
