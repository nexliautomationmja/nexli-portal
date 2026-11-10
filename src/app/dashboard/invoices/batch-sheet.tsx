"use client";

import { Plus, Send, X } from "lucide-react";
import { Button, FIELD, Notice, Sheet } from "@/components/rainmaker";
import { ClientPicker } from "@/components/dashboard/client-picker";
import { FormBlock, LineItemsEditor, OptionsFields, TotalsBox } from "./invoice-form";
import { blankRecipient, isRepeating, type DraftLine, type InvoiceOptions, type Recipient } from "./invoice-types";

export interface BatchSheetProps {
  open: boolean;
  recipients: Recipient[];
  onRecipients: (r: Recipient[]) => void;
  lines: DraftLine[];
  onLines: (l: DraftLine[]) => void;
  options: InvoiceOptions;
  onOptions: (o: InvoiceOptions) => void;
  busy: null | "draft" | "send";
  error: string | null;
  onSave: (send: boolean) => void;
  onClose: () => void;
}

export function BatchSheet(p: BatchSheetProps) {
  const update = (key: string, patch: Partial<Recipient>) => p.onRecipients(p.recipients.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => p.recipients.length > 1 && p.onRecipients(p.recipients.filter((r) => r.key !== key));
  const n = p.recipients.length;

  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title="Batch invoice"
      sub="The same invoice for several clients at once: each gets their own."
      size="xl"
      fullOnPhone
      footer={
        <div className="space-y-3">
          {p.error && <Notice tone="error">{p.error}</Notice>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" busy={p.busy === "draft"} disabled={Boolean(p.busy)} onClick={() => p.onSave(false)}>
              {p.busy === "draft" ? "Saving…" : `Save ${n === 1 ? "draft" : `${n} drafts`}`}
            </Button>
            <Button busy={p.busy === "send"} disabled={Boolean(p.busy)} onClick={() => p.onSave(true)}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {p.busy === "send" ? "Sending…" : `Send ${n === 1 ? "invoice" : `${n} invoices`}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <FormBlock
          title={`Clients (${n})`}
          right={
            <button
              type="button"
              onClick={() => p.onRecipients([...p.recipients, blankRecipient()])}
              className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a client
            </button>
          }
        >
          <ClientPicker
            placeholder="Search your contacts to add one…"
            onSelect={(c) => {
              const picked = { clientName: c.name, clientEmail: c.email, clientPhone: c.phone || "", clientCompany: c.company || "" };
              const empty = p.recipients.find((r) => !r.clientName.trim() && !r.clientEmail.trim());
              p.onRecipients(empty ? p.recipients.map((r) => (r.key === empty.key ? { ...r, ...picked } : r)) : [...p.recipients, { ...blankRecipient(), ...picked }]);
            }}
          />
          <div className="space-y-2">
            {p.recipients.map((r, i) => (
              <div key={r.key} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:items-center">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <input value={r.clientName} onChange={(e) => update(r.key, { clientName: e.target.value })} placeholder="Name *" aria-label={`Client ${i + 1} name`} className={`${FIELD} px-3`} autoComplete="off" />
                  <input
                    type="email"
                    value={r.clientEmail}
                    onChange={(e) => update(r.key, { clientEmail: e.target.value })}
                    placeholder="Email *"
                    aria-label={`Client ${i + 1} email`}
                    className={`${FIELD} px-3`}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  disabled={n <= 1}
                  aria-label={`Remove client ${i + 1}`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:invisible"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </FormBlock>

        <LineItemsEditor lines={p.lines} onChange={p.onLines} currency={p.options.currency} />
        <TotalsBox lines={p.lines} taxRate={p.options.taxRate} onTaxRate={(taxRate) => p.onOptions({ ...p.options, taxRate })} currency={p.options.currency} count={n} />
        {isRepeating(p.lines) && (
          <Notice tone="info">Lines billed monthly, quarterly or yearly make these repeating invoices: a new invoice is created for each client on that schedule.</Notice>
        )}
        <OptionsFields value={p.options} onChange={p.onOptions} />
      </div>
    </Sheet>
  );
}
