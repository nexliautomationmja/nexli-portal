"use client";

import { useState, useEffect } from "react";
import { SearchIcon, UsersIcon, XIcon } from "@/components/ui/icons";

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateAdded: string;
  source?: string;
}

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    fetch(`/api/dashboard/ghl/contacts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setContacts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [search]);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Contacts
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {total > 0 ? `${total} contacts from GoHighLevel` : "Manage your CRM contacts"}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full pl-11 pr-4 py-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none focus:border-blue-500 transition-colors"
          style={{ color: "var(--text-main)" }}
        />
      </div>

      {/* Contact List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading contacts from GHL...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state py-16">
            <UsersIcon className="empty-state-icon" />
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>No contacts found</p>
            <p className="text-xs mt-1">
              {search
                ? "Try a different search term."
                : "Connect your GHL Location ID in Settings to sync contacts."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hidden md:table-cell">Email</th>
                  <th className="hidden md:table-cell">Phone</th>
                  <th>Source</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td>
                      <p className="font-medium">
                        {contact.firstName || ""} {contact.lastName || ""}
                      </p>
                    </td>
                    <td className="hidden md:table-cell">
                      <span style={{ color: "var(--text-muted)" }}>
                        {contact.email || "—"}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      <span style={{ color: "var(--text-muted)" }}>
                        {contact.phone || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {contact.source || "Direct"}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(contact.dateAdded)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contact Detail Panel */}
      {selectedContact && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setSelectedContact(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 glass-card border-l border-[var(--glass-border)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                    {selectedContact.firstName} {selectedContact.lastName}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Added {new Date(selectedContact.dateAdded).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => setSelectedContact(null)} className="p-2 rounded-lg hover:bg-[var(--input-bg)] transition-colors">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="section-divider" />

              <div className="space-y-5">
                {selectedContact.email && (
                  <div>
                    <p className="section-header">Email</p>
                    <p className="text-sm" style={{ color: "var(--text-main)" }}>{selectedContact.email}</p>
                  </div>
                )}
                {selectedContact.phone && (
                  <div>
                    <p className="section-header">Phone</p>
                    <p className="text-sm" style={{ color: "var(--text-main)" }}>{selectedContact.phone}</p>
                  </div>
                )}
                <div>
                  <p className="section-header">Source</p>
                  <p className="text-sm" style={{ color: "var(--text-main)" }}>{selectedContact.source || "Direct"}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
