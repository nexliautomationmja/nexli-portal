"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OrganizerSection, Field } from "@/lib/tax-organizer-questions";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface OrganizerData {
  id: string;
  clientName: string;
  taxYear: string;
  returnType: string;
  status: string;
  message: string | null;
  generatedDocuments: { document: string; category: string }[] | null;
  expiresAt: string | null;
}

interface SectionData {
  id: string;
  sectionKey: string;
  data: Record<string, unknown>;
  isComplete: boolean;
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="20" height="10" rx="1" />
      <path d="M12 2 2 10h20L12 2Z" />
      <path d="M6 10v10" />
      <path d="M10 10v10" />
      <path d="M14 10v10" />
      <path d="M18 10v10" />
    </svg>
  );
}

/* ================================================================== */
/*  Bank Name Lookup for Routing Number                                */
/* ================================================================== */

function BankNameLookup({ routingNumber, accountNumber, confirmAccountNumber }: { routingNumber: string; accountNumber: string; confirmAccountNumber: string }) {
  const [bankInfo, setBankInfo] = useState<{ bankName: string; city?: string; state?: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const lastLookedUp = useRef("");

  const digits = (routingNumber || "").replace(/\D/g, "");

  useEffect(() => {
    if (digits.length === 9 && digits !== lastLookedUp.current) {
      lastLookedUp.current = digits;
      setLookingUp(true);
      setInvalid(false);
      fetch(`/api/portal/routing-lookup?rn=${digits}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error && !data.bankName) {
            setBankInfo(null);
            setInvalid(true);
          } else if (data.bankName) {
            setBankInfo({ bankName: data.bankName, city: data.city, state: data.state });
            setInvalid(false);
          } else {
            setBankInfo(null);
            setInvalid(false);
          }
        })
        .catch(() => { setBankInfo(null); setInvalid(false); })
        .finally(() => setLookingUp(false));
    } else if (digits.length < 9) {
      setBankInfo(null);
      setInvalid(false);
      lastLookedUp.current = "";
    }
  }, [digits]);

  const acct = (accountNumber || "").trim();
  const confirmAcct = (confirmAccountNumber || "").trim();
  const accountMismatch = acct.length > 0 && confirmAcct.length > 0 && acct !== confirmAcct;
  const accountMatch = acct.length > 0 && confirmAcct.length > 0 && acct === confirmAcct;

  const hasContent = lookingUp || bankInfo || invalid || accountMismatch || accountMatch;
  if (!hasContent) return null;

  return (
    <div className="mt-3 space-y-2">
      {lookingUp && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Looking up bank...</span>
        </div>
      )}

      {!lookingUp && bankInfo && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <BankIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              {bankInfo.bankName}
            </p>
            {(bankInfo.city || bankInfo.state) && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {[bankInfo.city, bankInfo.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {!lookingUp && invalid && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-sm">Invalid routing number</span>
        </div>
      )}

      {accountMismatch && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-sm">Account numbers do not match</span>
        </div>
      )}

      {accountMatch && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 text-sm">Account numbers match</span>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  SSN Input helper                                                   */
/* ================================================================== */

function SsnInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const raw = (value || "").replace(/\D/g, "").slice(0, 9);
  const formatted = raw.length > 5
    ? `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`
    : raw.length > 3
      ? `${raw.slice(0, 3)}-${raw.slice(3)}`
      : raw;
  return (
    <input
      type="password"
      value={formatted}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
      placeholder="XXX-XX-XXXX"
      maxLength={11}
      className={className}
      style={{ color: "var(--text-main)" }}
      autoComplete="off"
    />
  );
}

/* ================================================================== */
/*  Return type labels                                                 */
/* ================================================================== */

const returnTypeLabels: Record<string, string> = {
  "1040": "Individual Tax Return (1040)",
  "1120": "C Corporation (1120)",
  "1120S": "S Corporation (1120-S)",
  "1065": "Partnership (1065)",
  "1041": "Estate / Trust (1041)",
};

/* ================================================================== */
/*  Field Renderer                                                     */
/* ================================================================== */

function FieldRenderer({
  field,
  value,
  onChange,
  sectionData,
}: {
  field: Field;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
  sectionData: Record<string, unknown>;
}) {
  // Check showIf condition
  if (field.showIf) {
    const condVal = sectionData[field.showIf.field];
    if (Array.isArray(field.showIf.value)) {
      if (!field.showIf.value.includes(condVal as string)) return null;
    } else {
      if (condVal !== field.showIf.value) return null;
    }
  }

  const inputClasses = "w-full px-3 py-2.5 sm:py-2 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors";

  switch (field.type) {
    case "heading":
      return (
        <div className="col-span-1 sm:col-span-2 pt-5 pb-1 border-b border-[var(--card-border)]">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            {field.label}
          </h3>
        </div>
      );

    case "text":
    case "phone":
    case "email":
      return (
        <div className={field.half ? "" : "sm:col-span-2"}>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <input
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || ""}
            className={inputClasses}
            style={{ color: "var(--text-main)" }}
          />
        </div>
      );

    case "ssn": {
      const rawSsn = ((value as string) || "").replace(/\D/g, "").slice(0, 9);
      const formattedSsn = rawSsn.length > 5
        ? `${rawSsn.slice(0, 3)}-${rawSsn.slice(3, 5)}-${rawSsn.slice(5)}`
        : rawSsn.length > 3
          ? `${rawSsn.slice(0, 3)}-${rawSsn.slice(3)}`
          : rawSsn;
      return (
        <div className={field.half ? "" : "sm:col-span-2"}>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <input
            type="password"
            value={formattedSsn}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
              onChange(field.key, digits);
            }}
            placeholder="XXX-XX-XXXX"
            maxLength={11}
            className={inputClasses}
            style={{ color: "var(--text-main)" }}
            autoComplete="off"
          />
        </div>
      );
    }

    case "date":
      return (
        <div className={field.half ? "" : "sm:col-span-2"}>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={inputClasses}
            style={{ color: "var(--text-main)" }}
          />
        </div>
      );

    case "currency":
      return (
        <div className={field.half ? "" : "sm:col-span-2"}>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={(value as string) || ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                onChange(field.key, raw);
              }}
              placeholder="0.00"
              className={cn(inputClasses, "pl-7")}
              style={{ color: "var(--text-main)" }}
            />
          </div>
        </div>
      );

    case "select":
      return (
        <div className={field.half ? "" : "sm:col-span-2"}>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <select
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={inputClasses}
            style={{ color: "var(--text-main)" }}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "radio":
      return (
        <div className="col-span-1 sm:col-span-2">
          <p className="block text-sm font-medium mb-2" style={{ color: "var(--text-main)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {field.options?.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(field.key, opt.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg border cursor-pointer transition-colors text-sm min-h-[44px] sm:min-h-0",
                  value === opt.value
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[var(--card-border)] hover:bg-[var(--input-bg)]"
                )}
                style={{ color: "var(--text-main)" }}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    value === opt.value ? "border-blue-500" : "border-[var(--card-border)]"
                  )}
                >
                  {value === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );

    case "textarea":
      return (
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {field.label}{field.required && <span className="text-red-400"> *</span>}
          </label>
          <textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || ""}
            rows={4}
            className={inputClasses}
            style={{ color: "var(--text-main)", resize: "vertical" }}
          />
        </div>
      );

    case "checkbox-group":
      return (
        <div className="col-span-1 sm:col-span-2">
          <p className="block text-sm font-medium mb-3" style={{ color: "var(--text-main)" }}>
            {field.label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {field.items?.map((item) => {
              const group = (value as Record<string, boolean>) || {};
              const checked = !!group[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const updated = { ...group, [item.key]: !checked };
                    onChange(field.key, updated);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-lg border cursor-pointer transition-colors text-sm text-left min-h-[44px]",
                    checked
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-[var(--card-border)] hover:bg-[var(--input-bg)]"
                  )}
                  style={{ color: "var(--text-main)" }}
                >
                  <div
                    className={cn(
                      "w-5 h-5 sm:w-4 sm:h-4 rounded border flex items-center justify-center shrink-0",
                      checked ? "bg-blue-500 border-blue-500" : "border-[var(--card-border)]"
                    )}
                  >
                    {checked && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "repeater":
      return (
        <RepeaterField
          field={field}
          value={value as Record<string, unknown>[] | undefined}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

/* ================================================================== */
/*  Repeater Field (dependents, officers, etc.)                        */
/* ================================================================== */

function RepeaterField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: Record<string, unknown>[] | undefined;
  onChange: (key: string, val: unknown) => void;
}) {
  const items = value || [];

  function addItem() {
    const empty: Record<string, unknown> = {};
    field.subFields?.forEach((sf) => {
      empty[sf.key] = "";
    });
    onChange(field.key, [...items, empty]);
  }

  function removeItem(index: number) {
    onChange(field.key, items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, subKey: string, subVal: unknown) {
    const updated = [...items];
    updated[index] = { ...updated[index], [subKey]: subVal };
    onChange(field.key, updated);
  }

  return (
    <div className="col-span-1 sm:col-span-2 space-y-3">
      <label className="block text-sm font-medium" style={{ color: "var(--text-main)" }}>
        {field.label}
      </label>

      {items.map((item, idx) => (
        <div key={idx} className="p-3 sm:p-4 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="text-red-400 hover:text-red-300 transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0 sm:p-0"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field.subFields?.map((sf) => {
              const inputClasses = "w-full px-3 py-2.5 sm:py-2 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors";
              return (
                <div key={sf.key} className={sf.half ? "" : "sm:col-span-2"}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {sf.label}{sf.required && <span className="text-red-400"> *</span>}
                  </label>
                  {sf.type === "select" ? (
                    <select
                      value={(item[sf.key] as string) || ""}
                      onChange={(e) => updateItem(idx, sf.key, e.target.value)}
                      className={inputClasses}
                      style={{ color: "var(--text-main)" }}
                    >
                      <option value="">Select...</option>
                      {sf.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : sf.type === "ssn" ? (
                    <SsnInput
                      value={(item[sf.key] as string) || ""}
                      onChange={(v) => updateItem(idx, sf.key, v)}
                      className={inputClasses}
                    />
                  ) : sf.type === "date" ? (
                    <input
                      type="date"
                      value={(item[sf.key] as string) || ""}
                      onChange={(e) => updateItem(idx, sf.key, e.target.value)}
                      className={inputClasses}
                      style={{ color: "var(--text-main)" }}
                    />
                  ) : sf.type === "currency" ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={(item[sf.key] as string) || ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, "");
                          updateItem(idx, sf.key, raw);
                        }}
                        placeholder="0.00"
                        className={cn(inputClasses, "pl-7")}
                        style={{ color: "var(--text-main)" }}
                      />
                    </div>
                  ) : (
                    <input
                      type={sf.type === "phone" ? "tel" : sf.type === "email" ? "email" : "text"}
                      value={(item[sf.key] as string) || ""}
                      onChange={(e) => updateItem(idx, sf.key, e.target.value)}
                      className={inputClasses}
                      style={{ color: "var(--text-main)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add {field.label.replace(/s$/, "")}
      </button>
    </div>
  );
}

/* ================================================================== */
/*  Main Organizer Form Component                                      */
/* ================================================================== */

export function OrganizerFormClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [organizer, setOrganizer] = useState<OrganizerData | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [questionDefs, setQuestionDefs] = useState<OrganizerSection[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionFormData, setSectionFormData] = useState<Record<string, Record<string, unknown>>>({});
  const [showComplete, setShowComplete] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Load organizer data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/tax-organizer/${id}`);
        if (!res.ok) {
          router.push("/portal/dashboard/tax-organizer");
          return;
        }
        const data = await res.json();
        setOrganizer(data.organizer);
        setSections(data.sections);
        setQuestionDefs(data.questionDefs);

        // Initialize form data from saved sections
        const formData: Record<string, Record<string, unknown>> = {};
        for (const section of data.sections) {
          formData[section.sectionKey] = (section.data || {}) as Record<string, unknown>;
        }
        // Make sure all sections have entries
        for (const def of data.questionDefs) {
          if (!formData[def.key]) {
            formData[def.key] = {};
          }
        }
        setSectionFormData(formData);
      } catch {
        router.push("/portal/dashboard/tax-organizer");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  // Save section data to API
  const saveSection = useCallback(async (sectionKey: string, data: Record<string, unknown>, markComplete: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/tax-organizer/${id}/sections/${sectionKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, isComplete: markComplete }),
      });
      if (res.ok) {
        const result = await res.json();
        // Update local sections state
        setSections((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.sectionKey === sectionKey);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], data, isComplete: markComplete };
          }
          return updated;
        });
        return result;
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
    return null;
  }, [id]);

  // Auto-save when navigating between sections (debounced)
  const debouncedSave = useCallback((sectionKey: string, data: Record<string, unknown>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveSection(sectionKey, data, false);
    }, 1000);
  }, [saveSection]);

  // Handle field change with checkbox-group support
  function handleFieldChange(sectionKey: string, fieldKey: string, value: unknown) {
    setSectionFormData((prev) => {
      const sectionData = { ...prev[sectionKey], [fieldKey]: value };
      const updated = { ...prev, [sectionKey]: sectionData };
      debouncedSave(sectionKey, sectionData);
      return updated;
    });
  }

  // Handle checkbox-group toggle
  function handleCheckboxToggle(sectionKey: string, groupKey: string, itemKey: string) {
    setSectionFormData((prev) => {
      const sectionData = { ...prev[sectionKey] };
      const group = { ...(sectionData[groupKey] as Record<string, boolean> || {}) };
      group[itemKey] = !group[itemKey];
      sectionData[groupKey] = group;
      const updated = { ...prev, [sectionKey]: sectionData };
      debouncedSave(sectionKey, sectionData);
      return updated;
    });
  }

  // Navigate to previous section
  async function goToPrev() {
    if (currentSectionIdx > 0) {
      // Save current before navigating
      const currentKey = visibleDefs[currentSectionIdx].key;
      const data = sectionFormData[currentKey] || {};
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await saveSection(currentKey, data, false);
      setCurrentSectionIdx(currentSectionIdx - 1);
      window.scrollTo(0, 0);
    }
  }

  // Navigate to next section
  async function goToNext() {
    if (currentSectionIdx < visibleDefs.length - 1) {
      // Save current as complete before navigating
      const currentKey = visibleDefs[currentSectionIdx].key;
      const data = sectionFormData[currentKey] || {};
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await saveSection(currentKey, data, true);
      setCurrentSectionIdx(currentSectionIdx + 1);
      window.scrollTo(0, 0);
    }
  }

  // Submit the entire organizer
  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Save the last section as complete
      const lastKey = visibleDefs[currentSectionIdx].key;
      const lastData = sectionFormData[lastKey] || {};
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const result = await saveSection(lastKey, lastData, true);

      if (result?.organizerCompleted) {
        setShowComplete(true);
        setOrganizer((prev) => prev ? { ...prev, status: "completed", generatedDocuments: result.generatedDocuments } : prev);
      } else {
        // Not all sections are complete — find the first incomplete one
        const allSectionsData = sections.map((s) => ({
          key: s.sectionKey,
          isComplete: s.sectionKey === lastKey ? true : s.isComplete,
        }));
        const firstIncomplete = visibleDefs.findIndex((def) => {
          const saved = allSectionsData.find((s) => s.key === def.key);
          return !saved?.isComplete;
        });
        if (firstIncomplete >= 0) {
          setCurrentSectionIdx(firstIncomplete);
          window.scrollTo(0, 0);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Jump to a specific section
  async function jumpToSection(idx: number) {
    if (idx === currentSectionIdx) return;
    const currentKey = visibleDefs[currentSectionIdx].key;
    const data = sectionFormData[currentKey] || {};
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveSection(currentKey, data, false);
    setCurrentSectionIdx(idx);
    window.scrollTo(0, 0);
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading organizer...</p>
        </div>
      </div>
    );
  }

  if (!organizer || questionDefs.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <p style={{ color: "var(--text-muted)" }}>Organizer not found.</p>
        <Link href="/portal/dashboard/tax-organizer" className="text-blue-400 text-sm mt-2 inline-block">
          Back to Tax Organizers
        </Link>
      </div>
    );
  }

  // Completion screen
  if (showComplete || organizer.status === "completed" || organizer.status === "reviewed") {
    const docs = organizer.generatedDocuments || [];
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-main)" }}>
            Organizer Complete!
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Thank you for completing your {organizer.taxYear} tax organizer. Your CPA has been notified.
          </p>
        </div>

        {docs.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-main)" }}>
              Documents Needed
            </h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Based on your answers, your CPA needs the following documents. You can upload them from the Documents page.
            </p>
            <div className="space-y-2">
              {docs.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--card-border)]"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "var(--text-main)" }}>
                      {doc.document}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {doc.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link
                href="/portal/dashboard/documents"
                className="btn-primary text-sm px-4 py-2 no-underline inline-block"
              >
                Upload Documents
              </Link>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            href="/portal/dashboard/tax-organizer"
            className="text-blue-400 text-sm hover:underline"
          >
            Back to Tax Organizers
          </Link>
        </div>
      </div>
    );
  }

  // Filter out sections that shouldn't be shown based on cross-section logic
  const visibleDefs = questionDefs.filter((def) => {
    // Spouse section only shows for MFJ or MFS filing status
    if (def.key === "spouse_info") {
      const filingStatus = sectionFormData["personal_info"]?.filing_status;
      return filingStatus === "mfj" || filingStatus === "mfs";
    }
    return true;
  });

  // Clamp index if sections changed (e.g. spouse hidden)
  const clampedIdx = Math.min(currentSectionIdx, visibleDefs.length - 1);
  if (clampedIdx !== currentSectionIdx) {
    setCurrentSectionIdx(clampedIdx);
  }
  const currentSection = visibleDefs[clampedIdx];
  const currentData = sectionFormData[currentSection?.key] || {};
  const completedCount = sections.filter((s) => s.isComplete).length;
  const totalSections = visibleDefs.length;
  const isLastSection = currentSectionIdx === visibleDefs.length - 1;

  return (
    <div className="max-w-5xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Link
          href="/portal/dashboard/tax-organizer"
          className="text-xs no-underline hover:underline mb-2 inline-flex items-center gap-1"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeftIcon className="w-3 h-3" />
          Back to Tax Organizers
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text-main)" }}>
            {returnTypeLabels[organizer.returnType] || organizer.returnType}
          </h1>
          <span className="badge badge-gray">{organizer.taxYear}</span>
        </div>
        {organizer.message && (
          <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs font-medium text-blue-400 mb-1">Message from your CPA:</p>
            <p className="text-sm" style={{ color: "var(--text-main)" }}>{organizer.message}</p>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Left sidebar — section progress (desktop) */}
        <div className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-6 space-y-0.5">
            <div className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              {completedCount} of {totalSections} sections
            </div>
            {visibleDefs.map((def, idx) => {
              const sectionSaved = sections.find((s) => s.sectionKey === def.key);
              const isComplete = sectionSaved?.isComplete ?? false;
              const isCurrent = idx === currentSectionIdx;

              return (
                <button
                  key={def.key}
                  onClick={() => jumpToSection(idx)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                    isCurrent
                      ? "bg-blue-500/10 border border-blue-500/20 font-medium"
                      : "hover:bg-[var(--input-bg)]"
                  )}
                  style={{ color: isCurrent ? "var(--accent-blue)" : "var(--text-muted)" }}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                      isComplete
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                          : "bg-[var(--input-bg)] border border-[var(--card-border)]"
                    )}
                  >
                    {isComplete ? <CheckIcon className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className="truncate">{def.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main form area */}
        <div className="flex-1 min-w-0">
          {/* Mobile progress bar */}
          <div className="lg:hidden mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium">Step {currentSectionIdx + 1} of {totalSections}</span>
              <span>{completedCount} completed</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--input-bg)]">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((currentSectionIdx + 1) / totalSections) * 100}%` }}
              />
            </div>
            <p className="text-xs font-medium mt-1.5 truncate" style={{ color: "var(--accent-blue)" }}>
              {currentSection.title}
            </p>
          </div>

          {/* Section content */}
          <div className="glass-card p-4 sm:p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-main)" }}>
                {currentSection.title}
              </h2>
              {currentSection.description && (
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {currentSection.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {currentSection.fields.map((field) => {
                if (field.type === "checkbox-group") {
                  return (
                    <FieldRenderer
                      key={field.key}
                      field={field}
                      value={currentData[field.key]}
                      onChange={(key, val) => {
                        // For checkbox-group, we handle it specially
                        if (typeof val === "object" && val !== null) {
                          handleFieldChange(currentSection.key, key, val);
                        }
                      }}
                      sectionData={currentData}
                    />
                  );
                }

                return (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={currentData[field.key]}
                    onChange={(key, val) => handleFieldChange(currentSection.key, key, val)}
                    sectionData={currentData}
                  />
                );
              })}

            </div>

            {/* Bank name lookup + account confirmation for refund/payment section */}
            {currentSection.key === "refund_payment" && (
              <BankNameLookup
                routingNumber={(currentData.routing_number as string) || ""}
                accountNumber={(currentData.account_number as string) || ""}
                confirmAccountNumber={(currentData.confirm_account_number as string) || ""}
              />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between mt-6 gap-3 sm:gap-4">
            <button
              onClick={goToPrev}
              disabled={currentSectionIdx === 0 || saving}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                currentSectionIdx === 0
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-[var(--input-bg)] border border-[var(--card-border)] sm:border-0"
              )}
              style={{ color: "var(--text-muted)" }}
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              {saving && (
                <span className="text-xs hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                  Saving...
                </span>
              )}

              {isLastSection ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || saving}
                  className="btn-primary w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                >
                  {submitting ? "Submitting..." : "Submit Organizer"}
                </button>
              ) : (
                <button
                  onClick={goToNext}
                  disabled={saving}
                  className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
