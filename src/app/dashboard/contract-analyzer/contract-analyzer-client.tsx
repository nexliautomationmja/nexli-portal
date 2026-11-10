"use client";

import { useState } from "react";
import { ContractAnalyzerView } from "./contract-analyzer-view";
import { checkFile, normalize, type Analysis } from "./contract-types";

/** Upload a contract, get Claude's read on it; ContractAnalyzerView draws the page. */
export function ContractAnalyzerClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzedName, setAnalyzedName] = useState("");

  function pickFile(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setStartedAt(Date.now());
    setError(null);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/dashboard/contract-analyzer", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.analysis) {
        setError(body.error || "Analysis failed. Please try again.");
        return;
      }
      setAnalysis(normalize(body.analysis as Analysis));
      setAnalyzedName(body.fileName || file.name);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    <ContractAnalyzerView
      file={file}
      dragging={dragging}
      analyzing={analyzing}
      startedAt={startedAt}
      error={error}
      analysis={analysis}
      analyzedName={analyzedName}
      onPickFile={pickFile}
      onClearFile={() => setFile(null)}
      onDragging={setDragging}
      onAnalyze={analyze}
      onReset={reset}
    />
  );
}
