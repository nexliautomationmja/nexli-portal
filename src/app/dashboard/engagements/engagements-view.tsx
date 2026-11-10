"use client";

import { Eye, PenLine, Plus, Rocket, Trash2, XCircle } from "lucide-react";
import {
  Button,
  ButtonLink,
  Chip,
  DataTable,
  EmptyState,
  GradientText,
  IconButton,
  KpiGrid,
  KpiTile,
  Notice,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  Sheet,
  StatusDot,
  type Column,
  type Tone,
} from "@/components/rainmaker";
import { DocumentPreview } from "@/components/engagement-document";
import { dateOrDash } from "@/lib/format";

export type LetterStatus = "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";

export interface Signer {
  id: string;
  name: string;
  email: string;
  order: number;
  role: string | null;
  status: LetterStatus;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  signatureData: string | null;
}

export interface Engagement {
  id: string;
  subject: string;
  content: string;
  status: LetterStatus;
  sentAt: string | null;
  expiresAt: string;
  createdAt: string;
  signers: Signer[];
}

const STATUS: Record<LetterStatus, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  sent: { tone: "blue", label: "Sent" },
  viewed: { tone: "amber", label: "Viewed" },
  signed: { tone: "green", label: "Signed" },
  declined: { tone: "red", label: "Declined" },
  expired: { tone: "neutral", label: "Expired" },
};

/** Client signers only: the sender (order 0) is auto-signed. */
export const clientSigners = (signers: Signer[]) => signers.filter((s) => s.order > 0);

export function overallStatus(eng: Engagement): LetterStatus {
  const clients = clientSigners(eng.signers);
  if (clients.length === 0) return eng.status;
  if (clients.every((s) => s.status === "signed")) return "signed";
  if (clients.some((s) => s.status === "declined")) return "declined";
  if (clients.some((s) => s.status === "viewed")) return "viewed";
  return eng.status;
}

const signerSummary = (signers: Signer[]) => {
  const c = clientSigners(signers);
  return c.length === 0 ? "—" : c.length === 1 ? c[0].name : `${c[0].name} +${c.length - 1} more`;
};
const signerEmails = (signers: Signer[]) => {
  const c = clientSigners(signers);
  return c.length === 0 ? "" : c.length === 1 ? c[0].email : `${c.length} recipients`;
};
const signedCount = (signers: Signer[]) => {
  const c = clientSigners(signers);
  return `${c.filter((s) => s.status === "signed").length}/${c.length} signed`;
};
const canVoid = (s: LetterStatus) => s === "sent" || s === "viewed";

function StatusCell({ eng }: { eng: Engagement }) {
  const st = STATUS[overallStatus(eng)] ?? STATUS.draft;
  return (
    <div>
      <Chip tone={st.tone} size="xs" dot>
        {st.label}
      </Chip>
      {clientSigners(eng.signers).length > 1 && <div className="mt-0.5 text-[10px] text-neutral-400">{signedCount(eng.signers)}</div>}
    </div>
  );
}

export interface EngagementsViewProps {
  state: "loading" | "error" | "ready";
  engagements: Engagement[];
  open: Engagement | null;
  firmInfo: { name: string; company: string };
  onOpen: (e: Engagement) => void;
  onClose: () => void;
  onVoid: (id: string) => void;
  onDelete: (id: string) => void;
  onStartOnboarding: (id: string) => void;
  onRetry: () => void;
}

