"use client";

import { useState, useMemo } from "react";
import {
  allForms,
  federalForms,
  stateForms,
  formCategories,
  allStates,
  getFormFields,
  getPdfUrl,
  getInstructionsUrl,
  getStateTaxUrl,
  type TaxForm,
  type FormField,
} from "@/lib/tax-forms-data";
import { SearchIcon, FormIcon, XIcon, PenIcon } from "@/components/ui/icons";

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

type Scope = "federal" | "state";

export function TaxFormsClient() {
  const [scope, setScope] = useState<Scope>("federal");
  const [category, setCategory] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedForm, setSelectedForm] = useState<TaxForm | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [view, setView] = useState<"edit" | "preview">("edit");

  const filteredForms = useMemo(() => {
    let forms = scope === "federal" ? federalForms : stateForms;

    if (category) {
      forms = forms.filter((f) => f.category === category);
    }

    if (scope === "state" && stateFilter) {
      forms = forms.filter((f) => f.state === stateFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      forms = forms.filter(
        (f) =>
          f.number.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)
      );
    }

    return forms;
  }, [scope, category, stateFilter, search]);

  const fields = useMemo(
    () => (selectedForm ? getFormFields(selectedForm) : []),
    [selectedForm]
  );

  const fieldSections = useMemo(() => {
    const sections: Record<string, FormField[]> = {};
    for (const field of fields) {
      if (!sections[field.section]) sections[field.section] = [];
      sections[field.section].push(field);
    }
    return sections;
  }, [fields]);

  function selectForm(form: TaxForm) {
    setSelectedForm(form);
    setFormValues({});
    setView("edit");
  }

  function handleFieldChange(fieldId: string, value: string) {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  // Filter categories based on scope
  const relevantCategories = useMemo(() => {
    if (scope === "state") return ["State Forms"];
    return formCategories.filter((c) => c !== "State Forms");
  }, [scope]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ color: "var(--text-main)" }}
        >
          Tax Forms
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Browse, fill, and print IRS and state tax forms
        </p>
      </div>

      {selectedForm ? (
        /* Form Editor/Preview */
        <div className="space-y-4">
          {/* Form header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedForm(null)}
                className="p-1.5 rounded-lg border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-black" style={{ color: "var(--text-main)" }}>
                  Form {selectedForm.number}
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {selectedForm.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Download PDF button */}
              {(() => {
                const pdfUrl = getPdfUrl(selectedForm);
                const stateUrl = getStateTaxUrl(selectedForm);
                const instrUrl = getInstructionsUrl(selectedForm);
                const url = pdfUrl || stateUrl;
                return url ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                      {pdfUrl ? "Download PDF" : "State Forms"}
                    </a>
                    {instrUrl && (
                      <a
                        href={instrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                        Instructions
                      </a>
                    )}
                  </>
                ) : null;
              })()}
              <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
                <button
                  onClick={() => setView("edit")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === "edit" ? "bg-blue-500/20 text-blue-400" : ""
                  }`}
                  style={{ color: view === "edit" ? undefined : "var(--text-muted)" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setView("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === "preview" ? "bg-blue-500/20 text-blue-400" : ""
                  }`}
                  style={{ color: view === "preview" ? undefined : "var(--text-muted)" }}
                >
                  Preview
                </button>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
              >
                Print / Download
              </button>
            </div>
          </div>

          {view === "edit" ? (
            /* Edit mode — dynamic form fields */
            <div className="glass-card rounded-2xl p-6">
              <div className="max-w-2xl space-y-8">
                {Object.entries(fieldSections).map(([section, sectionFields]) => (
                  <div key={section}>
                    <h3
                      className="text-xs font-bold uppercase tracking-widest mb-4 pb-2 border-b border-[var(--glass-border)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {section}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sectionFields.map((field) => (
                        <div key={field.id}>
                          <label
                            className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {field.label}
                          </label>
                          {field.type === "select" ? (
                            <select
                              value={formValues[field.id] || ""}
                              onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
                              style={{ color: "var(--text-main)" }}
                            >
                              <option value="">Select...</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : "text"}
                              value={formValues[field.id] || ""}
                              onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder || ""}
                              className="w-full px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
                              style={{ color: "var(--text-main)" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Preview mode — IRS-style form layout */
            <div className="glass-card rounded-2xl p-6">
              <div className="max-w-2xl mx-auto bg-white text-black p-8 rounded-lg min-h-[500px]">
                <div className="text-center border-b-2 border-black pb-4 mb-4">
                  <p className="text-xs">Department of the Treasury — Internal Revenue Service</p>
                  <p className="text-2xl font-bold mt-1">Form {selectedForm.number}</p>
                  <p className="text-sm">{selectedForm.name}</p>
                </div>
                <div className="space-y-3 text-sm">
                  {Object.entries(fieldSections).map(([section, sectionFields]) => (
                    <div key={section}>
                      <p className="font-bold text-xs uppercase border-b border-gray-300 pb-1 mb-2">
                        {section}
                      </p>
                      {sectionFields.map((field) => (
                        <div key={field.id} className="flex items-center gap-2 py-1">
                          <span className="text-xs text-gray-600 w-40 shrink-0">
                            {field.label}:
                          </span>
                          <span className="border-b border-gray-300 flex-1 min-h-[1.2em] text-sm">
                            {formValues[field.id] || ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Form Browser */
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search forms by number or name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ color: "var(--text-main)" }}
              />
            </div>

            {/* Scope toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
              <button
                onClick={() => { setScope("federal"); setCategory(""); setStateFilter(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scope === "federal" ? "bg-blue-500/20 text-blue-400" : ""
                }`}
                style={{ color: scope === "federal" ? undefined : "var(--text-muted)" }}
              >
                Federal
              </button>
              <button
                onClick={() => { setScope("state"); setCategory(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scope === "state" ? "bg-blue-500/20 text-blue-400" : ""
                }`}
                style={{ color: scope === "state" ? undefined : "var(--text-muted)" }}
              >
                State
              </button>
            </div>

            {/* Category filter */}
            {scope === "federal" && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none"
                style={{ color: "var(--text-main)" }}
              >
                <option value="">All Categories</option>
                {relevantCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* State filter */}
            {scope === "state" && (
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none"
                style={{ color: "var(--text-main)" }}
              >
                <option value="">All States</option>
                {allStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* Results count */}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filteredForms.length} forms found
          </p>

          {/* Forms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredForms.slice(0, 60).map((form) => {
              const pdfLink = getPdfUrl(form) || getStateTaxUrl(form);
              return (
                <div
                  key={form.id}
                  className="glass-card rounded-xl p-4 text-left hover:border-blue-500/30 transition-colors group relative"
                >
                  <button
                    onClick={() => selectForm(form)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                          <FormIcon className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                            {form.number}
                          </p>
                          {form.state && (
                            <span className="text-[10px] font-bold text-cyan-400">
                              {form.state}
                            </span>
                          )}
                        </div>
                      </div>
                      <PenIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                    </div>
                    <p className="text-xs font-medium mb-1 line-clamp-1" style={{ color: "var(--text-main)" }}>
                      {form.name}
                    </p>
                    <p className="text-[10px] line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {form.description}
                    </p>
                  </button>
                  {pdfLink && (
                    <a
                      href={pdfLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-3 right-3 p-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/10 transition-all"
                      title="Download official PDF"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {filteredForms.length > 60 && (
            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Showing 60 of {filteredForms.length} forms. Use search to narrow results.
            </p>
          )}
        </>
      )}
    </div>
  );
}
