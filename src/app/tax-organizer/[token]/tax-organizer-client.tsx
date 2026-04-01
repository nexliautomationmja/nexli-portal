"use client";

import { useState, useEffect, useCallback } from "react";

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
  "990": "Nonprofit (990)",
  other: "Tax Return",
};

const FILING_STATUSES = [
  "Single",
  "Married Filing Jointly",
  "Married Filing Separately",
  "Head of Household",
  "Qualifying Surviving Spouse",
];

const INCOME_SOURCES = [
  { id: "w2", label: "W-2 Employment" },
  { id: "selfEmployment", label: "Self-Employment / 1099-NEC" },
  { id: "interest", label: "Interest Income (1099-INT)" },
  { id: "dividends", label: "Dividends (1099-DIV)" },
  { id: "rental", label: "Rental Income" },
  { id: "socialSecurity", label: "Social Security Benefits" },
  { id: "retirement", label: "Retirement Distributions" },
  { id: "capitalGains", label: "Capital Gains / Losses" },
  { id: "unemployment", label: "Unemployment Compensation" },
  { id: "crypto", label: "Cryptocurrency Transactions" },
];

const DEDUCTIONS = [
  { id: "mortgage", label: "Mortgage Interest (1098)" },
  { id: "propertyTax", label: "Property Taxes" },
  { id: "charitable", label: "Charitable Donations" },
  { id: "medical", label: "Medical Expenses" },
  { id: "studentLoan", label: "Student Loan Interest" },
  { id: "education", label: "Education Credits / Tuition" },
  { id: "childcare", label: "Child / Dependent Care" },
  { id: "estimatedTax", label: "Estimated Tax Payments Made" },
  { id: "hsa", label: "HSA Contributions" },
  { id: "ira", label: "IRA Contributions" },
  { id: "homeOffice", label: "Home Office Expenses" },
  { id: "stateLocalTax", label: "State & Local Taxes (SALT)" },
];

const DOC_CATEGORIES = [
  "W-2",
  "1099-INT",
  "1099-DIV",
  "1099-NEC",
  "1099-MISC",
  "1098",
  "Bank Statement",
  "ID / License",
  "Other",
];

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

// ── Main Component ────────────────────────────────────────

