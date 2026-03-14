"use client";

import { useState, useEffect } from "react";
import { KanbanIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface TaxReturn {
  id: string;
  clientName: string;
  clientCompany: string | null;
  taxYear: string;
  returnType: string;
  status: string;
  dueDate: string | null;
  filedDate: string | null;
  acceptedDate: string | null;
  notes: string | null;
  createdAt: string;
}

const STAGES = [
  { key: "not_started", label: "Not Started" },
  { key: "documents_received", label: "Docs Received" },
  { key: "in_progress", label: "In Progress" },
  { key: "filed", label: "Filed" },
  { key: "accepted", label: "Accepted" },
];

const stageColors: Record<string, string> = {
  not_started: "bg-gray-500",
  documents_received: "bg-blue-500",
  in_progress: "bg-amber-500",
  filed: "bg-purple-500",
  accepted: "bg-emerald-500",
};

const returnTypeLabels: Record<string, string> = {
  "1040": "Form 1040",
  "1120": "Form 1120",
  "1120S": "Form 1120-S",
  "1065": "Form 1065",
  "990": "Form 990",
  other: "Other",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProgressStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGES.map((stage, i) => {
        const isComplete = i <= currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={stage.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  isComplete
                    ? stageColors[currentStatus]
                    : "bg-[var(--input-bg)]"
                )}
              />
              <span
                className={cn(
                  "text-[9px] mt-1 text-center leading-tight",
                  isCurrent ? "font-bold" : "font-normal"
                )}
                style={{
                  color: isComplete
                    ? "var(--text-main)"
                    : "var(--text-muted)",
                }}
              >
                {stage.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PortalTaxReturnsClient() {
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/tax-returns");
        if (res.ok) {
          const data = await res.json();
          setTaxReturns(data.taxReturns);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading tax returns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Tax Returns
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Track the status of your tax returns.
        </p>
      </div>

      {taxReturns.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <KanbanIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No tax returns
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Your tax return status will appear here when filed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {taxReturns.map((tr) => {
            const isOverdue =
              tr.dueDate &&
              new Date(tr.dueDate) < new Date() &&
              !["filed", "accepted"].includes(tr.status);

            return (
              <div key={tr.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-blue">
                        {returnTypeLabels[tr.returnType] || tr.returnType}
                      </span>
                      <span className="badge badge-gray">{tr.taxYear}</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {tr.clientName}
                      {tr.clientCompany && (
                        <span style={{ color: "var(--text-muted)" }}>
                          {" "}
                          — {tr.clientCompany}
                        </span>
                      )}
                    </p>

                    {/* Progress stepper */}
                    <ProgressStepper currentStatus={tr.status} />

                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {tr.dueDate && (
                        <span className={isOverdue ? "text-red-400 font-medium" : ""}>
                          Due: {formatDate(tr.dueDate)}
                          {isOverdue && " (overdue)"}
                        </span>
                      )}
                      {tr.filedDate && (
                        <span className="text-purple-400">
                          Filed: {formatDate(tr.filedDate)}
                        </span>
                      )}
                      {tr.acceptedDate && (
                        <span className="text-emerald-400">
                          Accepted: {formatDate(tr.acceptedDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
