"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientPicker } from "@/components/dashboard/client-picker";
import { DocumentPreview } from "@/components/engagement-document";
import { CTA_CLASSES, ConfettiBurst, SECONDARY_BTN, SHIMMER_CONIC, SYNE, ShimmerPill } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { ErrorStrip, LaunchPadCanvas, SP, SvgIcon } from "@/components/creative-studio/canvas";
import { generateDrsContent, fillClientPlaceholder } from "@/lib/engagement-defaults";
import { generateEnterpriseContent } from "@/lib/enterprise-engagement";
import { ANNUAL_UPFRONT_CENTS, DRS_PRICING, TERM_MONTHS, TOTAL_MONTHLY_CENTS, type BillingPlan } from "@/lib/drs-pricing";
import { ENTERPRISE_TIER_ORDER, ENTERPRISE_TIERS, isEnterpriseTemplateName, renewalCents, type EnterpriseTier } from "@/lib/enterprise-pricing";
import { autoSubject, leadMatches, letterStatus, type ComposerLead, type ComposerLetter } from "@/components/engagements/composer-logic";

const fmtWhole = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Template {
  id: string;
  name: string;
  content: string;
}

type Offer = "drs_monthly" | "drs_annual" | "enterprise" | `tpl:${string}`;
type Signer = { name: string; email: string };

const isDrs = (t: Template) => t.name.toLowerCase().includes("digital rainmaker");

const STEPS = ["Who", "Agreement", "Review & send"] as const;

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-cyan-400/60 focus:bg-white/[0.06]";

/**
 * Send an engagement letter in three steps — who's signing (picked straight
 * from the pipeline, a GoHighLevel contact, or someone new), which agreement,
 * then review the letter and send — on the Launch Pad dark canvas.
 */
