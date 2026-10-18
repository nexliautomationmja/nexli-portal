"use client";

// ══════════════════════════════════════════════════════════
// /engage/[token] for letters Nexli itself issues (Digital Rainmaker System,
// Nexli Enterprise License, Firm Foundation) — the signing page on the
// Launch Pad visual system. Letters a client firm sends to its own clients
// keep the classic page (engage-client.tsx). Both pages use the same API
// helpers (use-engagement.ts), so signing behaves identically. The contract
// text renders verbatim; only the presentation differs.
// ══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { ANNUAL_UPFRONT_CENTS, type BillingPlan } from "@/lib/drs-pricing";
import type { EnterpriseTier } from "@/lib/enterprise-pricing";
import {
  ACCENT,
  SYNE,
  CTA_CLASSES,
  SECONDARY_BTN,
  labelCls,
  Icon,
  PATHS,
  ProgressRing,
  LpCard,
  IconChip,
  Pill,
  ShimmerCard,
  LpSpinner,
  LpMessage,
  LaunchPadShell,
  useForceDark,
} from "@/components/launch-pad";
import {
  EngagementLetterView,
  LetterAtAGlance,
  LETTER_ICONS as X,
  findSectionNum,
  parseLetter,
  type LetterKind,
} from "@/components/engagement-launch-pad";
import {
  useEngagement,
  signEngagement,
  declineEngagement,
  agreementText,
  SignatureCanvas,
  type SignResult,
} from "./use-engagement";

const EYEBROW: Record<LetterKind, string> = {
  drs: "Digital Rainmaker System",
  enterprise: "Nexli Enterprise License",
  foundation: "Firm Foundation",
};

const DEFAULT_TITLE = "Your Service Agreement";

/** The subject's lead phrase ("Firm Foundation Service Agreement — Acme" → "Firm Foundation Service Agreement"). */
function subjectGist(subject: string | null | undefined, eyebrow: string): string {
  const gist = (subject ?? "").split(/\s+[—–|-]\s+|:\s+/)[0]?.trim() ?? "";
  if (!gist || gist.toLowerCase() === eyebrow.toLowerCase()) return DEFAULT_TITLE;
  return gist;
}

/** Last two words get the brand gradient, like "Your Service Agreement". */
function HeroTitle({ text }: { text: string }) {
  const words = text.split(/\s+/);
  const accentCount = words.length > 2 ? 2 : words.length > 1 ? 1 : words.length;
  const lead = words.slice(0, words.length - accentCount).join(" ");
  const tail = words.slice(words.length - accentCount).join(" ");
  return (
    <h1
      className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1 break-words"
      style={SYNE}
    >
      {lead && <>{lead} </>}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
        {tail}
      </span>
    </h1>
  );
}

function formatSignedDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EsignBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-widest font-bold text-neutral-500">
      <span>ESIGN Act &amp; UETA Compliant</span>
      <span aria-hidden="true">&bull;</span>
      <span>IP Recorded</span>
      <span aria-hidden="true">&bull;</span>
      <span>Timestamped</span>
    </div>
  );
}

type Signed = Extract<SignResult, { ok: true }>;

