"use client";

import { useState, useRef } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScanIcon, UploadIcon, XIcon } from "@/components/ui/icons";

interface KeyTerm {
  label: string;
  value: string;
}

interface RedFlag {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

interface Analysis {
  verdict: "green" | "yellow" | "red";
  verdictLabel: string;
  verdictReason: string;
  documentType: string;
  summary: string;
  bulletPoints: string[];
  keyTerms: KeyTerm[];
  redFlags: RedFlag[];
  favorable: string[];
  recommendations: string[];
}

const VERDICT_STYLE: Record<
  Analysis["verdict"],
  { badge: string; ring: string; emoji: string }
> = {
  green: {
    badge: "badge badge-emerald",
    ring: "var(--accent-emerald-border)",
    emoji: "✅",
  },
  yellow: {
    badge: "badge badge-amber",
    ring: "rgba(245, 158, 11, 0.3)",
    emoji: "⚠️",
  },
  red: {
    badge: "badge badge-rose",
    ring: "rgba(244, 63, 94, 0.35)",
    emoji: "🚩",
  },
};

const SEVERITY_STYLE: Record<RedFlag["severity"], { badge: string; label: string }> = {
  high: { badge: "badge badge-rose", label: "High" },
  medium: { badge: "badge badge-amber", label: "Medium" },
  low: { badge: "badge badge-gray", label: "Low" },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContractAnalyzerClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzedName, setAnalyzedName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError("File is over 4MB. Please upload a smaller PDF, image, or text file.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/dashboard/contract-analyzer", {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Analysis failed. Please try again.");
        return;
      }
      setAnalysis(body.analysis);
      setAnalyzedName(body.fileName || file.name);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setError(null);
    setAnalyzedName("");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Contract Analyzer
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Upload a contract and get a plain-English breakdown, red flags, and a
          verdict on whether it&apos;s safe to sign.
        </p>
      </div>

      {/* ─── Upload / analyze ─── */}
      {!analysis && (
        <GlassCard className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg p-8 text-center cursor-pointer transition-colors"
            style={{
              border: dragging
                ? "2px dashed #2563EB"
                : "2px dashed var(--card-border)",
              background: dragging ? "var(--accent-blue-bg)" : "var(--input-bg)",
            }}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--accent-blue-bg)",
                    border: "1px solid var(--accent-blue-border)",
                  }}
                >
                  <ScanIcon className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text-main)" }}
                  >
                    {file.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--card-bg)] transition-colors shrink-0"
                  style={{ color: "var(--text-muted)" }}
                  title="Remove"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--accent-blue-bg)",
                    border: "1px solid var(--accent-blue-border)",
                  }}
                >
                  <UploadIcon className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                  Drop a contract here, or click to choose
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  PDF, image (JPG/PNG/WEBP), or .txt — up to 4MB
                </p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {error && (
            <p className="text-sm font-semibold" style={{ color: "#f43f5e" }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={analyze}
              disabled={!file || analyzing}
              className="px-6 py-3 rounded-full text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              {analyzing ? "Reading the contract…" : "Analyze contract"}
            </button>
            {analyzing && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                This can take up to a minute for longer documents.
              </span>
            )}
          </div>
        </GlassCard>
      )}

      {/* ─── Results ─── */}
      {analysis && (
        <div className="space-y-5">
          {/* Verdict banner */}
          <GlassCard
            className="space-y-2"
            style={{ borderColor: (VERDICT_STYLE[analysis.verdict] ?? VERDICT_STYLE.yellow).ring }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {(VERDICT_STYLE[analysis.verdict] ?? VERDICT_STYLE.yellow).emoji}
                </span>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                    {analysis.verdictLabel}
                  </h2>
                  {analysis.documentType && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {analysis.documentType}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--input-bg)]"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
              >
                Analyze another
              </button>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {analysis.verdictReason}
            </p>
          </GlassCard>

          {/* Summary */}
          {analysis.summary && (
            <GlassCard className="space-y-2">
              <p className="section-header">Summary</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-main)" }}>
                {analysis.summary}
              </p>
            </GlassCard>
          )}

          {/* Key terms */}
          {analysis.keyTerms?.length > 0 && (
            <GlassCard className="space-y-3">
              <p className="section-header">Key Terms</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {analysis.keyTerms.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.15em] mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t.label}
                    </p>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {t.value}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Red flags */}
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-header">Red Flags</p>
              {analysis.redFlags?.length > 0 && (
                <span className="badge badge-rose">{analysis.redFlags.length}</span>
              )}
            </div>
            {analysis.redFlags?.length > 0 ? (
              <div className="space-y-2.5">
                {analysis.redFlags.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={SEVERITY_STYLE[f.severity]?.badge || "badge badge-gray"}>
                        {SEVERITY_STYLE[f.severity]?.label || f.severity}
                      </span>
                      <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                        {f.title}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {f.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No red flags found.
              </p>
            )}
          </GlassCard>

          {/* Plain-English breakdown */}
          {analysis.bulletPoints?.length > 0 && (
            <GlassCard className="space-y-3">
              <p className="section-header">In Plain English</p>
              <ul className="space-y-2">
                {analysis.bulletPoints.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm" style={{ color: "var(--text-main)" }}>
                    <span className="text-blue-500 shrink-0">•</span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {/* Favorable + recommendations */}
          <div className="grid md:grid-cols-2 gap-5">
            {analysis.favorable?.length > 0 && (
              <GlassCard className="space-y-3">
                <p className="section-header">In Your Favor</p>
                <ul className="space-y-2">
                  {analysis.favorable.map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-sm" style={{ color: "var(--text-main)" }}>
                      <span className="text-emerald-500 shrink-0">✓</span>
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
            {analysis.recommendations?.length > 0 && (
              <GlassCard className="space-y-3">
                <p className="section-header">Before You Sign</p>
                <ul className="space-y-2">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-sm" style={{ color: "var(--text-main)" }}>
                      <span className="text-blue-500 shrink-0">→</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
          </div>

          <p
            className="text-[11px] leading-relaxed px-1"
            style={{ color: "var(--text-muted)" }}
          >
            Analyzed: {analyzedName}. This is AI assistance, not legal advice —
            have an attorney review anything you&apos;re unsure about before
            signing.
          </p>
        </div>
      )}
    </div>
  );
}
