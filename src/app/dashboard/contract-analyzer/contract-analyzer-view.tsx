"use client";

import { useRef } from "react";
import { ArrowRight, Check, FileText, ScanSearch, Upload, X } from "lucide-react";
import {
  AiWorking,
  Button,
  Chip,
  FeatureCard,
  GradientText,
  Inset,
  List,
  Notice,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  SectionNav,
  Surface,
} from "@/components/rainmaker";
import { ACCEPT, SEVERITY, VERDICT, formatSize, type Analysis } from "./contract-types";

export interface ContractAnalyzerViewProps {
  file: { name: string; size: number } | null;
  dragging: boolean;
  analyzing: boolean;
  /** When the analysis started (for the elapsed clock). */
  startedAt: number | null;
  /** Freezes the clock (fixtures). */
  now?: number;
  error: string | null;
  analysis: Analysis | null;
  analyzedName: string;
  onPickFile: (f: File | undefined) => void;
  onClearFile: () => void;
  onDragging: (on: boolean) => void;
  onAnalyze: () => void;
  onReset: () => void;
}

function Upload_({ p }: { p: ContractAnalyzerViewProps }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Section id="upload" eyebrow="Upload" title="Your contract" sub="PDF, image (JPG, PNG or WEBP) or a .txt file, up to 4MB.">
      <Surface className="space-y-4 p-4 sm:p-5">
        {p.file ? (
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{p.file.name}</div>
              <div className="text-xs text-neutral-400">{formatSize(p.file.size)}</div>
            </div>
            <button
              type="button"
              onClick={p.onClearFile}
              aria-label="Remove this file"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              p.onDragging(true);
            }}
            onDragLeave={() => p.onDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              p.onDragging(false);
              p.onPickFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
              p.dragging ? "border-cyan-400/70 bg-cyan-500/10" : "border-white/15 bg-black/20 hover:border-white/25"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-white">Drop a contract here, or tap to choose</span>
            <span className="text-xs text-neutral-400">PDF, JPG, PNG, WEBP or .txt · up to 4MB</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            p.onPickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {p.error && <Notice tone="error">{p.error}</Notice>}
        <Button onClick={p.onAnalyze} disabled={!p.file}>
          <ScanSearch className="h-4 w-4" aria-hidden="true" /> Analyze contract
        </Button>
      </Surface>
    </Section>
  );
}

function Bullets({ items, icon }: { items: string[]; icon: "check" | "arrow" | "dot" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-neutral-100">
          <span className={`mt-1 shrink-0 ${icon === "check" ? "text-emerald-300" : icon === "arrow" ? "text-cyan-300" : "text-blue-300"}`}>
            {icon === "check" ? <Check className="h-4 w-4" aria-hidden="true" /> : icon === "arrow" ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <span className="block h-1.5 w-1.5 translate-y-1 rounded-full bg-current" />}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Result({ a, name, onReset }: { a: Analysis; name: string; onReset: () => void }) {
  const v = VERDICT[a.verdict];
  const sections = [
    a.summary ? { id: "summary", label: "Summary" } : null,
    a.keyTerms.length ? { id: "key-terms", label: "Key terms" } : null,
    { id: "red-flags", label: `Red flags${a.redFlags.length ? ` (${a.redFlags.length})` : ""}` },
    a.bulletPoints.length ? { id: "plain-english", label: "Plain English" } : null,
    a.favorable.length || a.recommendations.length ? { id: "before-you-sign", label: "Before you sign" } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <>
      <FeatureCard
        tone={v.tone}
        eyebrow={a.documentType || "Verdict"}
        title={a.verdictLabel || v.label}
        right={
          <Button variant="secondary" size="sm" onClick={onReset}>
            Analyze another
          </Button>
        }
        className="rm-enter mb-6"
      >
        <Chip tone={v.chip} dot className="mb-2">
          {v.label}
        </Chip>
        {a.verdictReason && <p className="text-sm leading-relaxed text-neutral-200">{a.verdictReason}</p>}
      </FeatureCard>

      <SectionNav sections={sections} />

      {a.summary && (
        <Section id="summary" eyebrow="Overview" title="Summary">
          <Surface className="p-5">
            <p className="text-sm leading-relaxed text-neutral-100">{a.summary}</p>
          </Surface>
        </Section>
      )}

      {a.keyTerms.length > 0 && (
        <Section id="key-terms" eyebrow="The deal" title="Key terms">
          <div className="grid gap-3 sm:grid-cols-2">
            {a.keyTerms.map((t, i) => (
              <Inset key={i} className="p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t.label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{t.value}</div>
              </Inset>
            ))}
          </div>
        </Section>
      )}

      <Section id="red-flags" eyebrow="Watch out" title="Red flags">
        {a.redFlags.length === 0 ? (
          <Notice tone="success">No red flags found.</Notice>
        ) : (
          <List>
            {a.redFlags.map((f, i) => {
              const s = SEVERITY[f.severity] ?? SEVERITY.low;
              return (
                <div key={i} className="space-y-1.5 px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={s.tone} size="xs" dot>
                      {s.label}
                    </Chip>
                    <span className="text-sm font-bold text-white">{f.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-300">{f.detail}</p>
                </div>
              );
            })}
          </List>
        )}
      </Section>

      {a.bulletPoints.length > 0 && (
        <Section id="plain-english" eyebrow="What it says" title="In plain English">
          <Surface className="p-5">
            <Bullets items={a.bulletPoints} icon="dot" />
          </Surface>
        </Section>
      )}

      {(a.favorable.length > 0 || a.recommendations.length > 0) && (
        <Section id="before-you-sign" eyebrow="Your side" title="In your favor, and before you sign">
          <div className="grid gap-4 md:grid-cols-2">
            {a.favorable.length > 0 && (
              <Surface className="p-5">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300/80">In your favor</p>
                <Bullets items={a.favorable} icon="check" />
              </Surface>
            )}
            {a.recommendations.length > 0 && (
              <Surface className="p-5">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/80">Before you sign</p>
                <Bullets items={a.recommendations} icon="arrow" />
              </Surface>
            )}
          </div>
        </Section>
      )}

      <Notice tone="info">
        Analyzed: {name}. This is AI assistance, not legal advice — have an attorney review anything you&apos;re unsure about before signing.
      </Notice>
    </>
  );
}

export function ContractAnalyzerView(p: ContractAnalyzerViewProps) {
  return (
    <RainmakerCanvas>
      <PageColumn width="form">
        <PageHero
          pill={{ icon: <ScanSearch className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Contract Analyzer" }}
          title={
            <>
              Know what you&apos;re <GradientText>signing.</GradientText>
            </>
          }
          sub="Upload a contract and get a plain-English breakdown, the red flags, and a verdict on whether it's safe to sign."
        />
        {p.analysis ? (
          <Result a={p.analysis} name={p.analyzedName} onReset={p.onReset} />
        ) : p.analyzing && p.file ? (
          <AiWorking
            title="Reading your contract"
            step={`Claude is reading ${p.file.name}`}
            startedAt={p.startedAt ?? 0}
            now={p.now}
            note="Longer documents can take a minute or two. Keep this page open."
          >
            <div className="space-y-2.5" aria-hidden="true">
              {["h-16", "h-24", "h-12"].map((h, i) => (
                <div key={i} className={`cs-sweep rounded-xl border border-white/5 bg-white/[0.03] ${h}`} />
              ))}
            </div>
          </AiWorking>
        ) : (
          <Upload_ p={p} />
        )}
      </PageColumn>
    </RainmakerCanvas>
  );
}
