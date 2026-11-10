"use client";

import { Check, Search, UserPlus } from "lucide-react";
import { Button, FIELD, Field, List, ListRow, Notice, Sheet, Spinner } from "@/components/rainmaker";
import { DEFAULT_VALUE_TEXT, contactName, type ContactResult, type LeadForm } from "./pipeline-types";

export type ContactsState = "searching" | "ready" | "disconnected" | "error";

export interface AddLeadSheetProps {
  open: boolean;
  form: LeadForm;
  onForm: (f: LeadForm) => void;
  contactQuery: string;
  onContactQuery: (q: string) => void;
  contacts: ContactResult[];
  contactsState: ContactsState;
  picked: ContactResult | null;
  onPick: (c: ContactResult) => void;
  onUnpick: () => void;
  adding: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}

export function AddLeadSheet(p: AddLeadSheetProps) {
  const set = (k: keyof LeadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => p.onForm({ ...p.form, [k]: e.target.value });
  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title="Add a lead"
      sub="Pick one of your contacts, or fill in the details by hand."
      size="md"
      fullOnPhone
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={p.onClose}>
            Cancel
          </Button>
          <Button busy={p.adding} onClick={p.onSubmit}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {p.adding ? "Adding…" : "Add to pipeline"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* From GoHighLevel contacts */}
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Pick from your contacts</p>
          {p.picked ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.08] px-3.5 py-2.5">
              <div className="min-w-0 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-200">
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{contactName(p.picked)}</span>
                </span>
                {p.picked.email && <span className="block truncate text-xs text-neutral-400">{p.picked.email}</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={p.onUnpick}>
                Clear
              </Button>
            </div>
          ) : p.contactsState === "disconnected" ? (
            <Notice tone="info">GoHighLevel isn&apos;t connected, so there are no contacts to pick. Fill in the lead below.</Notice>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                <input
                  type="search"
                  value={p.contactQuery}
                  onChange={(e) => p.onContactQuery(e.target.value)}
                  placeholder="Search your contacts"
                  aria-label="Search your contacts"
                  className={`${FIELD} pl-10 pr-10`}
                />
                {p.contactsState === "searching" && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-300">
                    <Spinner />
                  </span>
                )}
              </div>
              {p.contactsState === "error" ? (
                <p className="text-xs text-rose-300">GoHighLevel didn&apos;t answer. Fill in the lead below, or try the search again.</p>
              ) : p.contactsState === "ready" && p.contacts.length === 0 ? (
                <p className="text-xs text-neutral-400">No contacts match. Fill in the lead below instead.</p>
              ) : (
                p.contacts.length > 0 && (
                  <List className="max-h-56 overflow-y-auto">
                    {p.contacts.map((c) => (
                      <ListRow
                        key={c.id}
                        title={contactName(c)}
                        sub={[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
                        onClick={() => p.onPick(c)}
                      />
                    ))}
                  </List>
                )
              )}
            </>
          )}
          {p.contactsState !== "disconnected" && <p className="text-[11px] text-neutral-400">A picked lead keeps a link to its GoHighLevel profile.</p>}
        </div>

        <div className="h-px bg-white/10" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead name *" className="sm:col-span-2">
            {(id) => <input id={id} value={p.form.name} onChange={set("name")} placeholder="Jane Snack" className={FIELD} autoComplete="off" />}
          </Field>
          <Field label="Email">
            {(id) => <input id={id} type="email" value={p.form.email} onChange={set("email")} placeholder="jane@firm.com" className={FIELD} autoComplete="off" />}
          </Field>
          <Field label="Phone">
            {(id) => <input id={id} type="tel" value={p.form.phone} onChange={set("phone")} placeholder="(555) 555-0100" className={FIELD} autoComplete="off" />}
          </Field>
          <Field label="Firm / company" className="sm:col-span-2">
            {(id) => <input id={id} value={p.form.company} onChange={set("company")} placeholder="Snack CPA, LLC" className={FIELD} autoComplete="off" />}
          </Field>
          <Field label="Expected deal value (USD)" hint={`Default: ${DEFAULT_VALUE_TEXT}`} className="sm:col-span-2">
            {(id) => <input id={id} inputMode="decimal" value={p.form.value} onChange={set("value")} className={FIELD} autoComplete="off" />}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(id) => <textarea id={id} value={p.form.notes} onChange={set("notes")} rows={2} placeholder="Optional" className={`${FIELD} resize-none`} />}
          </Field>
        </div>

        {p.error && <Notice tone="error">{p.error}</Notice>}
      </div>
    </Sheet>
  );
}
