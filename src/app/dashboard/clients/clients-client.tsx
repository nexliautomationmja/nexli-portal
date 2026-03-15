"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────

interface ClientRow {
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  engagementCount: number;
  pendingEngagements: number;
  unreadMessages: number;
  hasPortalAccess: boolean;
  lastPortalLogin: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
}

interface ClientDetail {
  client: { name: string; email: string; phone: string | null; company: string | null };
  invoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    dueDate: string;
    paidAt: string | null;
    paymentMethod: string | null;
    createdAt: string;
  }[];
  engagements: {
    id: string;
    subject: string;
    status: string;
    sentAt: string | null;
    signerStatus: string;
    signedAt: string | null;
    createdAt: string;
  }[];
  messages: { unreadCount: number; totalCount: number; lastMessageAt: string | null };
  payments: {
    invoiceNumber: string;
    amount: number;
    paidAt: string | null;
    paymentMethod: string | null;
  }[];
  portalAccess: { lastLogin: string | null; sessionActive: boolean };
}

// ── Helpers ────────────────────────────────────────────

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const invoiceStatusColors: Record<string, string> = {
  draft: "badge-gray",
  sent: "badge-blue",
  viewed: "badge-blue",
  paid: "badge-emerald",
  partial: "badge-amber",
  overdue: "badge-rose",
  canceled: "badge-gray",
  void: "badge-gray",
};

const engagementStatusColors: Record<string, string> = {
  draft: "badge-gray",
  sent: "badge-blue",
  viewed: "badge-blue",
  signed: "badge-emerald",
  declined: "badge-rose",
  expired: "badge-gray",
};

// ── Icons ──────────────────────────────────────────────

function SearchIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M12 6h.01" /><path d="M12 10h.01" />
      <path d="M12 14h.01" /><path d="M16 10h.01" />
      <path d="M16 14h.01" /><path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────

