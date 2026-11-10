"use client";

import { useState } from "react";
import { CircleCheck, Download, History, Send, Trash2, XCircle } from "lucide-react";
import {
  BIG_NUM,
  Button,
  Chip,
  CopyField,
  FIELD,
  FeatureCard,
  Field,
  List,
  ListRow,
  MiniStat,
  Notice,
  Sheet,
  Skeleton,
  StatusDot,
  Surface,
  type FeatureTone,
  type Tone,
} from "@/components/rainmaker";
import { InvoiceDocumentPreview } from "@/components/invoice-document";
import type { OwnerBranding } from "@/lib/branding";
import { INTERVAL_LABEL, OPEN, VOIDABLE, money, shortDate, statusOf, type ClientHistory, type Invoice } from "./invoice-types";

export type SheetView = "invoice" | "history" | "payment";

export interface InvoiceSheetProps {
  invoice: Invoice | null;
  view: SheetView;
  onView: (v: SheetView) => void;
  firm: { name: string; company: string };
  branding?: OwnerBranding;
  origin: string;
  history: { state: "loading" | "ready" | "error"; data: ClientHistory | null };
  busy: null | "send" | "void" | "delete";
  /** Something to say about this invoice (e.g. sent, but payments aren't set up). */
  notice: { tone: "info" | "warn" | "error" | "success"; text: React.ReactNode } | null;
  onClose: () => void;
  onSend: () => void;
  onVoid: () => void;
  onDelete: () => void;
  onPdf: () => void;
  onRetryHistory: () => void;
  onOpenInvoice: (id: string) => void;
  /** Record a payment made outside Stripe; resolves an error message, or null when it worked. */
  onMarkPaid: (method: string, note: string) => Promise<string | null>;
}

const FEATURE_TONE: Record<string, FeatureTone> = { paid: "emerald", overdue: "rose", partial: "amber" };

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer (Mercury)" },
  { value: "wire", label: "Wire" },
  { value: "ach", label: "ACH (outside Stripe)" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;

function Paper({ inv, firm, branding }: { inv: Invoice; firm: InvoiceSheetProps["firm"]; branding?: OwnerBranding }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
      <InvoiceDocumentPreview
        branding={branding}
        clientName={inv.clientName}
        clientEmail={inv.clientEmail}
        clientCompany={inv.clientCompany || undefined}
        fromName={firm.name}
        fromCompany={firm.company}
        lineItems={inv.lineItems}
        currency={inv.currency}
        taxRate={(inv.taxRate ?? 0) / 100}
        dueDate={inv.dueDate}
        issueDate={inv.issueDate}
        notes={inv.notes || undefined}
        terms={inv.terms || undefined}
        valuesInCents
        invoiceNumber={inv.invoiceNumber}
      />
    </div>
  );
}

function Summary({ inv }: { inv: Invoice }) {
  const st = statusOf(inv.status);
  const paid = inv.status === "paid";
  const closed = inv.status === "void" || inv.status === "canceled";
  const body = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{paid ? "Paid" : closed ? "Total" : "Balance due"}</div>
          <div className="mt-1 text-4xl font-extrabold leading-none text-white" style={BIG_NUM}>
            {money(paid || closed ? inv.total : inv.balanceDue, inv.currency)}
          </div>
          {inv.amountPaid > 0 && !paid && <div className="mt-1.5 text-xs text-neutral-400">{money(inv.amountPaid, inv.currency)} paid so far of {money(inv.total, inv.currency)}</div>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={st.tone} dot>
            {st.label}
          </Chip>
          {inv.isRecurring && <Chip tone="violet">Repeats {INTERVAL_LABEL[inv.recurringInterval ?? ""] ?? ""}</Chip>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
        <MiniStat label="Issued" value={shortDate(inv.issueDate)} />
        <MiniStat label="Due" value={shortDate(inv.dueDate)} tone={inv.status === "overdue" ? "red" : "neutral"} />
        <MiniStat label="Client" value={inv.clientCompany || inv.clientName} />
      </div>
    </>
  );
  const tone = FEATURE_TONE[inv.status];
  return tone ? <FeatureCard tone={tone}>{body}</FeatureCard> : <Surface className="p-4 sm:p-5">{body}</Surface>;
}

const TIMELINE_TONE: Record<string, Tone> = { Created: "neutral", Sent: "blue", Viewed: "cyan", Paid: "green", Canceled: "red" };

function Timeline({ inv }: { inv: Invoice }) {
  const rows = [
    { label: "Created", date: inv.createdAt },
    { label: "Sent", date: inv.sentAt },
    { label: "Viewed", date: inv.viewedAt },
    { label: "Paid", date: inv.paidAt },
    { label: inv.status === "void" ? "Voided" : "Canceled", date: inv.canceledAt },
  ].filter((r) => r.date);
  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Activity</p>
      <List>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <StatusDot tone={TIMELINE_TONE[r.label] ?? "red"} />
            <span className="font-semibold text-white">{r.label}</span>
            <span className="ml-auto text-xs text-neutral-400">{shortDate(r.date)}</span>
          </div>
        ))}
      </List>
    </div>
  );
}

