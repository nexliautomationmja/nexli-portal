"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getFormSections,
  getDocCategories,
  type FormSection,
  type Question,
  type SelectQuestion,
  type RepeaterQuestion,
  type CheckboxGroupQuestion,
} from "@/lib/tax-organizer-forms";

interface LinkMeta {
  clientName: string | null;
  clientEmail: string | null;
  taxYear: string;
  returnType: string;
  expiresAt: string;
}

interface SelectedFile {
  file: File;
  category: string;
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  "1040": "Individual (1040)",
  "1120": "C-Corp (1120)",
  "1120S": "S-Corp (1120S)",
  "1065": "Partnership (1065)",
  "1041": "Estate/Trust (1041)",
  "990": "Nonprofit (990)",
  other: "Tax Return",
};

// ── Inline Icons ──────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
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

// ── Styles ────────────────────────────────────────────────

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-[#1e1e2a] bg-[#0a0a12] text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder:text-[#4a4a5a]";
const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[#808090] block mb-1.5";
const sectionClass =
  "rounded-2xl border border-[#1e1e2a] bg-[#0d0d15] p-5 md:p-6";

// ── Currency Input ────────────────────────────────────────

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a5a] text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.,]/g, "");
          onChange(v);
        }}
        placeholder={placeholder}
        className={inputClass + " pl-7"}
      />
    </div>
  );
}

// ── Yes/No Toggle ─────────────────────────────────────────

function YesNoToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(value === "yes" ? "" : "yes")}
        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
          value === "yes"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : "border-[#1e1e2a] text-[#808090] hover:border-[#2a2a3a]"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(value === "no" ? "" : "no")}
        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
          value === "no"
            ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-[#1e1e2a] text-[#808090] hover:border-[#2a2a3a]"
        }`}
      >
        No
      </button>
    </div>
  );
}

// ── Radio Group ───────────────────────────────────────────

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
          className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
            value === opt.value
              ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
              : "border-[#1e1e2a] text-[#808090] hover:border-[#2a2a3a]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Repeater Field ────────────────────────────────────────

function RepeaterField({
  question,
  rows,
  onChange,
}: {
  question: RepeaterQuestion;
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const addRow = () => {
    const empty: Record<string, string> = {};
    for (const f of question.fields) {
      empty[f.id] = "";
    }
    onChange([...rows, empty]);
  };

  const updateRow = (rowIdx: number, fieldId: string, value: string) => {
    onChange(
      rows.map((row, i) =>
        i === rowIdx ? { ...row, [fieldId]: value } : row
      )
    );
  };

  const removeRow = (rowIdx: number) => {
    onChange(rows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div>
      {rows.length === 0 && (
        <p className="text-xs text-[#4a4a5a] mb-2">
          No entries added. Click below to add one.
        </p>
      )}
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="rounded-lg border border-[#1e1e2a] bg-[#0a0a12] p-3 mb-2"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4a4a5a]">
              #{rowIdx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeRow(rowIdx)}
              className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {question.fields.map((field) => (
              <div key={field.id} className={field.width || ""}>
                <label className={labelClass}>{field.label}</label>
                {field.type === "currency" ? (
                  <CurrencyInput
                    value={row[field.id] || ""}
                    onChange={(v) => updateRow(rowIdx, field.id, v)}
                    placeholder={field.placeholder}
                  />
                ) : field.type === "yesNo" ? (
                  <YesNoToggle
                    value={row[field.id] || ""}
                    onChange={(v) => updateRow(rowIdx, field.id, v)}
                  />
                ) : field.type === "select" && field.options ? (
                  <select
                    value={row[field.id] || ""}
                    onChange={(e) => updateRow(rowIdx, field.id, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                    value={row[field.id] || ""}
                    onChange={(e) => updateRow(rowIdx, field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors mt-1"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        {question.addLabel}
      </button>
    </div>
  );
}

// ── Checkbox Group ────────────────────────────────────────

function CheckboxGroupField({
  question,
  selected,
  onChange,
}: {
  question: CheckboxGroupQuestion;
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {question.options.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            selected.has(opt.id)
              ? "border-blue-500/40 bg-blue-500/10"
              : "border-[#1e1e2a] hover:border-[#2a2a3a]"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.has(opt.id)}
            onChange={() => toggle(opt.id)}
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-sm text-white">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Generic Question Renderer ─────────────────────────────

function QuestionRenderer({
  question,
  formData,
  setFormValue,
}: {
  question: Question;
  formData: Record<string, unknown>;
  setFormValue: (id: string, value: unknown) => void;
}) {
  const value = (formData[question.id] as string) || "";

  switch (question.type) {
    case "text":
    case "email":
    case "phone":
      return (
        <div className={question.halfWidth ? "" : "md:col-span-2"}>
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <input
            type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "text"}
            required={question.required}
            value={value}
            onChange={(e) => setFormValue(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        </div>
      );

    case "number":
      return (
        <div className={question.halfWidth ? "" : "md:col-span-2"}>
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setFormValue(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        </div>
      );

    case "date":
      return (
        <div className={question.halfWidth ? "" : "md:col-span-2"}>
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <input
            type="date"
            value={value}
            onChange={(e) => setFormValue(question.id, e.target.value)}
            className={inputClass}
          />
        </div>
      );

    case "currency":
      return (
        <div className={question.halfWidth ? "" : "md:col-span-2"}>
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <CurrencyInput
            value={value}
            onChange={(v) => setFormValue(question.id, v)}
            placeholder={question.placeholder}
          />
        </div>
      );

    case "yesNo":
      return (
        <div className="md:col-span-2">
          <div className="flex items-start justify-between gap-4 py-1">
            <label className="text-sm text-white leading-snug flex-1">
              {question.label}
            </label>
            <YesNoToggle
              value={value}
              onChange={(v) => setFormValue(question.id, v)}
            />
          </div>
        </div>
      );

    case "select":
      return (
        <div className={question.halfWidth ? "" : "md:col-span-2"}>
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <select
            required={question.required}
            value={value}
            onChange={(e) => setFormValue(question.id, e.target.value)}
            className={inputClass}
          >
            <option value="">Select...</option>
            {(question as SelectQuestion).options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "radio":
      return (
        <div className="md:col-span-2">
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <RadioGroup
            options={(question as SelectQuestion).options}
            value={value}
            onChange={(v) => setFormValue(question.id, v)}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="md:col-span-2">
          <label className={labelClass}>
            {question.label}
            {question.required && " *"}
          </label>
          <textarea
            value={value}
            onChange={(e) => setFormValue(question.id, e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            className={inputClass + " resize-none"}
          />
        </div>
      );

    case "checkboxGroup":
      return (
        <div className="md:col-span-2">
          <CheckboxGroupField
            question={question as CheckboxGroupQuestion}
            selected={(formData[question.id] as Set<string>) || new Set()}
            onChange={(selected) => setFormValue(question.id, selected)}
          />
        </div>
      );

    case "repeater":
      return (
        <div className="md:col-span-2">
          <RepeaterField
            question={question as RepeaterQuestion}
            rows={(formData[question.id] as Record<string, string>[]) || []}
            onChange={(rows) => setFormValue(question.id, rows)}
          />
        </div>
      );

    default:
      return null;
  }
}

// ── Section Renderer ──────────────────────────────────────

function SectionRenderer({
  section,
  sectionIndex,
  formData,
  setFormValue,
  taxYear,
}: {
  section: FormSection;
  sectionIndex: number;
  formData: Record<string, unknown>;
  setFormValue: (id: string, value: unknown) => void;
  taxYear: string;
}) {
  return (
    <div className={sectionClass}>
      <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
          {sectionIndex + 1}
        </span>
        {section.title}
      </h2>
      {section.description && (
        <p className="text-xs text-[#808090] mb-4 ml-8">
          {section.description.replace("{taxYear}", taxYear)}
        </p>
      )}
      {!section.description && <div className="mb-4" />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.questions.map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            formData={formData}
            setFormValue={setFormValue}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export function TaxOrganizerClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Generic form data store — all question values keyed by question ID
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // File upload state
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Other");

  // Validate token on mount
  useEffect(() => {
    fetch(`/api/tax-organizer/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "This link is invalid or has expired.");
          return;
        }
        const data = await res.json();
        setMeta(data);
        // Pre-fill known values
        const initial: Record<string, unknown> = {};
        if (data.clientName) initial.fullName = data.clientName;
        if (data.clientEmail) initial.email = data.clientEmail;
        // For S-Corp/C-Corp/Partnership, pre-fill legalName and representative email
        if (data.clientName) initial.legalName = data.clientName;
        if (data.clientEmail) initial.representativeEmail = data.clientEmail;
        setFormData(initial);
      })
      .catch(() => setError("Unable to verify this link."))
      .finally(() => setLoading(false));
  }, [token]);

  const setFormValue = useCallback((id: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [
        ...prev,
        ...droppedFiles.map((file) => ({ file, category: selectedCategory })),
      ]);
    },
    [selectedCategory]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setFiles((prev) => [
      ...prev,
      ...selected.map((file) => ({ file, category: selectedCategory })),
    ]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Serialize form data for submission — convert Sets to arrays, etc.
  const serializeFormData = () => {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value instanceof Set) {
        serialized[key] = Array.from(value);
      } else {
        serialized[key] = value;
      }
    }
    // Include return type for context
    serialized._returnType = meta?.returnType;
    return serialized;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const fd = new FormData();
    fd.append("formData", JSON.stringify(serializeFormData()));
    for (const f of files) {
      fd.append("files", f.file);
    }

    try {
      const res = await fetch(`/api/tax-organizer/${token}`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Determine if form has minimum required fields filled
  const isFormValid = () => {
    if (!meta) return false;
    const rt = meta.returnType;
    if (rt === "1040") {
      return !!(formData.fullName && formData.email && formData.filingStatus);
    }
    // For business forms, require legal name and EIN
    return !!(formData.legalName && formData.ein);
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#808090]">Verifying your link...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !meta) {
    return (
      <div className="min-h-screen bg-[#08080e] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <XIcon className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Link Unavailable</h1>
          <p className="text-sm text-[#808090] leading-relaxed">{error}</p>
          <p className="text-xs text-[#4a4a5a] mt-4">
            If you believe this is an error, please contact your service provider.
          </p>
        </div>
      </div>
    );
  }

  // ── Success State ──
  if (submitted) {
    const displayName = (formData.fullName as string) || (formData.legalName as string) || "";
    return (
      <div className="min-h-screen bg-[#08080e] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Tax Organizer Submitted</h1>
          <p className="text-sm text-[#808090] leading-relaxed">
            Thank you{displayName ? `, ${displayName}` : ""}! Your tax organizer and{" "}
            {files.length > 0
              ? `${files.length} document${files.length > 1 ? "s" : ""} have`
              : "responses have"}{" "}
            been securely submitted.
          </p>
          <p className="text-xs text-[#4a4a5a] mt-4">
            Your provider will review everything before your appointment. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  const sections = getFormSections(meta.returnType);
  const docCategories = getDocCategories(meta.returnType);
  const totalSections = sections.length + 1; // +1 for document upload

  return (
    <div className="min-h-screen bg-[#08080e]">
      {/* Header */}
      <div className="border-b border-[#1e1e2a] bg-[#0a0a12]">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logos/nexli-logo-white-wordmark@2x.png"
              alt="Nexli"
              className="h-6"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#808090]">
              Tax Organizer
            </p>
            <p className="text-xs text-[#4a4a5a]">
              {meta.taxYear} &bull;{" "}
              {RETURN_TYPE_LABELS[meta.returnType] || meta.returnType}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Intro */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Complete Your Tax Organizer
          </h1>
          <p className="text-sm text-[#808090] max-w-lg mx-auto">
            {meta.clientName ? `Hi ${meta.clientName}, please` : "Please"} fill
            out the information below and upload any relevant documents to help
            prepare your {meta.taxYear}{" "}
            {RETURN_TYPE_LABELS[meta.returnType]?.toLowerCase() || "tax"} return.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Dynamic form sections */}
        {sections.map((section, idx) => (
          <SectionRenderer
            key={section.id}
            section={section}
            sectionIndex={idx}
            formData={formData}
            setFormValue={setFormValue}
            taxYear={meta.taxYear}
          />
        ))}

        {/* Document Upload section (always shown) */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
              {totalSections}
            </span>
            Upload Documents
          </h2>
          <p className="text-xs text-[#808090] mb-4">
            Upload financial statements, tax forms, and any other relevant documents.
            You can also skip this and provide them later.
          </p>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {docCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  selectedCategory === cat
                    ? "border-blue-500/40 bg-blue-500/20 text-blue-400"
                    : "border-[#1e1e2a] text-[#808090] hover:border-[#2a2a3a]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? "border-blue-500 bg-blue-500/5"
                : "border-[#1e1e2a] hover:border-[#2a2a3a]"
            }`}
          >
            <UploadIcon className="w-8 h-8 mx-auto mb-3 text-[#4a4a5a]" />
            <p className="text-sm text-[#808090] mb-1">
              Drag &amp; drop files here
            </p>
            <p className="text-xs text-[#4a4a5a] mb-4">or</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-[#1e1e2a] text-white cursor-pointer hover:border-blue-500/30 transition-colors">
              <UploadIcon className="w-4 h-4" />
              Choose Files
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt"
              />
            </label>
            <p className="text-[10px] text-[#4a4a5a] mt-3">
              PDF, images, spreadsheets &bull; 25MB max per file
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#1e1e2a] bg-[#0a0a12]"
                >
                  <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.file.name}</p>
                    <p className="text-[10px] text-[#4a4a5a]">
                      {formatFileSize(f.file.size)} &bull; {f.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !isFormValid()}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckIcon className="w-5 h-5" />
              Submit Tax Organizer
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-[#4a4a5a]">
          Your information is encrypted and transmitted securely. This link
          expires{" "}
          {new Date(meta.expiresAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          .
        </p>
      </form>

      {/* Footer */}
      <div className="border-t border-[#1e1e2a] py-6 text-center">
        <p className="text-[10px] text-[#4a4a5a]">
          Protected by Nexli Automation &bull; Secure &amp; Encrypted
        </p>
      </div>
    </div>
  );
}
