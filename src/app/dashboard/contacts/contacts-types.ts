// Contacts page: types and pure helpers (client-safe).

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  dateAdded: string;
  source?: string;
  tags?: string[];
}

/** GET /api/dashboard/ghl/contacts. `connected` / `error` are newer: older deploys don't send them. */
export interface ContactsResponse {
  contacts?: Contact[];
  total?: number;
  connected?: boolean;
  error?: string;
  locationId?: string;
}

export type ContactsState = "loading" | "ready" | "error" | "disconnected";

/** How many contacts one request brings back (the route's default). */
export const PAGE_SIZE = 50;

export const contactName = (c: Contact) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || c.phone || "No name";

export const initials = (c: Contact) => {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  const parts = (name || c.email || "?").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

export const contactsUrl = (search: string) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  return `/api/dashboard/ghl/contacts?${params}`;
};

/** Where this contact lives in GoHighLevel (the same link the Pipeline uses). */
export const ghlContactUrl = (locationId: string, contactId: string) =>
  `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;

/** The page state from one response. */
export function stateOf(data: ContactsResponse | null, failed: boolean): ContactsState {
  if (failed) return "error";
  if (!data) return "loading";
  if (data.connected === false) return "disconnected";
  if (data.error) return "error";
  return "ready";
}
