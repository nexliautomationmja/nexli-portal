// ─── Launch Pad keyframes + base rules ─────────────────────
// Inline <style> so the client pages (Launch Pad, pulse check) carry
// their own animations without touching globals.css.

export function LaunchPadStyles() {
  return (
    <style>{`
        @keyframes lp-confetti-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--lp-drift), 105vh, 0) rotate(var(--lp-spin)); opacity: 0.9; }
        }
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-check-bounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.25); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .lp-card { animation: lp-fade-up 0.5s ease-out both; }
        .lp-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: #fff;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .lp-input::placeholder { color: rgba(255, 255, 255, 0.3); }
        .lp-input:focus { border-color: #3B82F6; }
        .lp-input option { background: #020617; color: #fff; }
      `}</style>
  );
}
