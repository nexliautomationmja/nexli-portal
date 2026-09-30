"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import {
  FIRM_SITE_COLOR_KEYS,
  FIRM_SITE_STYLES,
  validateFirmSiteConfig,
  type FirmSiteConfig,
} from "@/lib/firm-sites/types";
import { normalizeHex } from "@/lib/firm-sites/palette";

// ── Types ────────────────────────────────────────────────

interface SiteSummary {
  status: string;
  slug: string;
  domain: string | null;
  generatedBy: string;
  generationNotes: string | null;
  updatedAt: string;
  publishedAt: string | null;
  previewUrl: string;
  liveUrl: string;
}

interface SiteResponse {
  site: SiteSummary | null;
  config: FirmSiteConfig | null;
  intake?: Record<string, unknown> | null;
  hasAnthropicKey?: boolean;
  user?: { id: string; email: string; firmName: string | null };
}

type Busy = "load" | "save" | "generate" | "publish" | "unpublish" | null;

export const SERVICE_ICONS = [
  "user",
  "building",
  "book",
  "target",
  "banknote",
  "trending-up",
  "shield",
  "file-text",
  "calculator",
  "briefcase",
  "users",
  "star",
] as const;

const COLOR_LABELS: Record<(typeof FIRM_SITE_COLOR_KEYS)[number], string> = {
  primary: "Primary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  textMuted: "Muted text",
  border: "Border",
};

// ── Small UI helpers ─────────────────────────────────────

const labelClass = "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5";
const labelStyle = { color: "var(--text-muted)", opacity: 0.6 } as const;
const BTN =
  "px-3.5 py-2 rounded-full text-xs font-bold border border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors disabled:opacity-50";