function SignedNextSteps({
  kind,
  plan,
  result,
}: {
  kind: LetterKind;
  plan: BillingPlan;
  result: Signed;
}) {
  if (!result.allSigned) {
    return (
      <p className="text-sm mt-2 text-neutral-300">
        We&apos;ll email you as soon as everyone has signed.
      </p>
    );
  }
  if (kind === "enterprise") {
    return (
      <p className="text-sm mt-2 text-neutral-300">
        Your Enterprise License invoice is on its way — payable by ACH or wire. We&apos;ll schedule
        your kickoff week as soon as funds clear.
      </p>
    );
  }
  if (kind === "foundation") {
    return (
      <p className="text-sm mt-2 text-neutral-300">
        Check your email for your welcome message and portal setup link.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm mt-2 text-neutral-300">
        {plan === "annual"
          ? `Next: your $${(ANNUAL_UPFRONT_CENTS / 100).toLocaleString("en-US")} invoice is in your inbox. Your Launch Pad opens the moment it's paid.`
          : "Next: your setup invoice is in your inbox. Your Launch Pad opens the moment it's paid."}
      </p>
      {result.onboardingUrl && (
        <div className="mt-5 flex justify-center">
          <a href={result.onboardingUrl} className={`${CTA_CLASSES} no-underline`}>
            Open your Launch Pad &rarr;
          </a>
        </div>
      )}
    </>
  );
}

export function EngageLaunchPadClient({
  token,
  kind,
  plan = "monthly",
  tier = "core",
  showSummaries,
}: {
  token: string;
  kind: LetterKind;
  plan?: BillingPlan;
  tier?: EnterpriseTier;
  showSummaries: boolean;
}) {
  // /engage/layout.tsx forces LIGHT mode in its own effect, which runs after
  // ours (parent effects fire after child effects) — so force dark here and
  // re-apply it on the next frame. The shell paints its own dark canvas anyway.
  useForceDark();
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add("dark"));
    return () => cancelAnimationFrame(id);
  }, []);

  const { status, data, error } = useEngagement(token);
  const sections = useMemo(() => (data ? parseLetter(data.content).sections : []), [data]);
  const esignNum = findSectionNum(sections, "ELECTRONIC SIGNATURES");
  const summaries = showSummaries && kind !== "foundation";

  const [readPct, setReadPct] = useState(0);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState<Signed | null>(null);
  const [burst, setBurst] = useState(0);

  const [declined, setDeclined] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canSign = agreed && typedName.trim().length > 0;

  async function handleSign() {
    if (!data || !canSign || signing) return;
    setSigning(true);
    setSignError(null);
    const result = await signEngagement(token, typedName, canvasRef.current);
    setSigning(false);
    if (!result.ok) {
      setSignError(result.error);
      return;
    }
    setSigned(result);
    setBurst((b) => b + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDecline() {
    if (declining) return;
    setDeclining(true);
    setDeclineError(null);
    const result = await declineEngagement(token, declineReason);
    setDeclining(false);
    if (!result.ok) {
      setDeclineError(result.error);
      return;
    }
    setShowDecline(false);
    setDeclined(true);
  }

  // Escape closes the decline dialog.
  useEffect(() => {
    if (!showDecline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDecline(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDecline]);

  // ─── Loading / error / declined ──────────────────
  if (status === "loading") return <LpSpinner fullScreen />;

  if (status === "error" || !data) {
    return (
      <LpMessage
        emoji="🔒"
        title={error ?? "Invalid or expired link"}
        body="This link may have expired or already been used."
      />
    );
  }

  if (declined) {
    return (
      <LpMessage
        emoji="👋"
        title="Agreement declined"
        body="You have declined this engagement letter. The sender has been notified."
      />
    );
  }

  const badgeIcon = <Icon d={X.fileText} size={14} className="text-cyan-400" />;
  const eyebrow = EYEBROW[kind];
  const company = data.from?.company || "";
  const providerName = company || data.from?.name || "";
  const sender = data.sender?.signatureData ? data.sender : null;

  const footer = (
    <footer className="text-center pb-6 space-y-2">
      <p className="text-[11px] text-neutral-500">
        Questions before you sign? Your Nexli team is one message away.
      </p>
      <p className="text-[10px] text-neutral-600">
        {company || "Nexli Automation LLC"} • Electronic signatures are legally binding under the
        ESIGN Act and UETA
      </p>
    </footer>
  );

  // ─── Signed ──────────────────────────────────────
  if (signed) {
    return (
      <LaunchPadShell maxWidth="3xl" badge="Engagement Agreement" badgeIcon={badgeIcon} burst={burst}>
        <ShimmerCard className="lp-card">
          <div className="text-3xl mb-1">🎉</div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{eyebrow}</p>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1" style={SYNE}>
            Agreement signed
          </h1>
          <p className="text-sm mt-2 text-neutral-300">
            Thank you, {data.clientName}. Your signature has been recorded securely.
          </p>
          <SignedNextSteps kind={kind} plan={plan} result={signed} />
          <div className="mt-6">
            <EsignBadges />
          </div>
        </ShimmerCard>
        {footer}
      </LaunchPadShell>
    );
  }

  // ─── Main ────────────────────────────────────────
  return (
    <LaunchPadShell maxWidth="3xl" badge="Engagement Agreement" badgeIcon={badgeIcon} burst={burst}>
      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</p>
            <HeroTitle text={subjectGist(data.subject, eyebrow)} />
            <p className="text-sm mt-3 leading-relaxed text-neutral-300">
              Prepared for <span className="font-semibold text-white">{data.clientName}</span>
              {data.clientCompany ? `, ${data.clientCompany}` : ""} ·{" "}
              {company || "Nexli Automation LLC"}
            </p>
            <p className="text-xs mt-2 text-neutral-500">
              {sections.length > 0 && `${sections.length} sections`}
              {sections.length > 0 && (summaries ? " · each one starts with a plain-English summary. " : ". ")}
              Sign at the bottom.
            </p>
          </div>
          <ProgressRing percent={readPct} />
        </div>
      </section>

      {summaries && <LetterAtAGlance kind={kind} plan={plan} tier={tier} />}

      {/* ─── The agreement (verbatim) ─── */}
      <EngagementLetterView
        content={data.content}
        kind={kind}
        plan={plan}
        tier={tier}
        showSummaries={summaries}
        onReadProgress={setReadPct}
      />

      {/* ─── Disclosures (same text as the classic page) ─── */}
      <LpCard className="lp-card">
        <div className="space-y-4">
          <div>
            <p className={labelCls}>Payment processing</p>
            <p className="text-xs leading-relaxed text-neutral-400">
              Payments for services rendered under this engagement are processed
              through Stripe, Inc., a third-party payment processor. By executing
              this agreement, you acknowledge and agree that{" "}
              {providerName} is not responsible for any payment holds,
              account freezes, processing delays, or disputes imposed by Stripe or
              your financial institution. To minimize processing issues, we
              recommend maintaining a complete and accurate business profile with
              your payment provider. All payment data is handled directly by
              Stripe in accordance with their security and privacy policies;{" "}
              {providerName} does not store your full payment
              credentials.
            </p>
          </div>
          <div>
            <p className={labelCls}>About this platform</p>
            <p className="text-xs leading-relaxed text-neutral-500">
              This document is delivered through the Nexli Portal platform. The
              platform provider is not a party to this agreement.
            </p>
          </div>
        </div>
      </LpCard>

      {/* ─── Provider signature (pre-attached by the sender) ─── */}
      {sender && (
        <LpCard className="lp-card">
          <div className="flex items-start gap-3">
            <IconChip accent="emerald">
              <Icon d={PATHS.circleCheck} size={22} className={ACCENT.emerald.icon} />
            </IconChip>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Service provider</p>
              <h2 className="text-base sm:text-lg font-bold text-white" style={SYNE}>
                Provider signature
              </h2>
              <div className="mt-3 inline-flex items-end rounded-xl bg-white px-4 py-2 h-[72px] max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sender.signatureData ?? ""}
                  alt={`Signature of ${sender.name || providerName}`}
                  className="max-h-14 max-w-full object-contain object-left-bottom"
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">
                {sender.name || data.from?.name || company || "—"}
              </p>
              <p className="text-xs text-neutral-400">
                {sender.role ||
                  (company ? `Authorized Representative, ${company}` : "Authorized Representative")}
              </p>
              {sender.signedAt && (
                <p className="mt-1 text-[11px] text-neutral-500">Signed {formatSignedDate(sender.signedAt)}</p>
              )}
            </div>
          </div>
        </LpCard>
      )}

      {/* ─── Signature ─── */}
      <div id="sign" style={{ scrollMarginTop: 24 }}>
        <LpCard className="lp-card">
          <div className="flex items-start gap-3">
            <IconChip accent="blue">
              <Icon d={X.penLine} size={22} className={ACCENT.blue.icon} />
            </IconChip>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white flex-1 min-w-0" style={SYNE}>
                  Sign the agreement
                </h2>
                {canSign ? (
                  <Pill tone="done" accent="blue">
                    Ready to sign ✓
                  </Pill>
                ) : (
                  <Pill tone="neutral">Required</Pill>
                )}
              </div>
              <p className="text-sm mt-1 leading-relaxed text-neutral-300">
                Type your full legal name. Your typed name is your electronic signature
                {esignNum ? ` (Section ${esignNum})` : ""}.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {data.role && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${ACCENT.blue.noteStrip}`}>
                <svg
                  className="w-4 h-4 text-blue-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-xs font-semibold text-blue-200">Signing as: {data.role}</span>
              </div>
            )}

            <div>
              <label htmlFor="sig-name" className={labelCls}>
                Full name
              </label>
              <input
                id="sig-name"
                type="text"
                autoComplete="name"
                className="lp-input"
                placeholder={data.clientName || "Full name"}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
              />
            </div>

            <div>
              <p className={labelCls}>Signature preview</p>
              <div className="rounded-xl px-4 py-4 min-h-[76px] flex items-end bg-white/[0.03] border border-dashed border-white/15">
                <span
                  className={`text-3xl sm:text-4xl leading-none truncate ${typedName.trim() ? "text-white" : "text-white/20"}`}
                  style={{ fontFamily: "var(--font-signature), cursive" }}
                  aria-live="polite"
                >
                  {typedName.trim() || "Your signature"}
                </span>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
              />
              <span className="text-xs leading-relaxed text-neutral-300">{agreementText(data.role)}</span>
            </label>

            {signError && (
              <p role="alert" className="rounded-xl px-4 py-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30">
                {signError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <button type="button" onClick={handleSign} disabled={!canSign || signing} className={CTA_CLASSES}>
                <Icon d={X.penLine} size={16} /> {signing ? "Signing…" : "Sign agreement"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeclineError(null);
                  setShowDecline(true);
                }}
                disabled={signing}
                className={SECONDARY_BTN}
              >
                Decline
              </button>
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
                <span className="text-[11px] text-neutral-500">Secured e-signature</span>
              </div>
            </div>
          </div>
        </LpCard>
      </div>

      {footer}

      <SignatureCanvas ref={canvasRef} />

      {/* ─── Decline dialog ─── */}
      {showDecline && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={() => setShowDecline(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-title"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto rounded-2xl bg-[#0b1224] shadow-2xl"
          >
            <LpCard>
              <h2 id="decline-title" className="text-lg font-bold text-white" style={SYNE}>
                Decline this agreement?
              </h2>
              <p className="text-sm mt-1 text-neutral-400">
                The sender will be notified that you declined.
              </p>
              <label htmlFor="decline-reason" className={`${labelCls} mt-4`}>
                Reason (optional)
              </label>
              <textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                className="lp-input resize-none"
              />
              {declineError && (
                <p role="alert" className="mt-3 text-sm text-red-300">
                  {declineError}
                </p>
              )}
              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button type="button" onClick={() => setShowDecline(false)} className={SECONDARY_BTN}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={declining}
                  className="px-5 py-3 rounded-full text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {declining ? "Declining…" : "Decline"}
                </button>
              </div>
            </LpCard>
          </div>
        </>
      )}
    </LaunchPadShell>
  );
}
