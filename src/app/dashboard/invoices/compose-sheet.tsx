"use client";

import { Send } from "lucide-react";
import { Button, Notice, Segmented, Sheet } from "@/components/rainmaker";
import { InvoiceDocumentPreview } from "@/components/invoice-document";
import type { OwnerBranding } from "@/lib/branding";
import { ClientFieldsEditor, LineItemsEditor, OptionsFields, TotalsBox } from "./invoice-form";
import { isRepeating, num, type InvoiceDraft } from "./invoice-types";

export interface ComposeSheetProps {
  open: boolean;
  draft: InvoiceDraft;
  onDraft: (d: InvoiceDraft) => void;
  firm: { name: string; company: string };
  branding?: OwnerBranding;
  /** Below lg: the form or the preview. */
  mode: "details" | "preview";
  onMode: (m: "details" | "preview") => void;
  busy: null | "draft" | "send";
  error: string | null;
  onSave: (send: boolean) => void;
  onStartOver: () => void;
  onClose: () => void;
}

const MODES = [
  { value: "details", label: "Details" },
  { value: "preview", label: "Preview" },
] as const;

function Paper({ d, firm, branding }: { d: InvoiceDraft; firm: ComposeSheetProps["firm"]; branding?: OwnerBranding }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
      <InvoiceDocumentPreview
        branding={branding}
        clientName={d.clientName || "Client Name"}
        clientEmail={d.clientEmail}
        clientCompany={d.clientCompany || undefined}
        fromName={firm.name}
        fromCompany={firm.company}
        lineItems={d.lines.map((l) => ({ description: l.description, quantity: num(l.quantity), unitPrice: num(l.unitPrice), billingType: l.billingType }))}
        currency={d.currency}
        taxRate={num(d.taxRate)}
        dueDate={d.dueDate || undefined}
        notes={d.notes || undefined}
        terms={d.terms || undefined}
        valuesInCents={false}
      />
    </div>
  );
}

export function ComposeSheet(p: ComposeSheetProps) {
  const d = p.draft;
  const set = (patch: Partial<InvoiceDraft>) => p.onDraft({ ...d, ...patch });
  const touched = Boolean(d.clientName || d.clientEmail || d.lines.some((l) => l.description || l.unitPrice) || d.notes || d.terms);

  const form = (
    <div className="space-y-6">
      <ClientFieldsEditor value={d} onChange={(c) => set(c)} />
      <LineItemsEditor lines={d.lines} onChange={(lines) => set({ lines })} currency={d.currency} />
      <TotalsBox lines={d.lines} taxRate={d.taxRate} onTaxRate={(taxRate) => set({ taxRate })} currency={d.currency} />
      {isRepeating(d.lines) && (
        <Notice tone="info">Lines billed monthly, quarterly or yearly make this a repeating invoice: a new invoice is created on that schedule.</Notice>
      )}
      <OptionsFields value={d} onChange={(o) => set(o)} />
    </div>
  );

  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title="New invoice"
      sub="Your client gets an email with a link to pay online."
      size="xl"
      fullOnPhone
      footer={
        <div className="space-y-3">
          {p.error && <Notice tone="error">{p.error}</Notice>}
          <div className="flex flex-wrap items-center gap-2">
            {touched && (
              <Button variant="ghost" size="sm" onClick={p.onStartOver} disabled={Boolean(p.busy)}>
                Start over
              </Button>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" busy={p.busy === "draft"} disabled={Boolean(p.busy)} onClick={() => p.onSave(false)}>
                {p.busy === "draft" ? "Saving…" : "Save as draft"}
              </Button>
              <Button busy={p.busy === "send"} disabled={Boolean(p.busy)} onClick={() => p.onSave(true)}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {p.busy === "send" ? "Sending…" : "Send invoice"}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5 lg:space-y-0">
        {/* Narrow screens: the form or the preview; wide: side by side. */}
        <div className="lg:hidden">
          <Segmented block ariaLabel="Form or preview" kind="tabs" value={p.mode} options={MODES} onChange={p.onMode} />
        </div>
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-6">
          <div className={p.mode === "preview" ? "hidden lg:block" : undefined}>{form}</div>
          <div className={p.mode === "details" ? "hidden lg:block" : undefined}>
            <div className="lg:sticky lg:top-0">
              <p className="mb-2 hidden text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 lg:block">Preview</p>
              <Paper d={d} firm={p.firm} branding={p.branding} />
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
