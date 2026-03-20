"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FormIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Organizer {
  id: string;
  taxYear: string;
  returnType: string;
  status: string;
  sentAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  totalSections: number;
  completedSections: number;
}

const returnTypeLabels: Record<string, string> = {
  "1040": "Individual (1040)",
  "1120": "C Corporation (1120)",
  "1120S": "S Corporation (1120-S)",
  "1065": "Partnership (1065)",
  "1041": "Estate / Trust (1041)",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  sent: { label: "Not Started", color: "badge-blue" },
  in_progress: { label: "In Progress", color: "badge-amber" },
  completed: { label: "Completed", color: "badge-green" },
  reviewed: { label: "Reviewed", color: "badge-gray" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalTaxOrganizerClient() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/tax-organizer");
        if (res.ok) {
          const data = await res.json();
          setOrganizers(data.organizers);
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
          <p className="text-sm">Loading tax organizers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Tax Organizer
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Complete your tax organizer questionnaire so your CPA knows exactly which documents to request.
        </p>
      </div>

      {organizers.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ color: "var(--text-muted)" }}>
            <FormIcon className="w-10 h-10 mx-auto mb-3" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No tax organizers
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            When your CPA sends you a tax organizer, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {organizers.map((org) => {
            const status = statusConfig[org.status] || statusConfig.sent;
            const progress = org.totalSections > 0
              ? Math.round((org.completedSections / org.totalSections) * 100)
              : 0;
            const isExpired = org.expiresAt && new Date(org.expiresAt) < new Date();
            const canContinue = org.status === "sent" || org.status === "in_progress";

            return (
              <div key={org.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("badge", status.color)}>
                        {status.label}
                      </span>
                      <span className="badge badge-blue">
                        {returnTypeLabels[org.returnType] || org.returnType}
                      </span>
                      <span className="badge badge-gray">{org.taxYear}</span>
                      {isExpired && !["completed", "reviewed"].includes(org.status) && (
                        <span className="badge bg-red-500/20 text-red-400">Expired</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: "var(--text-muted)" }}>
                          {org.completedSections} of {org.totalSections} sections completed
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--input-bg)]">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {org.sentAt && <span>Sent: {formatDate(org.sentAt)}</span>}
                      {org.expiresAt && (
                        <span className={isExpired ? "text-red-400" : ""}>
                          {isExpired ? "Expired" : "Expires"}: {formatDate(org.expiresAt)}
                        </span>
                      )}
                      {org.completedAt && (
                        <span className="text-emerald-400">
                          Completed: {formatDate(org.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {canContinue && !isExpired ? (
                      <Link
                        href={`/portal/dashboard/tax-organizer/${org.id}`}
                        className="btn-primary text-sm px-4 py-2 no-underline"
                      >
                        {org.status === "sent" ? "Start" : "Continue"}
                      </Link>
                    ) : org.status === "completed" || org.status === "reviewed" ? (
                      <Link
                        href={`/portal/dashboard/tax-organizer/${org.id}`}
                        className="btn-secondary text-sm px-4 py-2 no-underline"
                      >
                        View
                      </Link>
                    ) : null}
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
