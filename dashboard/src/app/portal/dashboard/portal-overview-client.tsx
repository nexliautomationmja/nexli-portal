"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  InvoiceIcon,
  FileIcon,
  PenLineIcon,
  KanbanIcon,
} from "@/components/ui/icons";

interface Stats {
  totalOwed: number;
  unpaidCount: number;
  paidCount: number;
  documentCount: number;
  pendingSignatures: number;
  taxReturnsInProgress: number;
  taxReturnsTotal: number;
}

interface ActionItem {
  type: string;
  title: string;
  description: string;
  href?: string;
  date: string;
}

interface ActivityItem {
  type: string;
  title: string;
  status: string;
  date: string;
}

interface OverviewData {
  stats: Stats;
  actionItems: ActionItem[];
  recentActivity: ActivityItem[];
  clientName: string | null;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const typeIcons: Record<string, string> = {
  invoice: "Invoice",
  esign: "E-Sign",
  upload: "Upload",
  engagement: "Engagement",
  document: "Document",
  tax_return: "Tax Return",
};

const typeBadge: Record<string, string> = {
  invoice: "badge badge-blue",
  esign: "badge badge-violet",
  upload: "badge badge-amber",
  engagement: "badge badge-purple",
  document: "badge badge-gray",
  tax_return: "badge badge-emerald",
};

export function PortalOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/overview");
        if (res.ok) {
          const d = await res.json();
          setData(d);
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
          <p className="text-sm">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm">Unable to load portal data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
          Welcome back{data.clientName ? `, ${data.clientName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Here&apos;s an overview of your account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/portal/dashboard/invoices" className="glass-card p-5 no-underline hover:border-blue-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-blue-bg)", border: "1px solid var(--accent-blue-border)" }}>
              <InvoiceIcon className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="stat-value">{formatCents(data.stats.totalOwed)}</p>
          <p className="stat-label">
            Balance Due{data.stats.unpaidCount > 0 ? ` (${data.stats.unpaidCount})` : ""}
          </p>
        </Link>

        <Link href="/portal/dashboard/documents" className="glass-card p-5 no-underline hover:border-cyan-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-cyan-bg)", border: "1px solid var(--accent-cyan-border)" }}>
              <FileIcon className="w-4 h-4 text-cyan-500" />
            </div>
          </div>
          <p className="stat-value">{data.stats.documentCount}</p>
          <p className="stat-label">Documents</p>
        </Link>

        <Link href="/portal/dashboard/documents" className="glass-card p-5 no-underline hover:border-purple-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-purple-bg)", border: "1px solid var(--accent-purple-border)" }}>
              <PenLineIcon className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="stat-value">{data.stats.pendingSignatures}</p>
          <p className="stat-label">Pending Signatures</p>
        </Link>

        <Link href="/portal/dashboard/tax-returns" className="glass-card p-5 no-underline hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-emerald-bg)", border: "1px solid var(--accent-emerald-border)" }}>
              <KanbanIcon className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="stat-value">{data.stats.taxReturnsInProgress}</p>
          <p className="stat-label">
            Tax Returns{data.stats.taxReturnsTotal > 0 ? ` of ${data.stats.taxReturnsTotal}` : ""}
          </p>
        </Link>
      </div>

      {/* Action Items */}
      {data.actionItems.length > 0 && (
        <div>
          <h2 className="section-header mb-4">Action Items</h2>
          <div className="space-y-2">
            {data.actionItems.map((item, i) => (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-4 flex items-center justify-between no-underline hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={typeBadge[item.type] || "badge badge-gray"}>
                    {typeIcons[item.type] || item.type}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {item.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {item.description}
                    </p>
                  </div>
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatDate(item.date)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div>
          <h2 className="section-header mb-4">Recent Activity</h2>
          <div className="glass-card divide-y divide-[var(--card-border)]">
            {data.recentActivity.map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={typeBadge[item.type] || "badge badge-gray"}>
                    {typeIcons[item.type] || item.type}
                  </span>
                  <p className="text-sm" style={{ color: "var(--text-main)" }}>
                    {item.title}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-gray text-xs">{item.status.replace(/_/g, " ")}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(item.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.actionItems.length === 0 && data.recentActivity.length === 0 && (
        <div className="glass-card p-16 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            No activity yet
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Your invoices, documents, and engagements will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
