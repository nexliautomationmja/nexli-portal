"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface EngageData {
  clientName: string;
  subject: string;
  content: string;
  expiresAt: string;
  status: string;
}

export function EngageClient({ token }: { token: string }) {
  const [data, setData] = useState<EngageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white">{error}</h1>
          <p className="text-sm text-white/50">
            This engagement letter link may have expired or already been used.
          </p>
        </div>
      </div>
    );
  }

  // Signed success state
  if (signed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white">Engagement Letter Signed</h1>
          <p className="text-sm text-white/50">
            Thank you, {data?.clientName}. Your signature has been recorded securely.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4 text-[10px] text-white/30 uppercase tracking-widest font-bold">
            <span>ESIGN Act Compliant</span>
            <span>IP Recorded</span>
            <span>Timestamped</span>
          </div>
        </div>
      </div>
    );
  }

  // Declined state
  if (declined) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white">Engagement Declined</h1>
          <p className="text-sm text-white/50">
            You have declined this engagement letter. The sender has been notified.
          </p>
        </div>
      </div>
    );
  }

  // Main signing UI
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="px-3 py-1.5 rounded-lg"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              <span className="text-white text-sm font-extrabold tracking-wider">
                NEXLI
              </span>
            </div>
            <span className="text-sm text-white/40">Engagement Letter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              Secure
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Engagement letter info */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h1 className="text-xl font-black text-white mb-2">
            {data?.subject}
          </h1>
          <p className="text-sm text-white/60 mb-6">
            Hi {data?.clientName}, please review the engagement letter below and sign to confirm your agreement.
          </p>

          {/* Letter content */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <pre className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed font-sans">
              {data?.content}
            </pre>
          </div>
        </div>

        {/* Legal disclosure */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-sm font-bold text-white">
            Electronic Signature Disclosure
          </h2>
          <p className="text-xs text-white/50 leading-relaxed">
            By signing this engagement letter electronically, you agree that your electronic signature
            is the legal equivalent of your handwritten signature. This transaction is governed
            by the Electronic Signatures in Global and National Commerce Act (ESIGN Act, 15
            U.S.C. &sect; 7001 et seq.) and the Uniform Electronic Transactions Act (UETA).
            Your signature, IP address, and timestamp will be recorded as part of the signing
            record.
          </p>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-blue-500"
            />
            <span className="text-sm text-white/80 group-hover:text-white transition-colors">
              I have read the engagement letter above and agree to use electronic signatures.
            </span>
          </label>
        </div>

        {/* Signature pad */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Draw Your Signature</h2>
            {hasDrawn && (
              <button
                onClick={clearSignature}
                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="rounded-xl border-2 border-dashed border-white/20 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
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
            <p className="text-[10px] text-white/30 text-center">
              Use your mouse or finger to draw your signature above
            </p>
          )}

          {/* Typed name verification */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-white/40">
              Type your full name to confirm
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={data?.clientName || "Full name"}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSign}
            disabled={!canSign || signing}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            {signing ? "Signing..." : "Sign Engagement Letter"}
          </button>
          <button
            onClick={() => setShowDeclineModal(true)}
            className="px-6 py-3.5 rounded-xl text-sm font-bold text-white/50 border border-white/10 hover:border-red-500/30 hover:text-red-400 transition-all"
          >
            Decline
          </button>
        </div>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 py-4">
          {["ESIGN Act Compliant", "IP Recorded", "Timestamp Verified"].map(
            (badge) => (
              <div key={badge} className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                  {badge}
                </span>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/20">
          Powered by Nexli Portal &bull; Digital Rainmaker System
        </p>
      </main>

      {/* Decline modal */}
      {showDeclineModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowDeclineModal(false)}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto z-50 rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Decline Engagement</h2>
            <p className="text-sm text-white/50">
              Are you sure? The sender will be notified that you declined.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-transparent text-white text-sm outline-none focus:border-red-500 resize-none transition-colors"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/50 border border-white/10 hover:border-white/20 transition-colors"
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
