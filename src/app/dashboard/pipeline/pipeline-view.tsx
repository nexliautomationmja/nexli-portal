"use client";

import { useState } from "react";
import { Check, ExternalLink, Kanban, Pencil, PhoneCall, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  Button,
  Chip,
  DOT_TONE,
  EmptyState,
  FIELD,
  GradientText,
  IconButton,
  KpiGrid,
  KpiTile,
  NUM_FONT,
  Notice,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  Segmented,
  Skeleton,
  Surface,
} from "@/components/rainmaker";
import { DEFAULT_VALUE_TEXT, STAGES, ghlContactUrl, money, parseDollars, shortDate, type Kpis, type Lead, type Stage } from "./pipeline-types";

export interface PipelineViewProps {
  state: "loading" | "ready" | "error";
  leads: Lead[];
  kpis: Kpis;
  ghlLocationId: string | null;
  /** Lead whose request is running (its buttons are disabled). */
  busyId: string | null;
  /** Below xl one column shows at a time. */
  tab: Stage;
  onTab: (s: Stage) => void;
  onAdd: () => void;
  onStage: (lead: Lead, stage: Stage) => void;
  onValue: (lead: Lead, cents: number) => void;
  onDelete: (lead: Lead) => void;
  onRetry: () => void;
  /** The add-lead sheet (its own container). */
  addSheet: React.ReactNode;
}

const STAGE_BTN = {
  green: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
  red: "border-rose-500/30 text-rose-300 hover:bg-rose-500/10",
  blue: "border-blue-500/30 text-blue-300 hover:bg-blue-500/10",
} as const;

function StageButton({ tone, disabled, onClick, children }: { tone: keyof typeof STAGE_BTN; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${STAGE_BTN[tone]}`}
    >
      {children}
    </button>
  );
}

/** The deal value: tap the pencil to type a new one (Enter or tapping away saves, Esc cancels). */
function ValueEdit({ lead, busy, onValue }: { lead: Lead; busy: boolean; onValue: (cents: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const cents = parseDollars(draft);
    setDraft(null);
    if (cents !== null && cents !== lead.valueCents) onValue(cents);
  };
  if (draft !== null) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={draft}
        aria-label={`Deal value for ${lead.name}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(null);
          }
        }}
        className={`${FIELD} w-32 py-1.5`}
        style={NUM_FONT}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => setDraft(String(Math.round(lead.valueCents / 100)))}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full text-base font-extrabold text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
      style={NUM_FONT}
      aria-label={`Edit the deal value for ${lead.name} (${money(lead.valueCents)})`}
    >
      {money(lead.valueCents)}
      <Pencil className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
    </button>
  );
}

