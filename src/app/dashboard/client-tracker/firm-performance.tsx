"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ButtonLink, Chip, Inset, NUM_FONT, Section, Surface } from "@/components/rainmaker";
import type { FirmStatementView } from "@/lib/performance/view-types";
import { HOW_LABEL, day, mathRows, paymentsText, trail, usd } from "./performance-format";

/**
 * A client firm's own Performance Pay statements (Nov 19 2026 pricing): each
 * month Nexli has sent or closed, with the client-by-client list behind the
 * number — who paid, and how each one first came in through the ads. The
 * emailed invoice only carries the totals; the names stay here, behind the
 * firm's login. Renders nothing for firms with no statements.
 */
export function FirmPerformanceSection() {
  const [statements, setStatements] = useState<FirmStatementView[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/dashboard/performance")
      .then((r) => (r.ok ? r.json() : { statements: [] }))
      .then((d: { statements?: FirmStatementView[] }) => {
        if (!alive) return;
        const list = d.statements ?? [];
        setStatements(list);
        setOpen(list[0]?.monthIndex ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (statements.length === 0) return null;

  return (
    <Section
      id="performance"
      eyebrow="Performance pay"
      title="Your statements"
      sub="What you collected each month from clients the ads brought in, less ad spend, and how the performance pay was worked out. Tell us within 10 days if a line looks wrong."
    >
      <Surface className="overflow-hidden">
        <div className="divide-y divide-white/5">
          {statements.map((s) => {
            const isOpen = open === s.monthIndex;
            const paid = s.invoice?.status === "paid";
            return (
              <div key={s.monthIndex}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : s.monthIndex)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {usd(s.totals.collectedCents)} collected · {usd(s.totals.adSpendCents)} ad spend · {usd(s.totals.netCents)} net
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-white" style={NUM_FONT}>
                    {usd(s.totals.dueCents)}
                  </span>
                  <Chip size="xs" tone={s.status === "none_due" ? "neutral" : paid ? "green" : "amber"} dot className="shrink-0">
                    {s.status === "none_due" ? "Nothing due" : paid ? "Paid" : "Invoice sent"}
                  </Chip>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-white/5 bg-black/20 px-4 py-4">
                    <Inset className="divide-y divide-white/5">
                      {mathRows(s.totals).map((r) => (
                        <div key={r.label} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
                          <span className={`text-sm ${r.strong ? "font-bold text-white" : "text-neutral-300"}`}>{r.label}</span>
                          <span className={`shrink-0 text-sm ${r.strong ? "font-extrabold text-white" : "font-semibold text-neutral-200"}`} style={NUM_FONT}>
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </Inset>
                    {(s.lines.length > 0 || s.extras.length > 0) && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Who paid</p>
                        <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                          {s.lines.map((l) => (
                            <div key={l.email} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">
                                  {l.name}
                                  {l.company ? <span className="font-normal text-neutral-400"> · {l.company}</span> : null}
                                </p>
                                <p className="text-xs leading-relaxed text-neutral-300">{trail(l.lead)}</p>
                                <p className="text-[11px] text-neutral-500">
                                  {HOW_LABEL[l.how]} · {paymentsText(l)}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-white" style={NUM_FONT}>
                                {usd(l.amountCents)}
                              </span>
                            </div>
                          ))}
                          {s.extras.map((e) => (
                            <div key={e.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">{e.name}</p>
                                <p className="text-[11px] text-neutral-400">{[e.at ? day(e.at) : null, e.note].filter(Boolean).join(" · ") || "Paid outside the portal"}</p>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-white" style={NUM_FONT}>
                                {usd(e.amountCents)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.invoice?.token && !paid && (
                      <ButtonLink href={`/invoice/${s.invoice.token}`} variant="primary" size="sm" external>
                        Pay invoice {s.invoice.number}
                      </ButtonLink>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Surface>
    </Section>
  );
}
