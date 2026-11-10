"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CANVAS_VARS } from "./tokens";

export type ToastTone = "neutral" | "success" | "error";
export interface ToastState {
  /** New for every call, so the same text twice restarts the timer. */
  id: number;
  text: string;
  tone: ToastTone;
}

/** One short message at a time: `showToast("Copied 📋")`, errors stay a little longer. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const showToast = useCallback((text: string, tone: ToastTone = "neutral") => {
    seq.current += 1;
    setToast({ id: seq.current, text, tone });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), toast.tone === "error" ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, showToast, clearToast };
}

const TONE: Record<ToastTone, string> = {
  neutral: "border-white/10 text-white",
  success: "border-emerald-500/30 text-emerald-50",
  error: "border-rose-500/40 text-rose-100",
};

/** Bottom of the screen, above any open sheet (portaled, z-[120]). */
export function Toast({ toast }: { toast: ToastState | null }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[120] flex justify-center px-4"
      style={CANVAS_VARS}
    >
      {toast && (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={`max-w-md rounded-full border bg-[#0b1220] px-4 py-2.5 text-center text-sm font-semibold shadow-2xl shadow-black/60 ${TONE[toast.tone]}`}
        >
          {toast.text}
        </div>
      )}
    </div>,
    document.body
  );
}
