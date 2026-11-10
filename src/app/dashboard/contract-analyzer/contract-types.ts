// Contract Analyzer: types and pure helpers (client-safe). The analysis keys
// are the ones the route's prompt asks Claude for.

import type { FeatureTone, Tone } from "@/components/rainmaker";

export interface KeyTerm {
  label: string;
  value: string;
}

export interface RedFlag {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface Analysis {
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

/** The picker's filter — what the route accepts (no image/*: GIF/HEIC would be refused). */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain";

const MAX_SIZE = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The route's own rules, checked before uploading (null = fine). */
export function checkFile(f: { name: string; size: number; type: string }): string | null {
  if (!f.size) return "That file is empty. Choose the contract again.";
  if (f.size > MAX_SIZE) return "File is over 4MB. Please upload a smaller PDF, image, or text file.";
  const ok = f.type === "application/pdf" || IMAGE_TYPES.has(f.type) || f.type === "text/plain" || f.name.toLowerCase().endsWith(".txt");
  return ok ? null : "Unsupported file type. Upload a PDF, an image (JPG/PNG/WEBP), or a .txt file.";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const VERDICT: Record<Analysis["verdict"], { tone: FeatureTone; chip: Tone; label: string }> = {
  green: { tone: "emerald", chip: "green", label: "Looks safe to sign" },
  yellow: { tone: "amber", chip: "amber", label: "Sign with care" },
  red: { tone: "rose", chip: "red", label: "Don't sign as is" },
};

export const SEVERITY: Record<RedFlag["severity"], { tone: Tone; label: string; rank: number }> = {
  high: { tone: "red", label: "High", rank: 0 },
  medium: { tone: "amber", label: "Medium", rank: 1 },
  low: { tone: "neutral", label: "Low", rank: 2 },
};

/** Every list present (older or partial answers may leave some out), red flags worst first. */
export function normalize(a: Analysis): Analysis {
  const flags = [...(a.redFlags ?? [])].sort((x, y) => (SEVERITY[x.severity]?.rank ?? 3) - (SEVERITY[y.severity]?.rank ?? 3));
  return {
    ...a,
    verdict: VERDICT[a.verdict] ? a.verdict : "yellow",
    bulletPoints: a.bulletPoints ?? [],
    keyTerms: a.keyTerms ?? [],
    redFlags: flags,
    favorable: a.favorable ?? [],
    recommendations: a.recommendations ?? [],
  };
}