function LeadCard({ lead, p }: { lead: Lead; p: PipelineViewProps }) {
  const busy = p.busyId === lead.id;
  const line = [lead.company, lead.email, lead.phone].filter(Boolean).join(" · ");
  return (
    <Surface className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{lead.name}</div>
          <div className="truncate text-xs text-neutral-400">{line || "No contact details"}</div>
          {lead.ghlContactId && p.ghlLocationId && (
            <a
              href={ghlContactUrl(p.ghlLocationId, lead.ghlContactId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex min-h-7 items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline"
            >
              View in GoHighLevel <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {lead.source === "booked_call" ? (
          <Chip tone="violet" size="xs" icon={<PhoneCall className="h-2.5 w-2.5" aria-hidden="true" />}>
            Booked{lead.bookedAt ? ` ${shortDate(lead.bookedAt)}` : ""}
          </Chip>
        ) : (
          <Chip size="xs">Added by hand</Chip>
        )}
      </div>

      {lead.notes && <p className="line-clamp-3 text-xs leading-relaxed text-neutral-400">{lead.notes}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ValueEdit lead={lead} busy={busy} onValue={(cents) => p.onValue(lead, cents)} />
        <div className="flex items-center gap-1.5">
          {lead.stage === "open" ? (
            <>
              <StageButton tone="green" disabled={busy} onClick={() => p.onStage(lead, "won")}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Won
              </StageButton>
              <StageButton tone="red" disabled={busy} onClick={() => p.onStage(lead, "lost")}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Lost
              </StageButton>
            </>
          ) : (
            <StageButton tone="blue" disabled={busy} onClick={() => p.onStage(lead, "open")}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reopen
            </StageButton>
          )}
          <IconButton label={`Remove ${lead.name} from the pipeline`} danger disabled={busy} onClick={() => p.onDelete(lead)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </Surface>
  );
}

function Column({ stage, leads, p, header = true }: { stage: (typeof STAGES)[number]; leads: Lead[]; p: PipelineViewProps; header?: boolean }) {
  const total = leads.reduce((n, l) => n + l.valueCents, 0);
  return (
    <div className="min-w-0 space-y-3">
      {header && (
        <div className="flex items-center gap-2 px-1">
          <span className={`h-2 w-2 rounded-full ${DOT_TONE[stage.tone]}`} aria-hidden="true" />
          <span className="text-sm font-bold text-white">{stage.label}</span>
          <span className="text-xs text-neutral-400" style={NUM_FONT}>
            {leads.length}
          </span>
          {leads.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-neutral-300" style={NUM_FONT}>
              {money(total)}
            </span>
          )}
        </div>
      )}
      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-neutral-500">Nothing here yet.</div>
      ) : (
        leads.map((l) => <LeadCard key={l.id} lead={l} p={p} />)
      )}
    </div>
  );
}

export function PipelineView(p: PipelineViewProps) {
  const loading = p.state === "loading";
  const by = (s: Stage) => p.leads.filter((l) => l.stage === s);
  const tabs = STAGES.map((s) => ({ value: s.key, label: `${s.label} ${by(s.key).length}` }));
  const current = STAGES.find((s) => s.key === p.tab) ?? STAGES[0];

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <Kanban className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Pipeline" }}
          title={
            <>
              Your pipeline, <GradientText>in motion.</GradientText>
            </>
          }
          sub={`An open lead counts as ${DEFAULT_VALUE_TEXT} until you set its value. Booked calls from GoHighLevel land here on their own.`}
          actions={
            <Button onClick={p.onAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a lead
            </Button>
          }
        />

        <Section id="pipeline" eyebrow="Deals" title="Where every lead stands">
          <KpiGrid className="mb-6">
            <KpiTile
              size="hero"
              label="Open pipeline"
              value={money(p.kpis.openValueCents)}
              loading={loading}
              sub={`${p.kpis.openCount} open ${p.kpis.openCount === 1 ? "lead" : "leads"}`}
            />
            <KpiTile label="Won" value={money(p.kpis.wonValueCents)} tone={p.kpis.wonCount > 0 ? "green" : "neutral"} loading={loading} sub={`${p.kpis.wonCount} ${p.kpis.wonCount === 1 ? "deal" : "deals"} won`} />
            <KpiTile label="Lost" value={p.kpis.lostCount} loading={loading} sub="closed without a deal" />
          </KpiGrid>

          {p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't load your pipeline"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              The connection may have dropped. Your leads are safe.
            </Notice>
          ) : loading ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : p.leads.length === 0 ? (
            <EmptyState
              icon={<Kanban className="h-5 w-5" aria-hidden="true" />}
              title="No leads in the pipeline yet"
              body="Add a lead, or book a call in GoHighLevel. Booked calls show up here on their own."
              action={
                <Button size="sm" onClick={p.onAdd}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a lead
                </Button>
              }
            />
          ) : (
            <>
              {/* Wide screens: the three columns side by side. */}
              <div className="hidden items-start gap-4 xl:grid xl:grid-cols-3">
                {STAGES.map((s) => (
                  <Column key={s.key} stage={s} leads={by(s.key)} p={p} />
                ))}
              </div>
              {/* Phones to laptops: one column at a time. */}
              <div className="space-y-4 xl:hidden">
                <Segmented block ariaLabel="Pipeline stage" kind="tabs" value={p.tab} options={tabs} onChange={p.onTab} numeric />
                <Column stage={current} leads={by(current.key)} p={p} header={false} />
              </div>
            </>
          )}
        </Section>
      </PageColumn>
      {p.addSheet}
    </RainmakerCanvas>
  );
}
