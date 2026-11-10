"use client";

import { Plus, X } from "lucide-react";
import { FIELD, Field, NUM_FONT } from "@/components/rainmaker";
import { ClientPicker } from "@/components/dashboard/client-picker";
import {
  BILLING_TYPES,
  CURRENCIES,
  REMINDER_OPTIONS,
  blankLine,
  lineTotal,
  maxDueISO,
  money,
  todayISO,
  totals,
  type ClientFields,
  type DraftLine,
  type InvoiceOptions,
} from "./invoice-types";

/** One section of a form: small heading + content. */
export function FormBlock({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ClientFieldsEditor({
  value,
  onChange,
}: {
  value: ClientFields;
  onChange: (v: ClientFields) => void;
}) {
  const set =
    (k: keyof ClientFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [k]: e.target.value });
  return (
    <FormBlock title="Client">
      <ClientPicker
        placeholder="Search your contacts…"
        onSelect={(c) =>
          onChange({
            clientName: c.name,
            clientEmail: c.email,
            clientPhone: c.phone || value.clientPhone,
            clientCompany: c.company || value.clientCompany,
          })
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *">
          {(id) => (
            <input
              id={id}
              value={value.clientName}
              onChange={set("clientName")}
              className={FIELD}
              autoComplete="off"
              placeholder="Jane Snack"
            />
          )}
        </Field>
        <Field label="Email *">
          {(id) => (
            <input
              id={id}
              type="email"
              value={value.clientEmail}
              onChange={set("clientEmail")}
              className={FIELD}
              autoComplete="off"
              placeholder="jane@firm.com"
            />
          )}
        </Field>
        <Field label="Phone">
          {(id) => (
            <input
              id={id}
              type="tel"
              value={value.clientPhone}
              onChange={set("clientPhone")}
              className={FIELD}
              autoComplete="off"
              placeholder="Optional"
            />
          )}
        </Field>
        <Field label="Company">
          {(id) => (
            <input
              id={id}
              value={value.clientCompany}
              onChange={set("clientCompany")}
              className={FIELD}
              autoComplete="off"
              placeholder="Optional"
            />
          )}
        </Field>
      </div>
    </FormBlock>
  );
}

const SMALL_FIELD = `${FIELD} px-3`;

/** The lines: cards on phones, a row each from sm. */
export function LineItemsEditor({
  lines,
  onChange,
  currency,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  currency: string;
}) {
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) =>
    lines.length > 1 && onChange(lines.filter((l) => l.key !== key));
  // Rows only when the editor itself is wide enough (container query): the
  // form sits next to the preview in a narrow column on laptops.
  const grid =
    "@2xl:grid @2xl:grid-cols-[minmax(0,1fr)_4rem_6rem_7.5rem_6rem_2.5rem] @2xl:items-center @2xl:gap-2";
  return (
    <div className="@container">
      <FormBlock
        title="Line items"
        right={
          <button
            type="button"
            onClick={() => onChange([...lines, blankLine()])}
            className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a line
          </button>
        }
      >
        <div
          className={`hidden px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500 ${grid}`}
          aria-hidden="true"
        >
          <span>Description</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Billing</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div
              key={l.key}
              className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 @2xl:rounded-none @2xl:border-0 @2xl:bg-transparent @2xl:p-0 ${grid}`}
            >
              <input
                value={l.description}
                onChange={(e) => update(l.key, { description: e.target.value })}
                placeholder="Description"
                aria-label={`Line ${i + 1} description`}
                className={SMALL_FIELD}
              />
              <div className="mt-2 grid grid-cols-3 gap-2 @2xl:contents">
                <input
                  inputMode="decimal"
                  value={l.quantity}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                  placeholder="1"
                  aria-label={`Line ${i + 1} quantity`}
                  className={SMALL_FIELD}
                  style={NUM_FONT}
                />
                <input
                  inputMode="decimal"
                  value={l.unitPrice}
                  onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                  placeholder="0.00"
                  aria-label={`Line ${i + 1} rate`}
                  className={SMALL_FIELD}
                  style={NUM_FONT}
                />
                <select
                  value={l.billingType}
                  onChange={(e) =>
                    update(l.key, { billingType: e.target.value })
                  }
                  aria-label={`Line ${i + 1} billing`}
                  className={SMALL_FIELD}
                >
                  {BILLING_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between @2xl:contents">
                <span
                  className="text-sm font-semibold text-white @2xl:text-right"
                  style={NUM_FONT}
                >
                  {money(Math.round(lineTotal(l) * 100), currency)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(l.key)}
                  disabled={lines.length <= 1}
                  aria-label={`Remove line ${i + 1}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:invisible"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </FormBlock>
    </div>
  );
}

/** Subtotal, tax % (editable) and total; `count` shows "× N clients" for batches. */
export function TotalsBox({
  lines,
  taxRate,
  onTaxRate,
  currency,
  count,
}: {
  lines: DraftLine[];
  taxRate: string;
  onTaxRate: (v: string) => void;
  currency: string;
  count?: number;
}) {
  const t = totals(lines, taxRate);
  const row = "flex items-center justify-between gap-3 text-sm";
  return (
    <div
      className="ml-auto w-full max-w-sm space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4"
      style={NUM_FONT}
    >
      <div className={row}>
        <span className="text-neutral-400">Subtotal</span>
        <span className="text-white">
          {money(Math.round(t.subtotal * 100), currency)}
        </span>
      </div>
      <div className={row}>
        <label className="flex items-center gap-2 text-neutral-400">
          Tax
          <input
            inputMode="decimal"
            value={taxRate}
            onChange={(e) => onTaxRate(e.target.value)}
            placeholder="0"
            aria-label="Tax percent"
            className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-[16px] text-white outline-none focus:border-cyan-400/60 sm:text-sm"
          />
          %
        </label>
        <span className="text-white">
          {money(Math.round(t.tax * 100), currency)}
        </span>
      </div>
      <div
        className={`${row} border-t border-white/10 pt-2 text-base font-extrabold`}
      >
        <span className="text-white">{count ? "Each invoice" : "Total"}</span>
        <span className="text-white">
          {money(Math.round(t.total * 100), currency)}
        </span>
      </div>
      {count != null && count > 1 && (
        <div className={`${row} text-neutral-300`}>
          <span>× {count} clients</span>
          <span className="font-bold text-white">
            {money(Math.round(t.total * 100) * count, currency)}
          </span>
        </div>
      )}
    </div>
  );
}

export function OptionsFields({
  value,
  onChange,
}: {
  value: InvoiceOptions;
  onChange: (v: InvoiceOptions) => void;
}) {
  const set = <K extends keyof InvoiceOptions>(k: K, v: InvoiceOptions[K]) =>
    onChange({ ...value, [k]: v });
  const toggle = (d: number) =>
    set(
      "reminders",
      value.reminders.includes(d)
        ? value.reminders.filter((x) => x !== d)
        : [...value.reminders, d],
    );
  return (
    <>
      <FormBlock title="Due date and currency">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due date *">
            {(id) => (
              <input
                id={id}
                type="date"
                value={value.dueDate}
                min={todayISO()}
                max={maxDueISO()}
                onChange={(e) => set("dueDate", e.target.value)}
                className={FIELD}
                style={NUM_FONT}
              />
            )}
          </Field>
          <Field label="Currency">
            {(id) => (
              <select
                id={id}
                value={value.currency}
                onChange={(e) => set("currency", e.target.value)}
                className={FIELD}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </FormBlock>
      <FormBlock title="Notes and terms">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notes">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={value.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Notes for the client…"
                className={`${FIELD} resize-none`}
              />
            )}
          </Field>
          <Field label="Terms">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={value.terms}
                onChange={(e) => set("terms", e.target.value)}
                placeholder="Payment terms…"
                className={`${FIELD} resize-none`}
              />
            )}
          </Field>
        </div>
      </FormBlock>
      <FormBlock title="Payment reminders">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Payment reminders"
        >
          {REMINDER_OPTIONS.map((o) => {
            const on = value.reminders.includes(o.dayOffset);
            return (
              <button
                key={o.dayOffset}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.dayOffset)}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  on
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-500">
          We email the client a reminder on the days you pick.
        </p>
      </FormBlock>
    </>
  );
}