function PaymentForm({ inv, onDone, onMarkPaid }: { inv: Invoice; onDone: () => void; onMarkPaid: InvoiceSheetProps["onMarkPaid"] }) {
  const [method, setMethod] = useState<string>("bank_transfer");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-300">
        Record {money(inv.balanceDue, inv.currency)} paid on {inv.invoiceNumber} by wire, check or a bank transfer outside Stripe. It triggers the same next steps as an online payment.
      </p>
      <Field label="How they paid">
        {(id) => (
          <select id={id} value={method} onChange={(e) => setMethod(e.target.value)} className={FIELD} disabled={saving}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Note" hint="Optional, e.g. the wire reference." counter={{ value: note.length, max: 500 }}>
        {(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} maxLength={500} className={FIELD} disabled={saving} />}
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button
          busy={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            const problem = await onMarkPaid(method, note.trim());
            setSaving(false);
            if (problem) setError(problem);
            else onDone();
          }}
        >
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> {saving ? "Saving…" : "Confirm paid"}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function HistoryView({ inv, history, onRetry, onOpen }: { inv: Invoice; history: InvoiceSheetProps["history"]; onRetry: () => void; onOpen: (id: string) => void }) {
  if (history.state === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (history.state === "error" || !history.data) {
    return (
      <Notice
        tone="error"
        title="Couldn't load this client's invoices"
        action={
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  const h = history.data;
  const cur = inv.currency;
  return (
    <div className="space-y-4">
      <Surface className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <MiniStat label="Invoices" value={h.summary.totalInvoices} />
        <MiniStat label="Invoiced" value={money(h.summary.totalInvoiced, cur)} />
        <MiniStat label="Paid" value={money(h.summary.totalPaid, cur)} tone="green" />
        <MiniStat label="Outstanding" value={money(h.summary.totalOutstanding, cur)} tone={h.summary.totalOutstanding > 0 ? "amber" : "neutral"} />
      </Surface>
      <List>
        {h.invoices.map((i) => {
          const st = statusOf(i.status);
          return (
            <ListRow
              key={i.id}
              onClick={() => onOpen(i.id)}
              selected={i.id === inv.id}
              title={i.invoiceNumber}
              sub={`Issued ${shortDate(i.issueDate)} · due ${shortDate(i.dueDate)}`}
              right={
                <span className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-white">{money(i.total, i.currency)}</span>
                  <Chip tone={st.tone} size="xs" dot>
                    {st.label}
                  </Chip>
                </span>
              }
              chevron
            />
          );
        })}
      </List>
    </div>
  );
}

export function InvoiceSheet(p: InvoiceSheetProps) {
  const inv = p.invoice;
  const open = Boolean(inv);
  const isOpen = inv ? OPEN.has(inv.status) : false;
  const back = p.view !== "invoice" ? { label: inv?.invoiceNumber ?? "Invoice", onClick: () => p.onView("invoice") } : undefined;
  const title = !inv ? "" : p.view === "history" ? inv.clientName : p.view === "payment" ? "Record a payment" : inv.invoiceNumber;
  const sub = !inv ? undefined : p.view === "history" ? `All invoices for ${inv.clientEmail}` : p.view === "payment" ? inv.invoiceNumber : `${inv.clientName} · ${inv.clientEmail}`;

  const footer =
    inv && p.view === "invoice" ? (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          <Button variant="danger" size="sm" busy={p.busy === "delete"} disabled={Boolean(p.busy)} onClick={p.onDelete}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
          </Button>
          {VOIDABLE.has(inv.status) && (
            <Button variant="danger" size="sm" busy={p.busy === "void"} disabled={Boolean(p.busy)} onClick={p.onVoid}>
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Void
            </Button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={p.onPdf}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
          </Button>
          {inv.status === "draft" && (
            <Button size="sm" busy={p.busy === "send"} disabled={Boolean(p.busy)} onClick={p.onSend}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send invoice
            </Button>
          )}
          {isOpen && (
            <Button size="sm" onClick={() => p.onView("payment")}>
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> Record a payment
            </Button>
          )}
        </div>
      </div>
    ) : undefined;

  return (
    <Sheet open={open} onClose={p.onClose} title={title} sub={sub} back={back} size="lg" fullOnPhone footer={footer}>
      {inv && p.view === "invoice" && (
        <div className="space-y-5">
          {p.notice && <Notice tone={p.notice.tone}>{p.notice.text}</Notice>}
          <Summary inv={inv} />
          {inv.metadata?.transferSentAt && isOpen && (
            <Notice tone="info" title="Bank transfer on its way">
              The client says they sent it on {shortDate(inv.metadata.transferSentAt)}. It&apos;s marked paid automatically when it lands in Mercury.
            </Notice>
          )}
          {inv.status !== "draft" && <CopyField label="Payment link" value={`${p.origin}/invoice/${inv.token}`} mono={false} />}
          <Paper inv={inv} firm={p.firm} branding={p.branding} />
          <Timeline inv={inv} />
          <Button variant="secondary" size="sm" onClick={() => p.onView("history")}>
            <History className="h-3.5 w-3.5" aria-hidden="true" /> All invoices for {inv.clientName}
          </Button>
        </div>
      )}
      {inv && p.view === "history" && <HistoryView inv={inv} history={p.history} onRetry={p.onRetryHistory} onOpen={p.onOpenInvoice} />}
      {inv && p.view === "payment" && <PaymentForm key={inv.id} inv={inv} onDone={() => p.onView("invoice")} onMarkPaid={p.onMarkPaid} />}
    </Sheet>
  );
}
