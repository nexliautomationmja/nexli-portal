"use client";

import { useState, useMemo } from "react";
import {
  allForms,
  federalForms,
  stateForms,
  formCategories,
  allStates,
  documentRequestScenarios,
  getScenarioForForm,
  getPdfUrl,
  getInstructionsUrl,
  getStateTaxUrl,
  type TaxForm,
  type DocumentRequestScenario,
  type DocumentRequirement,
} from "@/lib/tax-forms-data";
import { createDocumentLink } from "@/lib/hooks/use-document-links";
import {
  SearchIcon,
  FormIcon,
  XIcon,
  CheckIcon,
  PlusIcon,
  SendIcon,
} from "@/components/ui/icons";

/* ─── Inline icons ─────────────────────────────────────── */

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

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 18H3" />
      <path d="M11 12H3" />
      <path d="M11 6H3" />
      <path d="m15 18 2 2 4-4" />
      <path d="m15 12 2 2 4-4" />
      <path d="m15 6 2 2 4-4" />
    </svg>
  );
}

type Tab = "request" | "reference";
type Scope = "federal" | "state";

/* ─── Main Component ───────────────────────────────────── */

export function TaxFormsClient() {
  const [activeTab, setActiveTab] = useState<Tab>("request");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-main)" }}
          >
            Tax Center
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Request documents from clients and browse IRS form reference
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg border border-[var(--glass-border)] w-fit"
        style={{ background: "var(--glass-bg)" }}
      >
        <button
          onClick={() => setActiveTab("request")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "request" ? "bg-blue-500/20 text-blue-400" : ""
          }`}
          style={{ color: activeTab === "request" ? undefined : "var(--text-muted)" }}
        >
          <ChecklistIcon className="w-4 h-4" />
          Request Documents
        </button>
        <button
          onClick={() => setActiveTab("reference")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "reference" ? "bg-blue-500/20 text-blue-400" : ""
          }`}
          style={{ color: activeTab === "reference" ? undefined : "var(--text-muted)" }}
        >
          <FormIcon className="w-4 h-4" />
          Form Reference
        </button>
      </div>

      {activeTab === "request" ? (
        <RequestDocumentsTab onSwitchToReference={() => setActiveTab("reference")} />
      ) : (
        <FormReferenceTab onRequestDocs={(scenario) => {
          setActiveTab("request");
          // The child component handles pre-selecting the scenario
        }} />
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Tab 1: Request Documents
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function RequestDocumentsTab({ onSwitchToReference }: { onSwitchToReference: () => void }) {
  const [selectedScenario, setSelectedScenario] = useState<DocumentRequestScenario | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  // Client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [messageText, setMessageText] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);

  // State
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ uploadUrl: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  function selectScenario(scenario: DocumentRequestScenario) {
    setSelectedScenario(scenario);
    setResult(null);
    // Pre-check required items
    const required = new Set(
      scenario.requirements.filter((r) => r.required).map((r) => r.id)
    );
    setCheckedDocs(required);
    setCustomItems([]);
    setCustomInput("");
  }

  function toggleDoc(id: string) {
    setCheckedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomItem() {
    const item = customInput.trim();
    if (item && !customItems.includes(item)) {
      setCustomItems((prev) => [...prev, item]);
      setCustomInput("");
    }
  }

  function removeCustomItem(index: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Group requirements by category
  const groupedRequirements = useMemo(() => {
    if (!selectedScenario) return {};
    const groups: Record<string, DocumentRequirement[]> = {};
    for (const req of selectedScenario.requirements) {
      if (!groups[req.category]) groups[req.category] = [];
      groups[req.category].push(req);
    }
    return groups;
  }, [selectedScenario]);

  async function handleSubmit() {
    if (!selectedScenario) return;

    const selectedDocs = selectedScenario.requirements
      .filter((r) => checkedDocs.has(r.id))
      .map((r) => r.label);
    const allDocs = [...selectedDocs, ...customItems];

    if (allDocs.length === 0) return;

    setSubmitting(true);
    try {
      const data = await createDocumentLink({
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        message: messageText || undefined,
        requiredDocuments: allDocs,
        expiresInDays,
        deliveryMethod: clientEmail ? "email" : "manual",
      });

      setResult({
        uploadUrl: data.uploadUrl,
        emailSent: data.emailSent || false,
      });
    } catch (err) {
      console.error("Failed to create request:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyUrl() {
    if (!result) return;
    await navigator.clipboard.writeText(result.uploadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetForm() {
    setSelectedScenario(null);
    setCheckedDocs(new Set());
    setCustomItems([]);
    setCustomInput("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setMessageText("");
    setExpiresInDays(14);
    setResult(null);
    setCopied(false);
  }

  const totalChecked = checkedDocs.size + customItems.length;

  /* ── Success state ── */
  if (result) {
    return (
      <div className="glass-card p-8 max-w-xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckIcon className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>
            Request Created
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            {result.emailSent
              ? `Email sent to ${clientEmail} with the upload link.`
              : "Share the secure upload link with your client."}
          </p>
        </div>

        {/* URL copy */}
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 p-3 rounded-lg border border-[var(--glass-border)] text-left"
            style={{ background: "var(--glass-bg)" }}
          >
            <p
              className="flex-1 text-xs break-all font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {result.uploadUrl}
            </p>
            <button
              onClick={copyUrl}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
              style={{ color: "var(--text-main)" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {result.emailSent && (
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
              <MailIcon className="w-3.5 h-3.5" />
              Email delivered to {clientEmail}
            </div>
          )}
        </div>

        <button
          onClick={resetForm}
          className="px-6 py-2.5 rounded-lg text-sm font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
          style={{ color: "var(--text-main)" }}
        >
          Create Another Request
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      {!selectedScenario ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {documentRequestScenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => selectScenario(scenario)}
              className="glass-card rounded-lg p-4 text-left hover:border-blue-500/30 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <ClipboardIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>
                    {scenario.name}
                  </p>
                  <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {scenario.description}
                  </p>
                  <p className="text-[10px] mt-2 text-blue-400 font-bold">
                    {scenario.requirements.length} documents
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Back + scenario name */}
          <div className="flex items-center gap-3">
            <button
              onClick={resetForm}
              className="p-1.5 rounded-lg border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                {selectedScenario.name}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Select the documents you need from this client
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Document checklist (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {Object.entries(groupedRequirements).map(([category, reqs]) => (
                <div key={category} className="glass-card rounded-lg p-4">
                  <h3
                    className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-[var(--glass-border)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {reqs.map((req) => (
                      <label
                        key={req.id}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checkedDocs.has(req.id)}
                          onChange={() => toggleDoc(req.id)}
                          className="mt-0.5 w-4 h-4 rounded border-[var(--glass-border)] accent-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                            {req.label}
                            {req.required && (
                              <span className="ml-2 text-[9px] font-bold text-amber-400 uppercase">Required</span>
                            )}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {req.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Custom items */}
              <div className="glass-card rounded-lg p-4">
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-[var(--glass-border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Custom Items
                </h3>
                {customItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-sm" style={{ color: "var(--text-main)" }}>
                        {item}
                      </span>
                    </div>
                    <button
                      onClick={() => removeCustomItem(i)}
                      className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                    placeholder="Add custom document request..."
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                  <button
                    onClick={addCustomItem}
                    disabled={!customInput.trim()}
                    className="p-2 rounded-lg border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors disabled:opacity-30"
                  >
                    <PlusIcon className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Client info + submit (1 col) */}
            <div className="space-y-4">
              <div className="glass-card rounded-lg p-4 space-y-4">
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-[var(--glass-border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client Information
                </h3>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client's full name"
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {clientEmail ? "Upload link will be emailed automatically" : "Leave blank for manual link sharing"}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Message (optional)
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Hi, please upload the following documents for your tax return..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                    style={{ color: "var(--text-main)" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Link Expires In
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
                    style={{ color: "var(--text-main)" }}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              </div>

              {/* Summary + Submit */}
              <div className="glass-card rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                    Documents selected
                  </p>
                  <p className="text-sm font-bold text-blue-400">{totalChecked}</p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || totalChecked === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  {submitting ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <SendIcon className="w-4 h-4" />
                      {clientEmail ? "Create & Send Request" : "Create Request Link"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Tab 2: Form Reference
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function FormReferenceTab({ onRequestDocs }: { onRequestDocs: (scenario: DocumentRequestScenario) => void }) {
  const [scope, setScope] = useState<Scope>("federal");
  const [category, setCategory] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [search, setSearch] = useState("");

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

  const relevantCategories = useMemo(() => {
    if (scope === "state") return ["State Forms"];
    return formCategories.filter((c) => c !== "State Forms");
  }, [scope]);

  return (
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
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {/* Scope toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
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
            className="px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-transparent text-sm outline-none"
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
            className="px-3 py-2.5 rounded-lg border border-[var(--glass-border)] bg-transparent text-sm outline-none"
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
          const instrLink = getInstructionsUrl(form);
          const scenario = getScenarioForForm(form.number);

          return (
            <div
              key={form.id}
              className="glass-card rounded-lg p-4 hover:border-blue-500/30 transition-colors group"
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
              </div>
              <p className="text-xs font-medium mb-1 line-clamp-1" style={{ color: "var(--text-main)" }}>
                {form.name}
              </p>
              <p className="text-[10px] line-clamp-2 mb-3" style={{ color: "var(--text-muted)" }}>
                {form.description}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {pdfLink && (
                  <a
                    href={pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    PDF
                  </a>
                )}
                {instrLink && (
                  <a
                    href={instrLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <ExternalLinkIcon className="w-3 h-3" />
                    Instructions
                  </a>
                )}
                {scenario && (
                  <button
                    onClick={() => onRequestDocs(scenario)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-colors"
                  >
                    <ChecklistIcon className="w-3 h-3" />
                    Request Docs
                  </button>
                )}
              </div>
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
  );
}
