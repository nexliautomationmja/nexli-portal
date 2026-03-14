"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DocumentPreview } from "@/components/engagement-document";

interface EngageData {
  clientName: string;
  subject: string;
  content: string;
  expiresAt: string;
  status: string;
  role?: string | null;
  from?: {
    name: string;
    company: string;
  };
}

export function EngageClient({ token }: { token: string }) {
  const [data, setData] = useState<EngageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Step flow: 1=Review, 2=Sign, 3=Complete
  const [step, setStep] = useState(1);

  // Signing state
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signSectionRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/engage/${token}`);
        if (!res.ok) {
          const body = await res.json();
          setError(body.error || "Invalid or expired link");
          return;
        }
        const d = await res.json();
        setData(d);
      } catch {
        setError("Failed to load engagement letter");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function handleStart() {
    setStep(2);
    setTimeout(() => {
      signSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function handleSign() {
    if (!data || !agreed || !hasDrawn || !typedName.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSigning(true);
    try {
      const signatureData = canvas.toDataURL("image/png");
      const res = await fetch(`/api/engage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, typedName: typedName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Signing failed");
        return;
      }
      setSigned(true);
      setStep(3);
    } catch {
      setError("Signing failed. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  async function handleDecline() {
    try {
      await fetch(`/api/engage/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      setDeclined(true);
      setShowDeclineModal(false);
    } catch {
      setError("Failed to decline");
    }
  }

  const canSign = agreed && hasDrawn && typedName.trim().length > 0;

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{error}</h1>
            <p className="text-sm text-gray-500">
              This engagement letter link may have expired or already been used.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Signed Success ──────────────────────────────
  if (signed) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <style>{`
          @keyframes check-bounce {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.25); opacity: 1; }
            70% { transform: scale(0.9); }
            85% { transform: scale(1.08); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-10 text-center space-y-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: "linear-gradient(135deg, #10B981, #06B6D4)",
                animation: "check-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 style={{ color: "#000000", fontSize: "22px", fontWeight: 800, margin: 0 }}>Engagement Letter Signed</h1>
            <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
              Thank you, {data?.clientName}. Your signature has been recorded securely.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4 text-[10px] uppercase tracking-widest font-bold" style={{ color: "#9ca3af" }}>
              <span>ESIGN Act Compliant</span>
              <span>&bull;</span>
              <span>IP Recorded</span>
              <span>&bull;</span>
              <span>Timestamped</span>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ─── Declined ────────────────────────────────────
  if (declined) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Engagement Declined</h1>
            <p className="text-sm text-gray-500">
              You have declined this engagement letter. The sender has been notified.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ─── Main DocuSign-Style UI ──────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />

      {/* Yellow action banner */}
      <div className="bg-[#FFF4CC] border-b border-[#F5E6A3]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#B8860B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
            </svg>
            <span className="text-sm font-semibold text-[#7A5C00]">
              Please review this document and sign below
            </span>
          </div>
          {step === 1 && (
            <button
              onClick={handleStart}
              className="px-5 py-2 rounded-md text-sm font-bold text-white bg-[#D4A017] hover:bg-[#C4920F] transition-colors shadow-sm"
            >
              Start
            </button>
          )}
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2 text-xs">
            <StepBadge num={1} label="Review" active={step >= 1} current={step === 1} />
            <div className="w-8 h-px bg-gray-300" />
            <StepBadge num={2} label="Sign" active={step >= 2} current={step === 2} />
            <div className="w-8 h-px bg-gray-300" />
            <StepBadge num={3} label="Complete" active={step >= 3} current={step === 3} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-6 space-y-6">

          {/* ═══ THE DOCUMENT ═══ */}
          <div className="rounded-lg shadow-lg overflow-hidden">
            {/* Document Preview */}
            <DocumentPreview
              content={data?.content || ""}
              subject={data?.subject || ""}
              clientName={data?.clientName || ""}
              fromName={data?.from?.name || ""}
              fromCompany={data?.from?.company || ""}
              date={today}
            />

          </div>

          {/* ═══ SIGNATURE BLOCK ═══ */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" ref={signSectionRef}>
            <div className="px-10 py-8">
              {step >= 2 ? (
                <div className="border-2 border-[#D4A017] rounded-lg overflow-hidden">
                  {/* Yellow Sign Here tab */}
                  <div className="bg-[#D4A017] px-4 py-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                    </svg>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Sign Here</span>
                    {hasDrawn && (
                      <button
                        onClick={clearSignature}
                        className="ml-auto text-xs text-white/80 hover:text-white font-semibold transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {/* Canvas */}
                  <div className="bg-white">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={180}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  {!hasDrawn && (
                    <div className="bg-[#FFFDF0] px-4 py-2 flex items-center gap-2 border-t border-[#F5E6A3]">
                      <svg className="w-3.5 h-3.5 text-[#B8860B] animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m5 12 7 7 7-7" />
                      </svg>
                      <span className="text-xs text-[#7A5C00]">Draw your signature above using your mouse or finger</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Preview signature placeholder before step 2 */
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                    </svg>
                    <span className="text-sm font-medium">Signature Required</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Click &ldquo;Start&rdquo; above to begin signing</p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ SIGN ACTIONS (below document) ═══ */}
          {step >= 2 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
              {/* Representative role banner */}
              {data?.role && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-800">
                    Signing as: {data.role}
                  </span>
                </div>
              )}

              {/* Typed name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Type your full name to confirm
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={data?.clientName || "Full name"}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Agreement */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 accent-blue-600"
                />
                <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                  {data?.role ? (
                    <>
                      I have read the engagement letter above and, as {data.role}, agree to sign electronically
                      on behalf of the organization.
                      By signing, I acknowledge that my electronic signature is the legal equivalent
                      of my handwritten signature under the ESIGN Act (15 U.S.C. &sect; 7001) and UETA.
                      My signature, role, IP address, and timestamp will be recorded.
                    </>
                  ) : (
                    <>
                      I have read the engagement letter above and agree to sign electronically.
                      By signing, I acknowledge that my electronic signature is the legal equivalent
                      of my handwritten signature under the ESIGN Act (15 U.S.C. &sect; 7001) and UETA.
                      My signature, IP address, and timestamp will be recorded.
                    </>
                  )}
                </span>
              </label>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSign}
                  disabled={!canSign || signing}
                  className="flex-1 py-3.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-all shadow-sm"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  {signing ? "Signing..." : "Finish"}
                </button>
                <button
                  onClick={() => setShowDeclineModal(true)}
                  className="px-5 py-3.5 rounded-lg text-sm font-medium text-gray-500 border border-gray-300 hover:border-red-300 hover:text-red-500 transition-all"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* ═══ Decline Modal ═══ */}
      {showDeclineModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowDeclineModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Decline Engagement</h2>
            <p className="text-sm text-gray-500">
              Are you sure? The sender will be notified that you declined.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm outline-none focus:border-red-500 resize-none transition-colors"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-500 border border-gray-300 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared Components ─────────────────────────────

function Header() {
  return (
    <header className="bg-[#0a0a0f] px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <img
          src="/logos/nexli-logo-white-wordmark@2x.png"
          alt="Nexli"
          className="h-7"
        />
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs text-emerald-400 font-semibold">Secure</span>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0a0a0f] px-6 py-4 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <img
              src="/logos/nexli-logo-white-wordmark@2x.png"
              alt="Nexli"
              className="h-4 opacity-40"
            />
            <span className="text-[10px] text-gray-500">&bull; Digital Rainmaker System</span>
          </div>
          <div className="flex items-center gap-4">
            {["ESIGN Act Compliant", "IP Recorded", "Timestamp Verified"].map((badge) => (
              <div key={badge} className="flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">{badge}</span>
              </div>
            ))}
          </div>
        </div>
        <a href="/portal" className="text-[10px] text-blue-500/50 hover:text-blue-400 no-underline">
          Sign in to Client Portal
        </a>
      </div>
    </footer>
  );
}

function StepBadge({ num, label, active, current }: { num: number; label: string; active: boolean; current: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${current ? "text-blue-600" : active ? "text-emerald-600" : "text-gray-400"}`}>
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
          current
            ? "bg-blue-600 text-white"
            : active
            ? "bg-emerald-100 text-emerald-600 border border-emerald-300"
            : "bg-gray-100 text-gray-400 border border-gray-300"
        }`}
      >
        {active && !current ? (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          num
        )}
      </div>
      <span className="font-semibold">{label}</span>
    </div>
  );
}