export function EngagementComposer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<ComposerLead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [letters, setLetters] = useState<ComposerLetter[]>([]);
  const [from, setFrom] = useState({ name: "", company: "" });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tab, setTab] = useState<"pipeline" | "contacts" | "new">("pipeline");
  const [query, setQuery] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [signers, setSigners] = useState<Signer[]>([{ name: "", email: "" }]);
  const [company, setCompany] = useState("");

  const [offer, setOffer] = useState<Offer | null>(null);
  const [tier, setTier] = useState<EnterpriseTier>("core");
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [subjectText, setSubjectText] = useState("");
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);

  const [editText, setEditText] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; signers: { name: string; email: string; engageUrl: string }[]; emailErrors: string[] | null } | null>(null);
  const [burst, setBurst] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const signerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const json = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    Promise.all([json("/api/dashboard/pipeline"), json("/api/dashboard/engagements/templates"), json("/api/dashboard/engagements")]).then(([p, t, e]) => {
      if (cancelled) return;
      const open = ((p?.leads ?? []) as ComposerLead[]).filter((l) => l.stage === "open");
      setLeads(open);
      setTemplates((t?.templates ?? []) as Template[]);
      setLetters((e?.engagements ?? []) as ComposerLetter[]);
      if (e?.from) setFrom(e.from);
      if (open.length === 0) setTab("contacts");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Desktop: start typing in the lead search right away. Phones: don't pop the keyboard.
  useEffect(() => {
    if (!loading && !window.matchMedia("(hover: none), (pointer: coarse)").matches) searchRef.current?.focus();
  }, [loading]);

  // ── Templates → agreement cards ──
  const drsMonthly = templates.find((t) => isDrs(t) && !t.name.toLowerCase().includes("annual"));
  const drsAnnual = templates.find((t) => isDrs(t) && t.name.toLowerCase().includes("annual")) ?? drsMonthly;
  const enterprise = templates.find((t) => isEnterpriseTemplateName(t.name));
  const saved = templates.filter((t) => !isDrs(t) && !isEnterpriseTemplateName(t.name));

  const templateId =
    offer === "drs_monthly" ? drsMonthly?.id : offer === "drs_annual" ? drsAnnual?.id : offer === "enterprise" ? enterprise?.id : offer?.startsWith("tpl:") ? offer.slice(4) : undefined;
  const billingPlan: BillingPlan = offer === "drs_annual" ? "annual" : "monthly";

  const firm = company.trim() || signers[0]?.name.trim() || "";
  const subject = subjectTouched ? subjectText : autoSubject(offer, tier, firm, saved.find((t) => `tpl:${t.id}` === offer)?.name);

  const offerSummary = useMemo(() => {
    if (offer === "drs_monthly") return { title: "Digital Rainmaker · Monthly", price: `${fmtWhole(DRS_PRICING.SETUP_FEE_CENTS)} setup + ${fmtWhole(TOTAL_MONTHLY_CENTS)}/mo` };
    if (offer === "drs_annual") return { title: "Digital Rainmaker · Annual", price: `${fmtWhole(ANNUAL_UPFRONT_CENTS)} at signing + ${fmtWhole(DRS_PRICING.AD_SPEND_MONTHLY_CENTS)}/mo ad budget` };
    if (offer === "enterprise") return { title: `Nexli Enterprise · ${ENTERPRISE_TIERS[tier].label}`, price: fmtWhole(ENTERPRISE_TIERS[tier].priceCents) };
    const t = saved.find((x) => `tpl:${x.id}` === offer);
    return t ? { title: t.name, price: "Your template" } : null;
  }, [offer, tier, saved]);

  function chooseOffer(next: Offer, nextTier: EnterpriseTier = tier) {
    if (contentTouched && (next !== offer || nextTier !== tier) && !confirm("Switching replaces the letter text you edited. Continue?")) return;
    setOffer(next);
    setTier(nextTier);
    setContentTouched(false);
    if (next === "drs_monthly") setContent(generateDrsContent("monthly"));
    else if (next === "drs_annual") setContent(generateDrsContent("annual"));
    else if (next === "enterprise") setContent(generateEnterpriseContent(nextTier));
    else setContent(saved.find((t) => `tpl:${t.id}` === next)?.content ?? "");
  }

  // ── Who ──
  const visibleLeads = useMemo(() => leads.filter((l) => leadMatches(l, query)), [leads, query]);
  function pickLead(l: ComposerLead) {
    setLeadId(l.id);
    setSigners((cur) => [{ name: l.name, email: l.email ?? "" }, ...cur.slice(1)]);
    setCompany(l.company ?? "");
    // On a phone the signer panel is below the list: bring it into view.
    if (window.matchMedia("(max-width: 639px)").matches) {
      setTimeout(() => signerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  }
  const setSigner = (i: number, patch: Partial<Signer>) => setSigners((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const whoValid = signers.length > 0 && signers.every((s) => s.name.trim() && EMAIL.test(s.email.trim()));
  const whatValid = Boolean(offer && templateId !== undefined && content.trim());
  const canSend = whoValid && whatValid && subject.trim() && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: signers.map((s) => ({ name: s.name.trim(), email: s.email.trim() })),
          clientCompany: company.trim().slice(0, 200) || undefined,
          subject: subject.trim(),
          content,
          templateId: templateId || undefined,
          expiresInDays,
          saveAsTemplate,
          templateName: saveAsTemplate ? templateName.trim() : undefined,
          billingPlan,
          enterpriseTier: offer === "enterprise" ? tier : undefined,
          pipelineLeadId: leadId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.engagement) throw new Error(data?.error || `Couldn't send the letter (${res.status})`);
      setSent({ id: data.engagement.id, signers: data.signers ?? [], emailErrors: data.emailErrors ?? null });
      setBurst((b) => b + 1);
    } catch (err) {
      // The draft stays exactly as it was.
      setError(err instanceof Error ? err.message : "Couldn't send the letter");
    } finally {
      setSending(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1800);
    } catch {
      /* clipboard blocked: the link is shown in full */
    }
  }

  function startOver() {
    setSent(null);
    setStep(1);
    setLeadId(null);
    setSigners([{ name: "", email: "" }]);
    setCompany("");
    setOffer(null);
    setContent("");
    setContentTouched(false);
    setSubjectText("");
    setSubjectTouched(false);
    setExpiresInDays(30);
    setEditText(false);
    setSaveAsTemplate(false);
    setTemplateName("");
    setError(null);
  }

  const heading = sent ? (
    <>
      Sent. <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Nice work.</span>
    </>
  ) : step === 1 ? (
    <>
      Who&apos;s signing <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">today?</span>
    </>
  ) : step === 2 ? (
    <>
      Which <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">agreement?</span>
    </>
  ) : (
    <>
      Review &amp; <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">send</span>
    </>
  );

  const stepSummary = [
    whoValid ? `${signers[0].name}${signers.length > 1 ? ` +${signers.length - 1}` : ""}${company.trim() ? ` · ${company.trim()}` : ""}` : "",
    offerSummary ? offerSummary.title : "",
    "",
  ];

  return (
    <LaunchPadCanvas>
      <ConfettiBurst burst={burst} />
      <div className="mx-auto max-w-5xl px-3 pb-10 sm:px-6 sm:pb-20">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 pt-4 sm:pt-5">
          <Link
            href="/dashboard/engagements"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs font-semibold text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            <SvgIcon d={SP.chevronLeft} size={14} /> Engagements
          </Link>
          <span className="hidden justify-self-center sm:flex">
            <ShimmerPill conic={SHIMMER_CONIC}>
              <SvgIcon d={SP.script} size={14} className="text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white md:text-xs">Engagement letter</span>
            </ShimmerPill>
          </span>
          <span className="hidden w-[108px] sm:block" aria-hidden="true" />
        </header>

        <h1 className="lp-card mt-5 text-center text-3xl font-bold tracking-tight text-white sm:mt-8 sm:text-5xl" style={SYNE}>
          {heading}
        </h1>

        {/* Steps */}
        {!sent && (
          <nav aria-label="Steps" className="lp-card mx-auto mt-5 flex max-w-3xl items-center gap-1.5 sm:mt-7 sm:gap-2" style={{ animationDelay: "0.05s" }}>
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const done = n < step;
              const current = n === step;
              const reachable = n < step || (n === 2 && whoValid) || (n === 3 && whoValid && whatValid);
              return (
                <div key={label} className={`flex min-w-0 items-center gap-2 ${current ? "flex-1" : "flex-none sm:flex-1"}`}>
                  <button
                    type="button"
                    onClick={() => reachable && setStep(n)}
                    disabled={!reachable && !current}
                    className={`flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-2xl border px-2 py-2 text-left transition sm:gap-2.5 sm:px-3 ${
                      current
                        ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                        : done
                          ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                          : "border-white/5 bg-transparent opacity-60"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        done ? "bg-emerald-500 text-white" : current ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white" : "bg-white/10 text-neutral-400"
                      }`}
                    >
                      {done ? "✓" : n}
                    </span>
                    <span className="min-w-0">
                      <span className={`${current ? "block" : "hidden sm:block"} truncate text-xs font-bold text-white`}>{label}</span>
                      <span className="hidden truncate text-[10px] text-neutral-400 sm:block">{stepSummary[i] || (current ? "Now" : " ")}</span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && <span className={`hidden h-px w-4 shrink-0 sm:block ${done ? "bg-emerald-400/60" : "bg-white/10"}`} />}
                </div>
              );
            })}
          </nav>
        )}

        <div className="mt-6 sm:mt-8">
          {loading ? (
            <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-3xl bg-white/5" />
          ) : sent ? (
            <SentCard sent={sent} firm={firm} copied={copied} onCopy={copyLink} onView={() => router.push(`/dashboard/engagements?id=${sent.id}`)} onAnother={startOver} />
          ) : step === 1 ? (
            <div className="mx-auto max-w-3xl space-y-5">
              {/* Source tabs */}
              <div className="flex justify-center">
                <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 text-xs font-bold sm:inline-flex sm:w-auto sm:rounded-full">
                  {(
                    [
                      ["pipeline", `From your pipeline${leads.length ? ` · ${leads.length}` : ""}`, `Pipeline${leads.length ? ` · ${leads.length}` : ""}`],
                      ["contacts", "Other contacts", "Contacts"],
                      ["new", "Someone new", "New"],
                    ] as const
                  ).map(([key, label, short]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setTab(key);
                        if (key !== "pipeline") setLeadId(null);
                      }}
                      className={`min-h-11 rounded-xl px-2 transition sm:min-h-0 sm:rounded-full sm:px-4 sm:py-2 ${tab === key ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30" : "text-neutral-400 hover:text-white"}`}
                    >
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {tab === "pipeline" && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">
                      <SvgIcon d={SP.search} size={16} />
                    </span>
                    <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, firm or email" className={`${inputCls} pl-10`} />
                  </div>
                  {visibleLeads.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-white">{leads.length ? "No open lead matches that." : "No open leads in your pipeline yet."}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {leads.length ? "Try a different spelling, or " : "Add them in "}
                        {leads.length ? (
                          <button type="button" onClick={() => setTab("new")} className="font-semibold text-cyan-300 hover:text-white">
                            send to someone new
                          </button>
                        ) : (
                          <Link href="/dashboard/pipeline" className="font-semibold text-cyan-300 hover:text-white">
                            Pipeline
                          </Link>
                        )}
                        .
                      </p>
                    </div>
                  ) : (
                    <div className="cs-scroll mt-4 grid gap-2.5 sm:max-h-[460px] sm:grid-cols-2 sm:overflow-y-auto sm:pr-1">
                      {visibleLeads.map((l) => {
                        const on = l.id === leadId;
                        const letter = letterStatus(l, letters);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => pickLead(l)}
                            className={`group relative flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                              on ? "border-cyan-400/70 bg-cyan-500/10 shadow-lg shadow-cyan-500/15" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white shadow shadow-blue-500/30">
                              {l.name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <span className="min-w-0 flex-1 pr-6">
                              <span className="block truncate text-sm font-bold text-white">{l.name}</span>
                              <span className="block truncate text-[11px] text-neutral-400">{[l.company, l.email].filter(Boolean).join(" · ") || "No email yet"}</span>
                              <span className="mt-1.5 flex flex-wrap gap-1">
                                {l.bookedAt && (
                                  <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                                    📞 Booked {new Date(l.bookedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                                <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200" style={NUM_FONT}>
                                  {fmtWhole(l.valueCents)}
                                </span>
                                {letter && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                      letter.tone === "green" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" : "border-amber-400/30 bg-amber-500/15 text-amber-200"
                                    }`}
                                  >
                                    {letter.label}
                                  </span>
                                )}
                              </span>
                            </span>
                            {on && (
                              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-black text-[#020617]">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "contacts" && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <ClientPicker
                    placeholder="Search your GoHighLevel contacts…"
                    onSelect={(c) => {
                      setLeadId(null);
                      setSigners((cur) => [{ name: c.name, email: c.email }, ...cur.slice(1)]);
                      if (c.company) setCompany(c.company);
                    }}
                  />
                  <p className="mt-2 text-[11px] text-neutral-400">
                    Pick a contact to fill the signer below. Not connected to GoHighLevel, or not finding them? Use{" "}
                    <button type="button" onClick={() => setTab("new")} className="font-semibold text-cyan-300 hover:text-white">
                      Someone new
                    </button>
                    .
                  </p>
                </div>
              )}

              {/* Signer panel */}
              <div ref={signerRef} className="scroll-mt-20 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{leadId ? "Signing · from your pipeline" : "Signing"}</p>
                  {leadId && <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">Linked to the lead · turns Won when the setup is paid</span>}
                </div>
                <div className="space-y-3">
                  {signers.map((s, i) => {
                    const missingEmail = !s.email.trim();
                    const badEmail = Boolean(s.email.trim()) && !EMAIL.test(s.email.trim());
                    return (
                      <div key={i} className={`grid gap-2 sm:grid-cols-[1fr_1fr_auto] ${i > 0 ? "border-t border-white/5 pt-3 sm:border-0 sm:pt-0" : ""}`}>
                        {i > 0 && (
                          <div className="flex items-center justify-between sm:hidden">
                            <span className="text-[11px] font-bold text-neutral-400">Signer {i + 1}</span>
                            <button
                              type="button"
                              onClick={() => setSigners((cur) => cur.filter((_, j) => j !== i))}
                              className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-rose-300"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <input value={s.name} onChange={(e) => setSigner(i, { name: e.target.value })} placeholder={i === 0 ? "Full name" : "Co-signer's name"} className={inputCls} />
                        <div>
                          <input
                            type="email"
                            value={s.email}
                            onChange={(e) => setSigner(i, { email: e.target.value })}
                            placeholder="Email"
                            className={`${inputCls} ${(missingEmail && i === 0 && leadId) || badEmail ? "border-amber-400/60" : ""}`}
                          />
                          {missingEmail && i === 0 && leadId && <p className="mt-1 text-[10px] text-amber-200/90">Add their email. Booked-call leads sometimes come in without one.</p>}
                          {badEmail && <p className="mt-1 text-[10px] text-amber-200/90">That doesn&apos;t look like an email yet.</p>}
                        </div>
                        {i > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSigners((cur) => cur.filter((_, j) => j !== i))}
                            className="hidden h-10 w-10 items-center justify-center self-start rounded-xl text-neutral-500 hover:bg-rose-500/10 hover:text-rose-300 sm:flex"
                            aria-label="Remove co-signer"
                          >
                            <SvgIcon d={SP.x} size={14} />
                          </button>
                        ) : (
                          <span className="hidden w-10 sm:block" />
                        )}
                      </div>
                    );
                  })}
                  <div>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} placeholder="Firm / company, e.g. Smith & Co. CPAs" className={inputCls} />
                    <p className="mt-1 text-[10px] text-neutral-400">Shown as the client on the letter. Left blank, the signer&apos;s name is used.</p>
                  </div>
                  {signers.length < 5 && (
                    <button type="button" onClick={() => setSigners((cur) => [...cur, { name: "", email: "" }])} className="inline-flex min-h-10 items-center text-xs font-semibold text-cyan-300 hover:text-white">
                      + Add another signer
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setStep(2)} disabled={!whoValid} className={`${CTA_CLASSES} w-full sm:w-auto`}>
                  <span className="sm:hidden">Continue →</span>
                  <span className="hidden sm:inline">Continue · choose the agreement →</span>
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {drsMonthly && (
                  <OfferCard
                    on={offer === "drs_monthly"}
                    onClick={() => chooseOffer("drs_monthly")}
                    emoji="🌧️"
                    accent="from-blue-500/25 to-cyan-500/10"
                    title="Digital Rainmaker · Monthly"
                    price={`${fmtWhole(DRS_PRICING.SETUP_FEE_CENTS)} setup`}
                    sub={`+ ${fmtWhole(TOTAL_MONTHLY_CENTS)}/mo from build complete (${fmtWhole(DRS_PRICING.MONTHLY_CENTS)} upkeep + ${fmtWhole(DRS_PRICING.AD_SPEND_MONTHLY_CENTS)} ad budget) · ${TERM_MONTHS.monthly}-month term from launch`}
                  />
                )}
                {drsAnnual && (
                  <OfferCard
                    on={offer === "drs_annual"}
                    onClick={() => chooseOffer("drs_annual")}
                    emoji="📆"
                    accent="from-cyan-500/25 to-emerald-500/10"
                    title="Digital Rainmaker · Annual"
                    price={`${fmtWhole(ANNUAL_UPFRONT_CENTS)} at signing`}
                    sub={`Setup + a year of the platform paid in full · ${fmtWhole(DRS_PRICING.AD_SPEND_MONTHLY_CENTS)}/mo ad budget from launch · ${TERM_MONTHS.annual}-month term from launch, no auto-renewal`}
                  />
                )}
                {enterprise && (
                  <div
                    className={`rounded-3xl border p-4 transition sm:col-span-2 sm:p-5 ${
                      offer === "enterprise" ? "border-violet-400/60 bg-violet-500/10 shadow-xl shadow-violet-600/15" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/10 text-xl">🏛️</span>
                      <div>
                        <p className="text-sm font-bold text-white">Nexli Enterprise License</p>
                        <p className="text-[11px] text-neutral-400">Paid in full at signing, ACH or wire only · 12-month license</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {ENTERPRISE_TIER_ORDER.map((t) => {
                        const info = ENTERPRISE_TIERS[t];
                        const on = offer === "enterprise" && tier === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => chooseOffer("enterprise", t)}
                            className={`rounded-2xl border p-3 text-left transition ${on ? "border-violet-300/70 bg-violet-500/20" : "border-white/10 bg-white/[0.03] hover:border-violet-400/40"}`}
                          >
                            <p className="text-xs font-bold text-white">{info.label}</p>
                            <p className="mt-0.5 text-xl font-bold text-white" style={SYNE}>
                              {fmtWhole(info.priceCents)}
                            </p>
                            <p className="text-[10px] text-neutral-400">For {info.firmSize} · renews {fmtWhole(renewalCents(t))}/yr</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {saved.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Your templates</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {saved.map((t) => {
                      const on = offer === `tpl:${t.id}`;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => chooseOffer(`tpl:${t.id}`)}
                          className={`rounded-2xl border p-3 text-left transition ${on ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                        >
                          <p className="truncate text-sm font-bold text-white">{t.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-400">{t.content.replace(/\s+/g, " ").slice(0, 110)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:px-4">
                <span className="col-span-5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Expires in</span>
                {[7, 14, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExpiresInDays(d)}
                    className={`min-h-10 rounded-xl px-2 text-xs font-bold transition sm:min-h-0 sm:rounded-full sm:px-3 sm:py-1 ${expiresInDays === d ? "bg-white/15 text-white" : "bg-white/[0.03] text-neutral-400 hover:text-white sm:bg-transparent"}`}
                  >
                    {d}
                    <span className="hidden sm:inline"> days</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setStep(1)} className={`${SECONDARY_BTN} w-full sm:w-auto`}>
                  ← Back
                </button>
                <button type="button" onClick={() => setStep(3)} disabled={!whatValid} className={`${CTA_CLASSES} w-full sm:w-auto`}>
                  <span className="sm:hidden">Review the letter →</span>
                  <span className="hidden sm:inline">Continue · review the letter →</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Signing</p>
                  <div className="mt-2 space-y-2">
                    {signers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-black text-white">
                          {s.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">{s.name}</span>
                          <span className="block truncate text-[11px] text-neutral-400">{s.email}</span>
                        </span>
                      </div>
                    ))}
                    {company.trim() && <p className="text-[11px] text-neutral-400">Client on the letter: <b className="text-neutral-200">{company.trim()}</b></p>}
                  </div>

                  <div className="mt-4 border-t border-white/5 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Agreement</p>
                    <p className="mt-1 text-sm font-bold text-white">{offerSummary?.title}</p>
                    <p className="text-xs text-cyan-200" style={NUM_FONT}>
                      {offerSummary?.price}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400">Expires {expiresInDays} days after sending</p>
                  </div>

                  <div className="mt-4 border-t border-white/5 pt-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500" htmlFor="eng-subject">
                      Subject
                    </label>
                    <input
                      id="eng-subject"
                      value={subject}
                      onChange={(e) => {
                        setSubjectTouched(true);
                        setSubjectText(e.target.value);
                      }}
                      className={`${inputCls} mt-1.5`}
                    />
                  </div>

                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                    <button type="button" onClick={() => setEditText((v) => !v)} className="inline-flex min-h-10 items-center text-xs font-semibold text-cyan-300 hover:text-white">
                      {editText ? "▾ Hide the letter text" : "▸ Edit the letter text"}
                    </button>
                    {editText && (
                      <textarea
                        value={content}
                        onChange={(e) => {
                          setContent(e.target.value);
                          setContentTouched(true);
                        }}
                        rows={14}
                        className={`${inputCls} resize-y font-mono text-[12px] leading-relaxed`}
                      />
                    )}
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-neutral-300">
                      <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
                      Save this letter as a template
                    </label>
                    {saveAsTemplate && <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" className={inputCls} />}
                  </div>
                </div>

                <div className="hidden space-y-4 lg:block">
                {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

                <button type="button" onClick={() => void send()} disabled={!canSend || (saveAsTemplate && !templateName.trim())} className={`${CTA_CLASSES} w-full py-4 text-base`}>
                  {sending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Sending…
                    </>
                  ) : (
                    <>
                      <SvgIcon d={SP.arrowUp} size={16} /> Send to {signers.length > 1 ? `${signers.length} signers` : signers[0].name.split(" ")[0]}
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setStep(2)} className={`${SECONDARY_BTN} w-full`}>
                  ← Back to the agreement
                </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2 border-b border-black/5 bg-neutral-50 px-4 py-2 text-[11px] font-semibold text-neutral-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  <span className="ml-2 truncate">What {signers[0].name.split(" ")[0]} will sign</span>
                </div>
                <div className="p-2 sm:p-6 lg:max-h-[78vh] lg:overflow-y-auto">
                  <DocumentPreview
                    content={fillClientPlaceholder(content, firm)}
                    subject={subject}
                    clientName={signers[0].name}
                    fromName={from.name}
                    fromCompany={from.company}
                  />
                </div>
              </div>

              {/* Phones & tablets: Send stays at the bottom of the screen while you read the letter */}
              <div
                className="sticky bottom-0 z-20 -mx-3 space-y-2 border-t border-white/10 bg-[#020617]/90 px-3 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(2)} className={`${SECONDARY_BTN} shrink-0 px-4`} aria-label="Back to the agreement">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!canSend || (saveAsTemplate && !templateName.trim())}
                    className={`${CTA_CLASSES} flex-1 text-base`}
                  >
                    {sending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Sending…
                    </>
                  ) : (
                    <>
                      <SvgIcon d={SP.arrowUp} size={16} /> Send to {signers.length > 1 ? `${signers.length} signers` : signers[0].name.split(" ")[0]}
                    </>
                  )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LaunchPadCanvas>
  );
}

function OfferCard({ on, onClick, emoji, accent, title, price, sub }: { on: boolean; onClick: () => void; emoji: string; accent: string; title: string; price: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-3xl border p-4 text-left transition sm:p-5 ${
        on ? "border-cyan-400/70 bg-cyan-500/10 shadow-xl shadow-cyan-500/15" : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-xl`}>{emoji}</span>
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white" style={SYNE}>
        {price}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{sub}</p>
      {on && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-[#020617]">✓</span>}
    </button>
  );
}

function SentCard({
  sent,
  firm,
  copied,
  onCopy,
  onView,
  onAnother,
}: {
  sent: { id: string; signers: { name: string; email: string; engageUrl: string }[]; emailErrors: string[] | null };
  firm: string;
  copied: string | null;
  onCopy: (url: string) => void;
  onView: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="lp-card mx-auto max-w-2xl rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-cyan-500/10 p-5 text-center shadow-2xl shadow-emerald-600/10 sm:p-8">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl text-emerald-200 ring-1 ring-emerald-400/40" style={{ animation: "lp-check-bounce 0.6s ease-out both" }}>
        ✓
      </span>
      <p className="mt-4 text-lg font-bold text-white" style={SYNE}>
        The letter{firm ? ` for ${firm}` : ""} is on its way
      </p>
      <p className="mt-1 text-sm text-neutral-400">They&apos;ll get an email with a link to review and sign. You&apos;ll see it move from Sent to Viewed to Signed.</p>
      <div className="mt-5 space-y-2 text-left">
        {sent.signers.map((s) => (
          <div key={s.email} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white">{s.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{s.name}</span>
              <span className="block truncate text-[11px] text-neutral-400">{s.email}</span>
            </span>
            {s.engageUrl && (
              <button
                type="button"
                onClick={() => onCopy(s.engageUrl)}
                className={`min-h-10 w-full shrink-0 rounded-full px-3 text-xs font-bold transition sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-[11px] ${copied === s.engageUrl ? "bg-emerald-500/25 text-emerald-100" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                {copied === s.engageUrl ? "✓ Copied" : "Copy signing link"}
              </button>
            )}
          </div>
        ))}
      </div>
      {sent.emailErrors && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          The letter was created, but an email didn&apos;t go out: {sent.emailErrors.join("; ")}. Copy the signing link and send it yourself.
        </p>
      )}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={onView} className={CTA_CLASSES}>
          View the letter
        </button>
        <button type="button" onClick={onAnother} className={SECONDARY_BTN}>
          Send another
        </button>
      </div>
    </div>
  );
}