export function EngagementsView(p: EngagementsViewProps) {
  const { engagements } = p;
  const loading = p.state === "loading";
  const statuses = engagements.map(overallStatus);
  const stats = {
    total: engagements.length,
    pending: statuses.filter((s) => s === "sent" || s === "viewed").length,
    signed: statuses.filter((s) => s === "signed").length,
    declined: statuses.filter((s) => s === "declined").length,
  };

  const columns: Column<Engagement>[] = [
    {
      key: "who",
      header: "Recipients",
      sticky: true,
      className: "max-w-[240px]",
      cell: (e) => (
        <button type="button" onClick={(ev) => { ev.stopPropagation(); p.onOpen(e); }} className="block max-w-full text-left">
          <span className="block truncate font-semibold text-white hover:underline">{signerSummary(e.signers)}</span>
          <span className="block truncate text-[11px] text-neutral-400">{signerEmails(e.signers)}</span>
        </button>
      ),
    },
    { key: "subject", header: "Subject", className: "max-w-[360px]", cell: (e) => <span className="line-clamp-2 text-neutral-200">{e.subject}</span> },
    { key: "status", header: "Status", cell: (e) => <StatusCell eng={e} /> },
    { key: "sent", header: "Sent", className: "whitespace-nowrap", cell: (e) => <span className="text-neutral-300">{dateOrDash(e.sentAt)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (e) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
          <IconButton label="View letter" onClick={() => p.onOpen(e)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          {canVoid(overallStatus(e)) && (
            <IconButton label="Void letter" onClick={() => p.onVoid(e.id)} danger>
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          )}
          <IconButton label="Delete letter" onClick={() => p.onDelete(e.id)} danger>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <PenLine className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Engagement letters" }}
          title={
            <>
              Letters that <GradientText>get signed.</GradientText>
            </>
          }
          sub="Send engagement letters for clients to review and sign, and see where every one stands."
          actions={
            <ButtonLink href="/dashboard/engagements/new" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New engagement letter
            </ButtonLink>
          }
        />

        <Section id="letters" eyebrow="Engagement letters" title="Where every letter stands">
          <KpiGrid className="mb-4">
            <KpiTile label="Total sent" value={stats.total} loading={loading} />
            <KpiTile label="Waiting to sign" value={stats.pending} tone={stats.pending > 0 ? "amber" : "neutral"} loading={loading} sub="sent or viewed" />
            <KpiTile label="Signed" value={stats.signed} tone={stats.signed > 0 ? "green" : "neutral"} loading={loading} />
            <KpiTile label="Declined" value={stats.declined} tone={stats.declined > 0 ? "red" : "neutral"} loading={loading} />
          </KpiGrid>

          {p.state === "error" ? (
            <Notice tone="error" title="Couldn't load your letters" action={<Button size="sm" onClick={p.onRetry}>Try again</Button>}>
              The connection may have dropped. Your letters are safe.
            </Notice>
          ) : (
            <DataTable
              caption="Engagement letters"
              breakpoint="md"
              columns={columns}
              rows={engagements}
              rowKey={(e) => e.id}
              loading={loading}
              onRowClick={p.onOpen}
              card={(e) => {
                const st = STATUS[overallStatus(e)] ?? STATUS.draft;
                return (
                  <button type="button" onClick={() => p.onOpen(e)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{signerSummary(e.signers)}</div>
                        <div className="truncate text-xs text-neutral-400">{signerEmails(e.signers)}</div>
                      </div>
                      <Chip tone={st.tone} size="xs" dot>
                        {st.label}
                      </Chip>
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm text-neutral-200">{e.subject}</div>
                    <div className="mt-1.5 text-xs text-neutral-400">
                      Sent {dateOrDash(e.sentAt)}
                      {clientSigners(e.signers).length > 1 ? ` · ${signedCount(e.signers)}` : ""}
                    </div>
                  </button>
                );
              }}
              empty={
                <EmptyState
                  icon={<PenLine className="h-5 w-5" aria-hidden="true" />}
                  title="No engagement letters yet"
                  body="Write your first letter: pick who's signing, choose the agreement, review and send."
                  action={
                    <ButtonLink href="/dashboard/engagements/new" variant="primary">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New engagement letter
                    </ButtonLink>
                  }
                />
              }
            />
          )}
        </Section>
      </PageColumn>

      {p.open && <LetterSheet eng={p.open} firmInfo={p.firmInfo} onClose={p.onClose} onVoid={p.onVoid} onDelete={p.onDelete} onStartOnboarding={p.onStartOnboarding} />}
    </RainmakerCanvas>
  );
}

function TimelineRow({ tone, label, date }: { tone: Tone; label: string; date: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <StatusDot tone={tone} />
      <span className="flex-1 text-sm text-neutral-200">{label}</span>
      <span className="text-xs text-neutral-400">{dateOrDash(date)}</span>
    </li>
  );
}

export function LetterSheet({
  eng,
  firmInfo,
  onClose,
  onVoid,
  onDelete,
  onStartOnboarding,
}: {
  eng: Engagement;
  firmInfo: { name: string; company: string };
  onClose: () => void;
  onVoid: (id: string) => void;
  onDelete: (id: string) => void;
  onStartOnboarding: (id: string) => void;
}) {
  const clients = clientSigners(eng.signers);
  const status = overallStatus(eng);
  const sender = eng.signers.find((s) => s.order === 0);
  const firstClient = clients[0];
  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      fullOnPhone
      title={eng.subject}
      sub={`${clients.length} recipient${clients.length !== 1 ? "s" : ""}${eng.sentAt ? ` · sent ${dateOrDash(eng.sentAt)}` : ""}`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="danger" onClick={() => onDelete(eng.id)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
          {canVoid(status) && (
            <Button variant="danger" onClick={() => onVoid(eng.id)}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Void
            </Button>
          )}
          {status === "signed" && (
            <Button onClick={() => onStartOnboarding(eng.id)}>
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Start onboarding
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Signers</div>
          <ul className="space-y-2">
            {clients.map((s) => {
              const st = STATUS[s.status] ?? STATUS.draft;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{s.name}</div>
                    <div className="truncate text-xs text-neutral-400">{s.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Chip tone={st.tone} size="xs" dot>
                      {st.label}
                    </Chip>
                    {s.signedAt ? (
                      <div className="mt-0.5 text-[10px] text-emerald-300">{dateOrDash(s.signedAt)}</div>
                    ) : s.viewedAt ? (
                      <div className="mt-0.5 text-[10px] text-neutral-400">Viewed {dateOrDash(s.viewedAt)}</div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <DocumentPreview
          content={eng.content}
          subject={eng.subject}
          clientName={firstClient?.name || ""}
          fromName={firmInfo.name}
          fromCompany={firmInfo.company}
          date={eng.sentAt ? new Date(eng.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined}
          senderSignatureData={sender?.signatureData}
          senderSignedAt={sender?.signedAt}
          senderRole={sender?.role}
          clientSignatureData={firstClient?.signatureData}
          clientSignedAt={firstClient?.signedAt}
          clientSignedName={firstClient?.name}
        />

        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Activity</div>
          <ul className="divide-y divide-white/5">
            <TimelineRow tone="neutral" label="Created" date={eng.createdAt} />
            {eng.sentAt && <TimelineRow tone="blue" label="Sent" date={eng.sentAt} />}
            {clients.flatMap((s) => [
              s.viewedAt ? <TimelineRow key={`${s.id}-v`} tone="amber" label={`Viewed by ${s.name}`} date={s.viewedAt} /> : null,
              s.signedAt ? <TimelineRow key={`${s.id}-s`} tone="green" label={`Signed by ${s.name}`} date={s.signedAt} /> : null,
              s.declinedAt ? <TimelineRow key={`${s.id}-d`} tone="red" label={`Declined by ${s.name}`} date={s.declinedAt} /> : null,
            ])}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
