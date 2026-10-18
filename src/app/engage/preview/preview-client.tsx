"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDrsTemplate } from "@/lib/engagement-defaults";
import { type BillingPlan } from "@/lib/drs-pricing";
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
  LaunchPadShell,
  useForceDark,
} from "@/components/launch-pad";
import {
  DrsAtAGlance,
  EngagementLetterView,
  DRS_FIGURES,
  LETTER_ICONS as X,
  findSectionNum,
  parseLetter,
} from "@/components/engagement-launch-pad";

// ══════════════════════════════════════════════════════════
// /engage/preview — DESIGN PREVIEW of the engagement-letter signing page on
// the Launch Pad visual system. Nothing is saved or sent. The legal text is
// the real, unmodified output of buildDrsTemplate(plan); only the
// presentation changes. The real page for Nexli-issued letters
// (/engage/[token] → engage-launch-pad-client.tsx) uses the same pieces.
// ══════════════════════════════════════════════════════════

export function EngagePreviewClient() {
  // /engage/layout.tsx forces LIGHT mode in its own effect, which runs after
  // ours (parent effects fire after child effects) — so force dark here and
  // re-apply it on the next frame. The shell paints its own dark canvas anyway.
  useForceDark();
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add("dark"));
    return () => cancelAnimationFrame(id);
  }, []);

  const [plan, setPlan] = useState<BillingPlan>("monthly");
  const letter = useMemo(() => buildDrsTemplate(plan), [plan]);
  const { sections } = useMemo(() => parseLetter(letter), [letter]);
  const esignNum = findSectionNum(sections, "ELECTRONIC SIGNATURES");
  const [readPct, setReadPct] = useState(0);

  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [burst, setBurst] = useState(0);

  const successRef = useRef<HTMLDivElement | null>(null);

  const canSign = name.trim().length > 1 && agreed;

  function sign() {
    if (!canSign) return;
    setSigned(true);
    setBurst((b) => b + 1);
    requestAnimationFrame(() =>
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }

  const badgeIcon = <Icon d={X.fileText} size={14} className="text-cyan-400" />;

  return (
    <LaunchPadShell maxWidth="3xl" badge="Engagement Agreement" badgeIcon={badgeIcon} burst={burst}>
      {/* ─── Preview controls ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lp-card">
        <p className="inline-flex items-center gap-2 self-start rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Design preview — nothing here is saved or sent
        </p>
        <div
          role="group"
          aria-label="Preview billing plan"
          className="inline-flex self-start rounded-full p-1 bg-white/5 border border-white/10"
        >
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              aria-pressed={plan === p}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                plan === p ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-neutral-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Digital Rainmaker System
            </p>
            <h1
              className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1"
              style={SYNE}
            >
              Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                Service Agreement
              </span>
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-neutral-300">
              Prepared for <span className="font-semibold text-white">Sample Client</span> · Nexli Automation LLC
            </p>
            <p className="text-xs mt-2 text-neutral-500">
              {sections.length} sections · each one starts with a plain-English summary. Sign at the bottom.
            </p>
          </div>
          <ProgressRing percent={readPct} />
        </div>
      </section>

      <DrsAtAGlance plan={plan} />

      {/* ─── The agreement ─── */}
      <EngagementLetterView content={letter} kind="drs" plan={plan} onReadProgress={setReadPct} />

      {/* ─── Signature ─── */}
      <div id="sign" ref={successRef} style={{ scrollMarginTop: 24 }}>
        {signed ? (
          <ShimmerCard className="lp-card">
            <div className="text-3xl mb-1">🎉</div>
            <h2 className="text-xl font-black text-white" style={SYNE}>
              Signed — welcome aboard
            </h2>
            <p className="text-sm mt-1 text-neutral-300">
              Next: your {DRS_FIGURES.setup} setup invoice and your Launch Pad link arrive by email.
            </p>
            <p className="text-[11px] mt-3 text-amber-300/80">(Preview — nothing was saved)</p>
          </ShimmerCard>
        ) : (
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
                  Type your full legal name. Your typed name is your electronic signature{esignNum ? ` (Section ${esignNum})` : ""}.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="sig-name" className={labelCls}>
                  Full name
                </label>
                <input
                  id="sig-name"
                  type="text"
                  autoComplete="name"
                  className="lp-input"
                  placeholder="e.g. Jordan Sample"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <p className={labelCls}>Signature preview</p>
                <div className="rounded-xl px-4 py-4 min-h-[76px] flex items-end bg-white/[0.03] border border-dashed border-white/15">
                  <span
                    className={`text-3xl sm:text-4xl leading-none truncate ${name.trim() ? "text-white" : "text-white/20"}`}
                    style={{ fontFamily: "var(--font-signature), cursive" }}
                    aria-live="polite"
                  >
                    {name.trim() || "Your signature"}
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
                <span className="text-sm text-neutral-300">
                  I&apos;ve read and agree to the agreement above.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <button type="button" onClick={sign} disabled={!canSign} className={CTA_CLASSES}>
                  <Icon d={X.penLine} size={16} /> Sign agreement
                </button>
                <button
                  type="button"
                  aria-disabled="true"
                  title="Available on the real page"
                  onClick={(e) => e.preventDefault()}
                  className={`${SECONDARY_BTN} inline-flex items-center justify-center gap-2 opacity-50 cursor-not-allowed hover:bg-white/5 hover:text-neutral-400`}
                >
                  <Icon d={X.download} size={15} /> Download PDF
                </button>
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-neutral-500">Secured e-signature</span>
                </div>
              </div>
            </div>
          </LpCard>
        )}
      </div>

      <footer className="text-center pb-6 space-y-2">
        <p className="text-[11px] text-neutral-500">
          Questions before you sign? Your Nexli team is one message away.
        </p>
        <p className="text-[10px] text-neutral-600">
          Nexli Automation LLC • Powered by the Digital Rainmaker System
        </p>
      </footer>
    </LaunchPadShell>
  );
}
