// Pipeline page: types and pure helpers (client-safe).

import { DRS_PRICING, PIPELINE } from "@/lib/drs-pricing";
import type { Tone } from "@/components/rainmaker";

export type Stage = "open" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  source: "manual" | "booked_call";
  stage: Stage;
  valueCents: number;
  ghlContactId: string | null;
  bookedAt: string | null;
  createdAt: string;
}

export interface Kpis {
  openCount: number;
  openValueCents: number;
  wonCount: number;
  wonValueCents: number;
  lostCount: number;
}

/** GET /api/dashboard/pipeline */
export interface PipelineResponse {
  leads?: Lead[];
  kpis?: Kpis;
  ghlLocationId?: string | null;
}

export interface ContactResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface LeadForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  value: string;
  notes: string;
}

export const STAGES: { key: Stage; label: string; tone: Tone }[] = [
  { key: "open", label: "Open", tone: "blue" },
  { key: "won", label: "Won", tone: "green" },
  { key: "lost", label: "Lost", tone: "neutral" },
];

export const EMPTY_KPIS: Kpis = { openCount: 0, openValueCents: 0, wonCount: 0, wonValueCents: 0, lostCount: 0 };

export const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export const contactName = (c: ContactResult) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unnamed contact";

export const shortDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

/** "$32,000 setup + 8 × $4,997/mo ≈ $71,976" — what an open lead counts for until it's edited. */
export const DEFAULT_VALUE_TEXT = `${money(DRS_PRICING.SETUP_FEE_CENTS)} setup + ${PIPELINE.EXPECTED_LIFETIME_MONTHS} × ${money(
  DRS_PRICING.MONTHLY_CENTS
)}/mo ≈ ${money(PIPELINE.DEFAULT_DEAL_VALUE_CENTS)}`;

export const emptyForm = (): LeadForm => ({
  name: "",
  email: "",
  phone: "",
  company: "",
  value: String(Math.round(PIPELINE.DEFAULT_DEAL_VALUE_CENTS / 100)),
  notes: "",
});

/** Typed dollars → cents, or null when it isn't a number ≥ 0 (the page's long-standing parsing). */
export function parseDollars(v: string): number | null {
  const dollars = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
}

/** The add-lead request body — exactly what the page has always sent. */
export function addLeadBody(form: LeadForm, valueCents: number, pickedId: string | null) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    company: form.company,
    notes: form.notes,
    valueCents,
    ghlContactId: pickedId || undefined,
  };
}

export const contactSearchUrl = (search: string) => {
  const params = new URLSearchParams({ limit: "8" });
  if (search) params.set("search", search);
  return `/api/dashboard/ghl/contacts?${params}`;
};

export const ghlContactUrl = (locationId: string, contactId: string) =>
  `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
