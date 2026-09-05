"use client";

import { useState, useEffect, useCallback } from "react";
import { KanbanIcon } from "@/components/ui/icons";
import { PIPELINE, DRS_PRICING } from "@/lib/drs-pricing";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  source: "manual" | "booked_call";
  stage: "open" | "won" | "lost";
  valueCents: number;
  ghlContactId: string | null;
  bookedAt: string | null;
  createdAt: string;
}

interface ContactResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

function contactName(c: ContactResult): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unnamed contact";
}

interface Kpis {
  openCount: number;
  openValueCents: number;
  wonCount: number;
  wonValueCents: number;
  lostCount: number;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STAGES: { key: Lead["stage"]; label: string; accent: string }[] = [
  { key: "open", label: "Open", accent: "icon-chip-blue" },
  { key: "won", label: "Won", accent: "icon-chip-emerald" },
  { key: "lost", label: "Lost", accent: "icon-chip-neutral" },
];

export function PipelineClient() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [kpis, setKpis] = useState<Kpis>({
    openCount: 0,
    openValueCents: 0,
    wonCount: 0,
    wonValueCents: 0,
    lostCount: 0,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState<string | null>(null);

  // Contact picker
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [pickedContact, setPickedContact] = useState<ContactResult | null>(null);

  // Add form
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    value: String(Math.round(PIPELINE.DEFAULT_DEAL_VALUE_CENTS / 100)),
    notes: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/dashboard/pipeline")
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.leads || []);
        if (data.kpis) setKpis(data.kpis);
        setGhlLocationId(data.ghlLocationId ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Contact picker: search existing GHL contacts (debounced) while the
  // add-lead modal is open.
  useEffect(() => {
    if (!showAdd) return;
    setSearchingContacts(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: "8" });
      if (contactSearch.trim()) params.set("search", contactSearch.trim());
      fetch(`/api/dashboard/ghl/contacts?${params}`)
        .then((r) => r.json())
        .then((data) => setContactResults(data.contacts || []))
        .catch(() => setContactResults([]))
        .finally(() => setSearchingContacts(false));
    }, 300);
    return () => clearTimeout(t);
  }, [showAdd, contactSearch]);

  function pickContact(c: ContactResult) {
    setPickedContact(c);
    setForm((f) => ({
      ...f,
      name: contactName(c),
      email: c.email || "",
      phone: c.phone || "",
    }));
  }

  function closeAddModal() {
    setShowAdd(false);
    setPickedContact(null);
    setContactSearch("");
    setAddError(null);
  }

  async function addLead() {
    if (!form.name.trim()) {
      setAddError("Please give the lead a name.");
      return;
    }
    const dollars = Number(form.value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(dollars) || dollars < 0) {
      setAddError("Deal value must be a number.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/dashboard/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          notes: form.notes,
          valueCents: Math.round(dollars * 100),
          ghlContactId: pickedContact?.id || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error || "Couldn't add the lead. Please try again.");
        return;
      }
      closeAddModal();
      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        value: String(Math.round(PIPELINE.DEFAULT_DEAL_VALUE_CENTS / 100)),
        notes: "",
      });
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function patchLead(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/dashboard/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLead(id: string, name: string) {
    if (!confirm(`Remove ${name} from the pipeline?`)) return;
    setBusyId(id);
    try {
      await fetch(`/api/dashboard/pipeline/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function startValueEdit(lead: Lead) {
    setEditingValueId(lead.id);
    setValueDraft(String(Math.round(lead.valueCents / 100)));
  }

  async function commitValueEdit(lead: Lead) {
    const dollars = Number(valueDraft.replace(/[^0-9.]/g, ""));
    setEditingValueId(null);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    const cents = Math.round(dollars * 100);
    if (cents === lead.valueCents) return;
    await patchLead(lead.id, { valueCents: cents });
  }

  const statCards = [
    { label: "Open Pipeline", value: money(kpis.openValueCents) },
    { label: "Open Leads", value: String(kpis.openCount) },
    { label: "Won", value: money(kpis.wonValueCents) },
    { label: "Deals Won", value: String(kpis.wonCount) },
  ];

  const inputCls =
    "w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] outline-none focus:border-blue-500 transition-colors";
  const inputStyle = { background: "var(--input-bg)", color: "var(--text-main)" };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
            Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Every open lead defaults to {PIPELINE.EXPECTED_LIFETIME_MONTHS} months ×{" "}
            {money(DRS_PRICING.MONTHLY_CENTS)} ≈ {money(PIPELINE.DEFAULT_DEAL_VALUE_CENTS)} expected
            value — click a value to edit. Booked calls from your GHL calendar land here
            automatically.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2.5 text-sm">
          + Add Lead
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              {s.label}
            </p>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {loading ? "..." : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Board */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : leads.length === 0 ? (
        <div className="glass-card py-16 text-center">
          <div className="mx-auto mb-3 w-10 h-10" style={{ color: "var(--text-muted)" }}>
            <KanbanIcon className="w-10 h-10" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No leads in the pipeline yet
          </p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            Add a lead above, or book a call in GoHighLevel — booked calls show up here on their
            own.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.key);
            return (
              <div key={stage.key} className="glass-card overflow-hidden">
                <div className="p-3 border-b border-[var(--card-border)] flex items-center gap-2">
                  <span className={`icon-chip w-6 h-6 text-xs ${stage.accent}`}>
                    {stage.key === "open" ? "📋" : stage.key === "won" ? "🏆" : "🚫"}
                  </span>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    {stage.label}
                  </p>
                  <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                    {stageLeads.length}
                  </span>
                </div>
                <div className="divide-y divide-[var(--card-border)]">
                  {stageLeads.length === 0 && (
                    <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      Nothing here yet.
                    </p>
                  )}
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--text-main)" }}
                          >
                            {lead.name}
                          </p>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {[lead.company, lead.email, lead.phone].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {lead.ghlContactId && ghlLocationId && (
                            <a
                              href={`https://app.gohighlevel.com/v2/location/${ghlLocationId}/contacts/detail/${lead.ghlContactId}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] font-semibold text-cyan-400 hover:underline"
                            >
                              View profile ↗
                            </a>
                          )}
                        </div>
                        <span
                          className={`badge shrink-0 ${lead.source === "booked_call" ? "badge-violet" : "badge-gray"}`}
                        >
                          {lead.source === "booked_call"
                            ? `📞 Booked${lead.bookedAt ? ` ${formatDate(lead.bookedAt)}` : ""}`
                            : "Manual"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {editingValueId === lead.id ? (
                          <input
                            autoFocus
                            value={valueDraft}
                            onChange={(e) => setValueDraft(e.target.value)}
                            onBlur={() => commitValueEdit(lead)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitValueEdit(lead);
                              if (e.key === "Escape") setEditingValueId(null);
                            }}
                            className="w-28 px-2 py-1 rounded-md text-sm border border-cyan-400/40"
                            style={inputStyle}
                          />
                        ) : (
                          <button
                            onClick={() => startValueEdit(lead)}
                            className="text-sm font-bold text-cyan-400 hover:underline"
                            title="Click to edit the deal value"
                          >
                            {money(lead.valueCents)}
                          </button>
                        )}

                        <div className="flex items-center gap-1.5">
                          {lead.stage === "open" ? (
                            <>
                              <button
                                onClick={() => patchLead(lead.id, { stage: "won" })}
                                disabled={busyId === lead.id}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                              >
                                Won ✓
                              </button>
                              <button
                                onClick={() => patchLead(lead.id, { stage: "lost" })}
                                disabled={busyId === lead.id}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold border border-rose-400/30 text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-50"
                              >
                                Lost ✕
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => patchLead(lead.id, { stage: "open" })}
                              disabled={busyId === lead.id}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={() => deleteLead(lead.id, lead.name)}
                            disabled={busyId === lead.id}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors disabled:opacity-50"
                            style={{ color: "var(--text-muted)" }}
                            title="Remove lead"
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      {lead.notes && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {lead.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Lead modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeAddModal} />
          <div
            className="fixed inset-x-4 top-[6%] bottom-[6%] max-w-md mx-auto z-50 rounded-xl border overflow-y-auto"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                Add a lead to the pipeline
              </p>
              <button onClick={closeAddModal} className="text-sm" style={{ color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Pick from existing contacts */}
              <div className="space-y-2">
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pick from your contacts
                </label>
                {pickedContact ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border border-cyan-400/30 bg-cyan-400/[0.06]">
                    <p className="text-sm font-semibold text-cyan-400 truncate">
                      ✓ {contactName(pickedContact)}
                      <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                        {pickedContact.email ? ` · ${pickedContact.email}` : ""}
                      </span>
                    </p>
                    <button
                      onClick={() => setPickedContact(null)}
                      className="text-xs shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      placeholder="Search your GHL contacts…"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <div className="rounded-lg border border-[var(--card-border)] divide-y divide-[var(--card-border)] max-h-44 overflow-y-auto">
                      {searchingContacts ? (
                        <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          Searching…
                        </p>
                      ) : contactResults.length === 0 ? (
                        <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          No contacts found — connect GHL in Settings, or add the lead manually below.
                        </p>
                      ) : (
                        contactResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => pickContact(c)}
                            className="w-full text-left px-3 py-2 hover:bg-[var(--input-bg)] transition-colors"
                          >
                            <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                              {contactName(c)}
                            </p>
                            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                              {[c.email, c.phone].filter(Boolean).join(" · ") || "no contact info"}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Picked leads keep a link to their contact profile — or fill in the details
                  manually below.
                </p>
              </div>

              <div className="section-divider" />
              <input
                placeholder="Lead name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
                style={inputStyle}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                />
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <input
                placeholder="Firm / company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className={inputCls}
                style={inputStyle}
              />
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Expected deal value (USD)
                </label>
                <input
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Default = {PIPELINE.EXPECTED_LIFETIME_MONTHS} months at{" "}
                  {money(DRS_PRICING.MONTHLY_CENTS)}/mo.
                </p>
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={`${inputCls} resize-none`}
                style={inputStyle}
              />
              {addError && <p className="text-xs font-semibold text-rose-400">{addError}</p>}
              <button
                onClick={addLead}
                disabled={adding}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
              >
                {adding ? "Adding…" : "Add to pipeline 🚀"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