const BTN_PRIMARY =
  "px-4 py-2 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard>
      <div className="mb-4">
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {title}
        </p>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </GlassCard>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass} style={labelStyle}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input"
      />
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className={labelClass} style={labelStyle}>
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`glass-input ${mono ? "font-mono text-xs" : ""}`}
      />
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function statusBadge(status: string | undefined): { label: string; cls: string } {
  if (status === "published") return { label: "Published", cls: "badge-emerald" };
  if (status === "draft") return { label: "Draft", cls: "badge-amber" };
  return { label: "None", cls: "badge-gray" };
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Editor ───────────────────────────────────────────────

export function SiteEditorClient({ userId }: { userId: string }) {
  const [data, setData] = useState<SiteResponse | null>(null);
  const [draft, setDraft] = useState<FirmSiteConfig | null>(null);
  const [domain, setDomain] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [rawErrors, setRawErrors] = useState<string[]>([]);
  const [rawOpen, setRawOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>("load");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string; errors?: string[] } | null>(null);
  const [dirty, setDirty] = useState(false);

  const site = data?.site ?? null;

  const applyResponse = useCallback((res: SiteResponse) => {
    setData(res);
    setDraft(res.config ? structuredClone(res.config) : null);
    setDomain(res.site?.domain ?? "");
    setRawJson(res.config ? JSON.stringify(res.config, null, 2) : "");
    setRawErrors([]);
    setDirty(false);
  }, []);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const res = await fetch(`/api/dashboard/admin/sites/${userId}`);
      const json = (await res.json().catch(() => ({}))) as SiteResponse & { error?: string };
      if (!res.ok) {
        setMessage({ tone: "err", text: json.error || "Could not load website" });
        setData({ site: null, config: null });
        return;
      }
      applyResponse(json);
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }, [userId, applyResponse]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the raw JSON view in sync with the form unless the user is editing it.
  useEffect(() => {
    if (draft && !rawOpen) setRawJson(JSON.stringify(draft, null, 2));
  }, [draft, rawOpen]);

  function update(mutate: (c: FirmSiteConfig) => void) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });
    setDirty(true);
  }

  const liveValidation = useMemo(() => (draft ? validateFirmSiteConfig(draft) : null), [draft]);

  // ── Actions ────────────────────────────────────────────

  async function post(action: "generate" | "publish" | "unpublish") {
    if (action === "generate" && site) {
      const ok = window.confirm(
        "Regenerate the website? This rewrites the copy and services from the intake and overwrites unsaved and saved edits. Slug, domain and publish status are kept."
      );
      if (!ok) return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/admin/sites/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as SiteResponse & { error?: string };
      if (!res.ok) {
        setMessage({ tone: "err", text: json.error || "Request failed" });
        return;
      }
      applyResponse({ ...data, ...json });
      setMessage({
        tone: "ok",
        text:
          action === "generate"
            ? `Website ${site ? "regenerated" : "generated"} (${json.site?.generatedBy || "template"}).`
            : action === "publish"
              ? "Website published."
              : "Website unpublished.",
      });
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/admin/sites/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: draft, domain: domain.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as SiteResponse & {
        error?: string;
        errors?: string[];
      };
      if (!res.ok) {
        setMessage({
          tone: "err",
          text: json.error || "Save failed",
          errors: Array.isArray(json.errors) ? json.errors : undefined,
        });
        return;
      }
      applyResponse({ ...data, ...json });
      setMessage({ tone: "ok", text: "Saved." });
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  function openPreview() {
    if (!site?.previewUrl) return;
    if (dirty && !window.confirm("You have unsaved changes; the preview shows the last saved version. Open anyway?")) {
      return;
    }
    window.open(site.previewUrl, "_blank", "noopener");
  }

  function applyRawJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      setRawErrors([`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`]);
      return;
    }
    const validated = validateFirmSiteConfig(parsed);
    if (!validated.ok) {
      setRawErrors(validated.errors);
      return;
    }
    setRawErrors([]);
    setDraft({ ...validated.config, slug: draft?.slug ?? validated.config.slug });
    setDirty(true);
    setRawOpen(false);
  }

  // ── Render ─────────────────────────────────────────────

  const header = (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href={`/dashboard/admin?client=${userId}`}
          className="text-xs font-bold hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to client
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: "var(--text-main)" }}>
          {draft?.firmName || data?.user?.firmName || "Website"}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {data?.user?.email ? `${data.user.email} · ` : ""}
          {site ? (
            <>
              <span className="font-mono">/sites/{site.slug}</span>
              {site.domain ? (
                <>
                  {" · "}
                  <span className="font-mono">{site.domain}</span>
                </>
              ) : null}
            </>
          ) : (
            "Firm Foundation website"
          )}
        </p>
      </div>
      {site && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${statusBadge(site.status).cls}`}>{statusBadge(site.status).label}</span>
          <button type="button" onClick={openPreview} disabled={busy !== null} className={BTN} style={{ color: "var(--text-main)" }}>
            Preview
          </button>
          {site.status === "published" ? (
            <button type="button" onClick={() => post("unpublish")} disabled={busy !== null} className={BTN} style={{ color: "var(--text-main)" }}>
              {busy === "unpublish" ? "Working…" : "Unpublish"}
            </button>
          ) : (
            <button type="button" onClick={() => post("publish")} disabled={busy !== null} className={BTN} style={{ color: "var(--text-main)" }}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          )}
          <button
            type="button"
            onClick={() => post("generate")}
            disabled={busy !== null}
            className={BTN}
            style={{ color: "var(--text-main)" }}
            title="Rebuild copy and services from the intake (overwrites edits)"
          >
            {busy === "generate" ? "Generating…" : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy !== null || !dirty || (liveValidation ? !liveValidation.ok : true)}
            className={BTN_PRIMARY}
            title={liveValidation && !liveValidation.ok ? liveValidation.errors.join("\n") : undefined}
          >
            {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      )}
    </div>
  );

  if (busy === "load" && !data) {
    return (
      <div className="max-w-[1100px] mx-auto">
        {header}
        <GlassCard>
          <div className="py-12 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!site || !draft) {
    return (
      <div className="max-w-[1100px] mx-auto">
        {header}
        {message && <Message message={message} />}
        <GlassCard>
          <div className="py-16 text-center">
            <p className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
              No website yet
            </p>
            <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
              Generate a draft from the client&apos;s onboarding intake
              {data?.intake ? "" : " (no intake found; the account details will be used)"}.
              {data?.hasAnthropicKey === false && " ANTHROPIC_API_KEY is not set, so template copy will be used."}
            </p>
            <button
              type="button"
              onClick={() => post("generate")}
              disabled={busy !== null}
              className={`${BTN_PRIMARY} mt-6`}
            >
              {busy === "generate" ? "Generating…" : "Generate website"}
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  const highlightsText = (draft.about.highlights ?? []).join("\n");

  return (
    <div className="max-w-[1100px] mx-auto">
      {header}

      {message && <Message message={message} />}

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>
          Generated by <span className={`badge ${site.generatedBy === "claude" ? "badge-violet" : site.generatedBy === "manual" ? "badge-blue" : "badge-gray"}`}>{site.generatedBy}</span>
        </span>
        <span>Updated {fmtDateTime(site.updatedAt)}</span>
        {site.publishedAt && <span>Published {fmtDateTime(site.publishedAt)}</span>}
        {data?.hasAnthropicKey === false && <span className="badge badge-amber">No ANTHROPIC_API_KEY</span>}
      </div>
      {site.generationNotes && (
        <p className="mb-6 -mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {site.generationNotes}
        </p>
      )}

      <div className="space-y-6">
        {/* Basics */}
        <Section title="Basics">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Firm name" value={draft.firmName} onChange={(v) => update((c) => (c.firmName = v))} />
            <Field label="Tagline" value={draft.tagline} onChange={(v) => update((c) => (c.tagline = v))} />
            <div className="sm:col-span-2">
              <Field label="Hero headline" value={draft.heroHeadline} onChange={(v) => update((c) => (c.heroHeadline = v))} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Hero subheadline" value={draft.heroSub} rows={3} onChange={(v) => update((c) => (c.heroSub = v))} />
            </div>
          </div>
        </Section>

        {/* Colors + style */}
        <Section title="Colors & style" hint="Hex colours. The swatch shows the current value.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIRM_SITE_COLOR_KEYS.map((key) => {
              const value = draft.colors[key] ?? "";
              const normalized = normalizeHex(value);
              return (
                <div key={key}>
                  <label className={labelClass} style={labelStyle}>
                    {COLOR_LABELS[key]}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={normalized ?? "#000000"}
                      onChange={(e) => update((c) => (c.colors[key] = e.target.value))}
                      className="h-10 w-12 rounded-md border border-[var(--glass-border)] bg-transparent p-0.5 cursor-pointer"
                      aria-label={`${COLOR_LABELS[key]} colour picker`}
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => update((c) => (c.colors[key] = e.target.value))}
                      className={`glass-input font-mono ${normalized ? "" : "border-red-400"}`}
                      placeholder="#1e3a8a"
                    />
                    <span
                      className="h-10 w-10 shrink-0 rounded-md border border-[var(--glass-border)]"
                      style={{ background: normalized ?? "transparent" }}
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
            <div>
              <label className={labelClass} style={labelStyle}>
                Style
              </label>
              <select
                value={draft.style}
                onChange={(e) => update((c) => (c.style = e.target.value as FirmSiteConfig["style"]))}
                className="glass-input"
              >
                {FIRM_SITE_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Mini preview strip */}
          <div
            className="mt-4 rounded-lg p-4 border"
            style={{ background: draft.colors.background, borderColor: draft.colors.border }}
          >
            <div className="rounded-md p-3" style={{ background: draft.colors.surface, border: `1px solid ${draft.colors.border}` }}>
              <p style={{ color: draft.colors.primary, fontFamily: draft.fonts.heading, fontWeight: 700 }}>{draft.heroHeadline}</p>
              <p className="text-sm mt-1" style={{ color: draft.colors.text, fontFamily: draft.fonts.body }}>
                {draft.tagline}
              </p>
              <p className="text-xs mt-1" style={{ color: draft.colors.textMuted }}>
                Muted text sample
              </p>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold" style={{ background: draft.colors.accent, color: "#fff" }}>
                Book a call
              </span>
            </div>
          </div>
        </Section>

        {/* Services */}
        <Section title="Services" hint="1 to 12 services, shown in this order.">
          <div className="space-y-4">
            {draft.services.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3"
                style={{ borderColor: "var(--glass-border)" }}
              >
                <Field label={`Service ${i + 1} title`} value={s.title} onChange={(v) => update((c) => (c.services[i].title = v))} />
                <div>
                  <label className={labelClass} style={labelStyle}>
                    Icon
                  </label>
                  <select
                    value={s.icon ?? ""}
                    onChange={(e) =>
                      update((c) => {
                        if (e.target.value) c.services[i].icon = e.target.value;
                        else delete c.services[i].icon;
                      })
                    }
                    className="glass-input"
                  >
                    <option value="">(none)</option>
                    {SERVICE_ICONS.map((ic) => (
                      <option key={ic} value={ic}>
                        {ic}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Description" value={s.description} rows={2} onChange={(v) => update((c) => (c.services[i].description = v))} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() =>
                      update((c) => {
                        [c.services[i - 1], c.services[i]] = [c.services[i], c.services[i - 1]];
                      })
                    }
                    className={BTN}
                    style={{ color: "var(--text-main)" }}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={draft.services.length <= 1}
                    onClick={() => update((c) => c.services.splice(i, 1))}
                    className={`${BTN} text-red-400`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={draft.services.length >= 12}
              onClick={() =>
                update((c) => c.services.push({ title: "New service", description: "Describe this service.", icon: "star" }))
              }
              className={BTN}
              style={{ color: "var(--text-main)" }}
            >
              + Add service
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="space-y-4">
            <Field label="Heading" value={draft.about.heading} onChange={(v) => update((c) => (c.about.heading = v))} />
            <TextArea label="Body" value={draft.about.body} rows={5} onChange={(v) => update((c) => (c.about.body = v))} />
            <TextArea
              label="Highlights"
              value={highlightsText}
              rows={4}
              hint="One per line, up to 8."
              onChange={(v) =>
                update((c) => {
                  const list = v.split("\n").map((h) => h.trim()).filter(Boolean).slice(0, 8);
                  if (list.length) c.about.highlights = list;
                  else delete c.about.highlights;
                })
              }
            />
          </div>
        </Section>

        {/* Contact + booking */}
        <Section title="Contact & booking">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone" value={draft.contact.phone ?? ""} onChange={(v) => update((c) => setOpt(c.contact, "phone", v))} />
            <Field label="Email" type="email" value={draft.contact.email ?? ""} onChange={(v) => update((c) => setOpt(c.contact, "email", v))} />
            <Field label="Address" value={draft.contact.address ?? ""} onChange={(v) => update((c) => setOpt(c.contact, "address", v))} />
            <Field label="Hours" value={draft.contact.hours ?? ""} onChange={(v) => update((c) => setOpt(c.contact, "hours", v))} placeholder="Mon–Fri 9am–5pm" />
            <div className="sm:col-span-2">
              <Field
                label="Booking URL"
                value={draft.bookingUrl}
                onChange={(v) => update((c) => (c.bookingUrl = v))}
                hint='Calendly / GHL link, or "#contact" to scroll to the contact section.'
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Portal URL" value={draft.portalUrl} onChange={(v) => update((c) => (c.portalUrl = v))} />
            </div>
          </div>
        </Section>

        {/* Domain */}
        <Section title="Custom domain" hint="Leave blank to serve only at /sites/<slug>.">
          <Field
            label="Domain"
            value={domain}
            placeholder="firm.com"
            onChange={(v) => {
              setDomain(v);
              setDirty(true);
            }}
            hint="Bare hostname, no protocol or www."
          />
          <div className="mt-4 rounded-lg border p-4 text-xs space-y-2" style={{ borderColor: "var(--glass-border)", color: "var(--text-muted)" }}>
            <p className="font-bold" style={{ color: "var(--text-main)" }}>
              DNS setup for the client
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Apex (<code className="font-mono">firm.com</code>): <code className="font-mono">A</code> record → <code className="font-mono">76.76.21.21</code>
              </li>
              <li>
                <code className="font-mono">www</code>: <code className="font-mono">CNAME</code> → <code className="font-mono">cname.vercel-dns.com</code>
              </li>
              <li>Then attach the domain to the marketing project in Vercel: Project Settings → Domains.</li>
            </ul>
            <p>
              Local test:{" "}
              <code className="font-mono select-all">curl -H &quot;Host: {domain.trim() || "<domain>"}&quot; http://localhost:3000/</code>
            </p>
            {site.liveUrl && (
              <p>
                Live URL after publishing: <span className="font-mono">{site.liveUrl}</span>
              </p>
            )}
          </div>
        </Section>

        {/* SEO */}
        <Section title="SEO">
          <div className="space-y-4">
            <Field label="Title" value={draft.seo.title} onChange={(v) => update((c) => (c.seo.title = v))} hint={`${draft.seo.title.length}/70 recommended`} />
            <TextArea label="Description" value={draft.seo.description} rows={3} onChange={(v) => update((c) => (c.seo.description = v))} hint={`${draft.seo.description.length}/160 recommended`} />
          </div>
        </Section>

        {/* Raw JSON */}
        <Section title="Advanced: raw JSON" hint="Edit the whole config. Validated before it is applied to the form; Save still has to be pressed.">
          {!rawOpen ? (
            <button type="button" onClick={() => setRawOpen(true)} className={BTN} style={{ color: "var(--text-main)" }}>
              Edit JSON
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rawJson}
                rows={24}
                onChange={(e) => setRawJson(e.target.value)}
                className="glass-input font-mono text-xs"
                spellCheck={false}
              />
              {rawErrors.length > 0 && (
                <ul className="space-y-1">
                  {rawErrors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={applyRawJson} className={BTN_PRIMARY}>
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawOpen(false);
                    setRawErrors([]);
                    setRawJson(JSON.stringify(draft, null, 2));
                  }}
                  className={BTN}
                  style={{ color: "var(--text-main)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {liveValidation && !liveValidation.ok && (
          <GlassCard variant="compact">
            <p className="text-xs font-bold text-red-400 mb-1">Fix before saving</p>
            <ul className="space-y-0.5">
              {liveValidation.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-400">
                  {e}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        <div className="flex justify-end gap-2 pb-8">
          <button type="button" onClick={openPreview} disabled={busy !== null} className={BTN} style={{ color: "var(--text-main)" }}>
            Preview
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy !== null || !dirty || (liveValidation ? !liveValidation.ok : true)}
            className={BTN_PRIMARY}
          >
            {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}

function setOpt<K extends "phone" | "email" | "address" | "hours">(
  contact: FirmSiteConfig["contact"],
  key: K,
  value: string
) {
  const t = value.trim();
  if (t) contact[key] = value;
  else delete contact[key];
}

function Message({ message }: { message: { tone: "ok" | "err"; text: string; errors?: string[] } }) {
  return (
    <div className="mb-4">
      <p className={`text-xs font-medium ${message.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      {message.errors && message.errors.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {message.errors.map((e, i) => (
            <li key={i} className="text-xs text-red-400">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
