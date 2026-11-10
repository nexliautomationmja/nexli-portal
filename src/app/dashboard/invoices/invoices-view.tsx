"use client";

import { Download, History, Layers, Plus, Receipt, Send } from "lucide-react";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
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
  type Column,
} from "@/components/rainmaker";
import { INTERVAL_LABEL, OPEN, money, shortDate, statusOf, summarize, type Invoice } from "./invoice-types";

export interface InvoicesViewProps {
  state: "loading" | "ready" | "error";
  invoices: Invoice[];
  /** Invoice whose row action is running. */
  busyId: string | null;
  /** A message for the whole page (batch results, a deep link that didn't match…). */
  notice: { tone: "info" | "warn" | "error" | "success"; text: React.ReactNode } | null;
  onDismissNotice: () => void;
  onOpen: (inv: Invoice) => void;
  onNew: () => void;
  onBatch: () => void;
  onPdf: (inv: Invoice) => void;
  onHistory: (inv: Invoice) => void;
  onSend: (inv: Invoice) => void;
  onRetry: () => void;
  /** Mercury bank transfers (Nexli admin only; renders nothing for everyone else). */
  mercury?: React.ReactNode;
}

function Actions({ inv, p }: { inv: Invoice; p: InvoicesViewProps }) {
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <IconButton label={`Download ${inv.invoiceNumber} as PDF`} onClick={() => p.onPdf(inv)}>
        <Download className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <IconButton label={`All invoices for ${inv.clientName}`} onClick={() => p.onHistory(inv)}>
        <History className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      {inv.status === "draft" && (
        <IconButton label={`Send ${inv.invoiceNumber}`} disabled={p.busyId === inv.id} onClick={() => p.onSend(inv)} className="text-cyan-300">
          <Send className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

function StatusCell({ inv }: { inv: Invoice }) {
  const st = statusOf(inv.status);
  return (
    <div className="space-y-1">
      <Chip tone={st.tone} size="xs" dot>
        {st.label}
      </Chip>
      {inv.isRecurring && <div className="text-[10px] text-violet-300">Repeats {INTERVAL_LABEL[inv.recurringInterval ?? ""] ?? ""}</div>}
    </div>
  );
}

function AmountCell({ inv }: { inv: Invoice }) {
  const showBalance = OPEN.has(inv.status) && inv.amountPaid > 0;
  return (
    <div className="text-right">
      <div className="font-semibold text-white">{money(inv.total, inv.currency)}</div>
      {showBalance && <div className="text-[10px] text-amber-300">{money(inv.balanceDue, inv.currency)} still due</div>}
    </div>
  );
}

export function InvoicesView(p: InvoicesViewProps) {
  const loading = p.state === "loading";
  const s = summarize(p.invoices);

  const columns: Column<Invoice>[] = [
    {
      key: "client",
      header: "Client",
      sticky: true,
      className: "max-w-[240px]",
      cell: (inv) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            p.onOpen(inv);
          }}
          className="block max-w-full text-left"
        >
          <span className="block truncate font-semibold text-white hover:text-cyan-200 hover:underline">{inv.clientName}</span>
          <span className="block truncate text-[11px] text-neutral-400">{inv.clientCompany || inv.clientEmail}</span>
        </button>
      ),
    },
    { key: "number", header: "Invoice", className: "whitespace-nowrap", cell: (inv) => <span className="text-neutral-200">{inv.invoiceNumber}</span> },
    { key: "amount", header: "Amount", align: "right", className: "whitespace-nowrap", cell: (inv) => <AmountCell inv={inv} /> },
    { key: "status", header: "Status", cell: (inv) => <StatusCell inv={inv} /> },
    {
      key: "due",
      header: "Due",
      className: "whitespace-nowrap",
      cell: (inv) => <span className={inv.status === "overdue" ? "text-rose-300" : "text-neutral-300"}>{shortDate(inv.dueDate)}</span>,
    },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (inv) => <Actions inv={inv} p={p} /> },
  ];

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <Receipt className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Invoices" }}
          title={
            <>
              Bill it, <GradientText>get paid.</GradientText>
            </>
          }
          sub="Send invoices your clients pay online, follow every one to paid, and keep the history in one place."
          actions={
            <>
              <Button onClick={p.onNew}>
                <Plus className="h-4 w-4" aria-hidden="true" /> New invoice
              </Button>
              <Button variant="secondary" onClick={p.onBatch}>
                <Layers className="h-4 w-4" aria-hidden="true" /> Batch invoice
              </Button>
            </>
          }
        />

        {p.notice && (
          <Notice tone={p.notice.tone} onClose={p.onDismissNotice} className="mb-6">
            {p.notice.text}
          </Notice>
        )}

        {p.mercury}

        <Section id="invoices" eyebrow="Billing" title="Every invoice">
          <KpiGrid className="mb-4">
            <KpiTile label="Invoices" value={s.total} loading={loading} sub={s.drafts ? `${s.drafts} draft${s.drafts === 1 ? "" : "s"}` : "all time"} />
            <KpiTile label="Outstanding" value={s.outstanding} tone={s.outstanding ? "amber" : "neutral"} loading={loading} sub={s.outstandingLabel ? `${s.outstandingLabel} due` : "nothing due"} />
            <KpiTile label="Paid" value={s.paid} tone={s.paid ? "green" : "neutral"} loading={loading} sub={s.paidLabel ?? "none yet"} />
            <KpiTile label="Overdue" value={s.overdue} tone={s.overdue ? "red" : "neutral"} loading={loading} sub={s.overdueLabel ? `${s.overdueLabel} late` : "none late"} />
          </KpiGrid>

          {p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't load your invoices"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              The connection may have dropped. Your invoices are safe.
            </Notice>
          ) : (
            <DataTable
              caption="Invoices"
              breakpoint="xl"
              cardGrid
              columns={columns}
              rows={p.invoices}
              rowKey={(inv) => inv.id}
              onRowClick={p.onOpen}
              loading={loading}
              card={(inv) => {
                const st = statusOf(inv.status);
                return (
                  <div className="space-y-3">
                    <button type="button" onClick={() => p.onOpen(inv)} className="block w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{inv.clientName}</div>
                          <div className="truncate text-[11px] text-neutral-400" style={NUM_FONT}>
                            {inv.invoiceNumber} · due {shortDate(inv.dueDate)}
                          </div>
                        </div>
                        <Chip tone={st.tone} size="xs" dot>
                          {st.label}
                        </Chip>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-white" style={NUM_FONT}>
                        {money(inv.total, inv.currency)}
                      </div>
                      {OPEN.has(inv.status) && inv.amountPaid > 0 && <div className="text-[11px] text-amber-300">{money(inv.balanceDue, inv.currency)} still due</div>}
                    </button>
                    <div className="-mb-1 -ml-2 flex items-center">
                      <Actions inv={inv} p={p} />
                    </div>
                  </div>
                );
              }}
              empty={
                <EmptyState
                  icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                  title="No invoices yet"
                  body="Create your first invoice and your client gets an email with a link to pay online."
                  action={
                    <Button size="sm" onClick={p.onNew}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New invoice
                    </Button>
                  }
                />
              }
            />
          )}
        </Section>
      </PageColumn>
    </RainmakerCanvas>
  );
}
