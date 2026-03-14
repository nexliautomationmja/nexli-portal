"use client";

import { useState, useEffect, useRef } from "react";

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

interface ClientPickerProps {
  onSelect: (contact: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  }) => void;
  placeholder?: string;
}

export function ClientPicker({
  onSelect,
  placeholder = "Search existing clients...",
}: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasGHL, setHasGHL] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch contacts on initial focus (no search) and on search
  function fetchContacts(search: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", "10");

    fetch(`/api/dashboard/ghl/contacts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.contacts?.length === 0 && !search) {
          setHasGHL(false);
        }
        setContacts(data.contacts || []);
      })
      .catch(() => {
        setContacts([]);
        setHasGHL(false);
      })
      .finally(() => setLoading(false));
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchContacts(value), 300);
  }

  function handleFocus() {
    setOpen(true);
    if (contacts.length === 0 && hasGHL) {
      fetchContacts(query);
    }
  }

  function handleSelect(contact: Contact) {
    const name = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ");
    onSelect({
      name,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.companyName || "",
    });
    setQuery("");
    setOpen(false);
  }

  if (!hasGHL) return null;

  return (
    <div ref={wrapperRef} className="relative mb-2">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: "var(--text-muted)" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--card-border)",
            color: "var(--text-main)",
          }}
        />
      </div>

      {open && (contacts.length > 0 || loading) && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden shadow-lg z-50"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          {loading ? (
            <div
              className="px-4 py-3 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Searching contacts...
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {contacts.map((c) => {
                const name = [c.firstName, c.lastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-500/10 transition-colors flex items-center gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #2563EB, #06B6D4)",
                        color: "#fff",
                      }}
                    >
                      {(c.firstName?.[0] || c.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-main)" }}
                      >
                        {name || "No Name"}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.email || "No email"}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