export function TaxOrganizerClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [filingStatus, setFilingStatus] = useState("");
  const [incomeSources, setIncomeSources] = useState<Set<string>>(new Set());
  const [incomeOther, setIncomeOther] = useState("");
  const [deductions, setDeductions] = useState<Set<string>>(new Set());
  const [deductionOther, setDeductionOther] = useState("");
  const [dependents, setDependents] = useState<{ name: string; relationship: string; dob: string }[]>([]);
  const [notes, setNotes] = useState("");

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
        if (data.clientName) setFullName(data.clientName);
        if (data.clientEmail) setEmail(data.clientEmail);
      })
      .catch(() => setError("Unable to verify this link."))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleIncome = (id: string) => {
    setIncomeSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDeduction = (id: string) => {
    setDeductions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addDependent = () => {
    setDependents((prev) => [...prev, { name: "", relationship: "", dob: "" }]);
  };

  const updateDependent = (index: number, field: string, value: string) => {
    setDependents((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const removeDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const formDataObj = {
      fullName,
      email,
      phone,
      filingStatus,
      dependents: dependents.filter((d) => d.name.trim()),
      incomeSources: Array.from(incomeSources),
      incomeOther: incomeOther.trim(),
      deductions: Array.from(deductions),
      deductionOther: deductionOther.trim(),
      notes: notes.trim(),
    };

    const formData = new FormData();
    formData.append("formData", JSON.stringify(formDataObj));
    for (const f of files) {
      formData.append("files", f.file);
    }

    try {
      const res = await fetch(`/api/tax-organizer/${token}`, {
        method: "POST",
        body: formData,
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

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-[#1e1e2a] bg-[#0a0a12] text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder:text-[#4a4a5a]";
  const labelClass =
    "text-[10px] font-bold uppercase tracking-widest text-[#808090] block mb-1.5";
  const sectionClass =
    "rounded-2xl border border-[#1e1e2a] bg-[#0d0d15] p-5 md:p-6";

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
    return (
      <div className="min-h-screen bg-[#08080e] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Tax Organizer Submitted</h1>
          <p className="text-sm text-[#808090] leading-relaxed">
            Thank you, {fullName || "your information"}! Your tax organizer and {files.length > 0 ? `${files.length} document${files.length > 1 ? "s" : ""} have` : "responses have"} been securely submitted.
          </p>
          <p className="text-xs text-[#4a4a5a] mt-4">
            Your provider will review everything before your appointment. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  // ── Form ──
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
              {meta.taxYear} &bull; {RETURN_TYPE_LABELS[meta.returnType] || meta.returnType}
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
            {meta.clientName ? `Hi ${meta.clientName}, please` : "Please"} fill out the information below and upload any relevant documents to help prepare your {meta.taxYear} tax return.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Section 1: Personal Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">1</span>
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full legal name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Filing Status *</label>
              <select
                required
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
                className={inputClass}
              >
                <option value="">Select filing status...</option>
                {FILING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependents */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <label className={labelClass + " mb-0"}>Dependents</label>
              <button
                type="button"
                onClick={addDependent}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add Dependent
              </button>
            </div>
            {dependents.length === 0 && (
              <p className="text-xs text-[#4a4a5a]">No dependents added. Click &ldquo;+ Add Dependent&rdquo; if applicable.</p>
            )}
            {dependents.map((dep, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <input
                  type="text"
                  value={dep.name}
                  onChange={(e) => updateDependent(i, "name", e.target.value)}
                  placeholder="Name"
                  className={inputClass + " flex-1"}
                />
                <input
                  type="text"
                  value={dep.relationship}
                  onChange={(e) => updateDependent(i, "relationship", e.target.value)}
                  placeholder="Relationship"
                  className={inputClass + " w-32"}
                />
                <input
                  type="date"
                  value={dep.dob}
                  onChange={(e) => updateDependent(i, "dob", e.target.value)}
                  className={inputClass + " w-36"}
                />
                <button
                  type="button"
                  onClick={() => removeDependent(i)}
                  className="p-2 rounded hover:bg-red-500/10 text-red-400 transition-colors mt-0.5"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Income Sources */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">2</span>
            Income Sources
          </h2>
          <p className="text-xs text-[#808090] mb-4">Select all that apply for {meta.taxYear}.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {INCOME_SOURCES.map((source) => (
              <label
                key={source.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  incomeSources.has(source.id)
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "border-[#1e1e2a] hover:border-[#2a2a3a]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={incomeSources.has(source.id)}
                  onChange={() => toggleIncome(source.id)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-white">{source.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className={labelClass}>Other Income (describe)</label>
            <input
              type="text"
              value={incomeOther}
              onChange={(e) => setIncomeOther(e.target.value)}
              placeholder="Any other income sources..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Section 3: Deductions & Credits */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">3</span>
            Deductions &amp; Credits
          </h2>
          <p className="text-xs text-[#808090] mb-4">Select all that may apply.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DEDUCTIONS.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  deductions.has(item.id)
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "border-[#1e1e2a] hover:border-[#2a2a3a]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={deductions.has(item.id)}
                  onChange={() => toggleDeduction(item.id)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-white">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className={labelClass}>Other Deductions (describe)</label>
            <input
              type="text"
              value={deductionOther}
              onChange={(e) => setDeductionOther(e.target.value)}
              placeholder="Any other deductions or credits..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Section 4: Document Upload */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">4</span>
            Upload Documents
          </h2>
          <p className="text-xs text-[#808090] mb-4">
            Upload W-2s, 1099s, and any other relevant tax documents. You can also skip this and provide them later.
          </p>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {DOC_CATEGORIES.map((cat) => (
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
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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

        {/* Section 5: Additional Notes */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">5</span>
            Additional Notes
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else your tax professional should know? (life changes, new business, questions, etc.)"
            rows={4}
            className={inputClass + " resize-none"}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !fullName || !email || !filingStatus}
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
          Your information is encrypted and transmitted securely. This link expires{" "}
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