type DetailTab = "invoices" | "engagements" | "messages" | "payments" | "portal";

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("invoices");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedEmail = searchParams.get("client");

  useEffect(() => {
    fetch("/api/dashboard/clients")
      .then((r) => r.json())
      .then((data) => setClients(data.clients || []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEmail) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setActiveTab("invoices");
    fetch(`/api/dashboard/clients/${encodeURIComponent(selectedEmail)}/detail`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedEmail]);

  function selectClient(email: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("client", email);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const filteredClients = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q)
    );
  });

  const selectedClient = clients.find((c) => c.email === selectedEmail) ?? null;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Clients
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your clients and view their activity across invoices, engagements, and messages.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Clients"
          value={loading ? "..." : String(clients.length)}
        />
        <StatCard
          label="Total Invoiced"
          value={loading ? "..." : formatCents(clients.reduce((s, c) => s + c.totalInvoiced, 0))}
        />
        <StatCard
          label="Outstanding"
          value={loading ? "..." : formatCents(clients.reduce((s, c) => s + c.totalOutstanding, 0))}
        />
        <StatCard
          label="Unread Messages"
          value={loading ? "..." : String(clients.reduce((s, c) => s + c.unreadMessages, 0))}
        />
      </div>

      {/* Mobile client selector */}
      <div className="lg:hidden mb-6">
        <select
          value={selectedEmail || ""}
          onChange={(e) => e.target.value && selectClient(e.target.value)}
          className="w-full px-4 py-3 rounded-lg text-sm font-medium border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50"
          style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
        >
          <option value="">Select a client...</option>
          {clients.map((c) => (
            <option key={c.email} value={c.email}>
              {c.company || c.name || c.email}
            </option>
          ))}
        </select>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Client list */}
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
          <GlassCard>
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-xs border border-[var(--glass-border)] focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
              />
            </div>

            <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 no-scrollbar">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "var(--glass-border)" }} />
                ))
              ) : filteredClients.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
                  {search ? "No clients match your search." : "Your clients will appear here as you create invoices and engagements."}
                </p>
              ) : (
                filteredClients.map((client) => (
                  <ClientCard
                    key={client.email}
                    client={client}
                    isSelected={client.email === selectedEmail}
                    onClick={() => selectClient(client.email)}
                  />
                ))
              )}
            </div>
          </GlassCard>
        </aside>

        {/* RIGHT: Detail panel */}
        <main className="lg:col-span-8 xl:col-span-9">
          {selectedClient ? (
            detailLoading ? (
              <GlassCard>
                <div className="py-24 flex justify-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </GlassCard>
            ) : detail ? (
              <ClientDetailPanel detail={detail} activeTab={activeTab} setActiveTab={setActiveTab} />
            ) : (
              <GlassCard>
                <div className="py-24 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Failed to load client details.</p>
                </div>
              </GlassCard>
            )
          ) : (
            <GlassCard>
              <div className="py-24 text-center">
                <div
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(6,182,212,0.1))" }}
                >
                  <SearchIcon className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                  Select a client
                </p>
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  Choose a client from the list to view their full profile.
                </p>
              </div>
            </GlassCard>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Client List Card ───────────────────────────────────

function ClientCard({
  client,
  isSelected,
  onClick,
}: {
  client: ClientRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const displayName = client.company || client.name;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all duration-200",
        isSelected
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-[var(--glass-border)] hover:border-blue-500/20 hover:bg-[var(--input-bg)]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>
              {displayName}
            </h4>
            {client.unreadMessages > 0 && (
              <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white">
                {client.unreadMessages}
              </span>
            )}
          </div>
          {client.company && client.name !== client.company && (
            <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
              {client.name}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatCents(client.totalInvoiced)}
            </span>
            {client.totalOutstanding > 0 && (
              <span className="text-xs text-amber-400">
                {formatCents(client.totalOutstanding)} due
              </span>
            )}
            {client.lastActivityAt && (
              <span className="text-xs ml-auto" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                {timeAgo(client.lastActivityAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Client Detail Panel ────────────────────────────────

function ClientDetailPanel({
  detail,
  activeTab,
  setActiveTab,
}: {
  detail: ClientDetail;
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
}) {
  const { client } = detail;
  const initial = (client.company || client.name).charAt(0).toUpperCase();

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: "invoices", label: "Invoices", count: detail.invoices.length },
    { key: "engagements", label: "Engagements", count: detail.engagements.length },
    { key: "messages", label: "Messages", count: detail.messages.unreadCount || undefined },
    { key: "payments", label: "Payments", count: detail.payments.length },
    { key: "portal", label: "Portal Access" },
  ];

  return (
    <div className="space-y-4">
      {/* Client header */}
      <GlassCard>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>
              {client.company || client.name}
            </h2>
            {client.company && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-main)" }}>
                {client.name}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <MailIcon className="w-3.5 h-3.5" />
                {client.email}
              </span>
              {client.phone && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <PhoneIcon className="w-3.5 h-3.5" />
                  {client.phone}
                </span>
              )}
              {client.company && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <BuildingIcon className="w-3.5 h-3.5" />
                  {client.company}
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Invoiced"
          value={formatCents(detail.invoices.reduce((s, i) => s + i.total, 0))}
        />
        <StatCard
          label="Outstanding"
          value={formatCents(detail.invoices.reduce((s, i) => s + i.balanceDue, 0))}
        />
        <StatCard
          label="Engagements"
          value={String(detail.engagements.length)}
        />
        <StatCard
          label="Messages"
          value={String(detail.messages.totalCount)}
          delta={detail.messages.unreadCount > 0 ? `${detail.messages.unreadCount} unread` : undefined}
          deltaType={detail.messages.unreadCount > 0 ? "positive" : "neutral"}
        />
      </div>

      {/* Tabbed content */}
      <GlassCard>
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[var(--card-border)] mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent hover:border-blue-500/30"
              )}
              style={activeTab !== tab.key ? { color: "var(--text-muted)" } : undefined}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "invoices" && <InvoicesTab invoices={detail.invoices} />}
        {activeTab === "engagements" && <EngagementsTab engagements={detail.engagements} />}
        {activeTab === "messages" && <MessagesTab messages={detail.messages} clientEmail={client.email} />}
        {activeTab === "payments" && <PaymentsTab payments={detail.payments} />}
        {activeTab === "portal" && <PortalTab portalAccess={detail.portalAccess} />}
      </GlassCard>
    </div>
  );
}

// ── Tab Components ─────────────────────────────────────

function InvoicesTab({ invoices }: { invoices: ClientDetail["invoices"] }) {
  if (invoices.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Status</th>
            <th>Total</th>
            <th>Balance Due</th>
            <th>Due Date</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link
                  href={`/dashboard/invoices?id=${inv.id}`}
                  className="text-sm font-medium text-blue-500 hover:underline"
                >
                  {inv.invoiceNumber}
                </Link>
              </td>
              <td>
                <span className={`badge ${invoiceStatusColors[inv.status] || "badge-gray"}`}>
                  {inv.status}
                </span>
              </td>
              <td><span className="text-sm" style={{ color: "var(--text-main)" }}>{formatCents(inv.total)}</span></td>
              <td>
                <span className={`text-sm ${inv.balanceDue > 0 ? "text-amber-400" : ""}`} style={inv.balanceDue === 0 ? { color: "var(--text-muted)" } : undefined}>
                  {formatCents(inv.balanceDue)}
                </span>
              </td>
              <td><span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(inv.dueDate)}</span></td>
              <td><span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(inv.createdAt)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EngagementsTab({ engagements }: { engagements: ClientDetail["engagements"] }) {
  if (engagements.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No engagements yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Status</th>
            <th>Signer Status</th>
            <th>Sent</th>
            <th>Signed</th>
          </tr>
        </thead>
        <tbody>
          {engagements.map((eng) => (
            <tr key={eng.id}>
              <td>
                <Link
                  href={`/dashboard/engagements?id=${eng.id}`}
                  className="text-sm font-medium text-blue-500 hover:underline"
                >
                  {eng.subject}
                </Link>
              </td>
              <td>
                <span className={`badge ${engagementStatusColors[eng.status] || "badge-gray"}`}>
                  {eng.status}
                </span>
              </td>
              <td>
                <span className={`badge ${engagementStatusColors[eng.signerStatus] || "badge-gray"}`}>
                  {eng.signerStatus}
                </span>
              </td>
              <td>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {eng.sentAt ? formatDate(eng.sentAt) : "—"}
                </span>
              </td>
              <td>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {eng.signedAt ? formatDate(eng.signedAt) : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesTab({ messages, clientEmail }: { messages: ClientDetail["messages"]; clientEmail: string }) {
  return (
    <div className="py-8 text-center">
      <div
        className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(6,182,212,0.1))" }}
      >
        <MailIcon className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-main)" }}>
        {messages.totalCount} message{messages.totalCount !== 1 ? "s" : ""}
      </p>
      {messages.unreadCount > 0 && (
        <p className="text-sm text-blue-400 mb-1">
          {messages.unreadCount} unread
        </p>
      )}
      {messages.lastMessageAt && (
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Last message: {timeAgo(messages.lastMessageAt)}
        </p>
      )}
      <Link
        href={`/dashboard/portal-messages?client=${encodeURIComponent(clientEmail)}`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
      >
        Open Conversation
      </Link>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: ClientDetail["payments"] }) {
  if (payments.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No payments received yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((p, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3 px-4 rounded-lg border border-[var(--glass-border)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                {formatCents(p.amount)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Invoice {p.invoiceNumber}
                {p.paymentMethod && ` · ${p.paymentMethod.toUpperCase()}`}
              </p>
            </div>
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {p.paidAt ? formatDate(p.paidAt) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function PortalTab({ portalAccess }: { portalAccess: ClientDetail["portalAccess"] }) {
  return (
    <div className="py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
        <div className="text-center p-4 rounded-lg border border-[var(--glass-border)]">
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Session Status
          </p>
          <span className={`badge ${portalAccess.sessionActive ? "badge-emerald" : "badge-gray"}`}>
            {portalAccess.sessionActive ? "Active" : "No Active Session"}
          </span>
        </div>
        <div className="text-center p-4 rounded-lg border border-[var(--glass-border)]">
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Last Login
          </p>
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
            {portalAccess.lastLogin ? formatDate(portalAccess.lastLogin) : "Never"}
          </p>
        </div>
      </div>
    </div>
  );
}
