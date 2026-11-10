// Calendar page: types and pure helpers (client-safe). Dates are the browser's
// local time, as the page always used.

import type { Tone } from "@/components/rainmaker";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title?: string;
  status?: string;
  /** Some GHL responses name it this way. */
  appointmentStatus?: string;
  contactId: string;
  startTime: string;
  endTime: string;
}

/** GET /api/dashboard/ghl/calendar. `connected` / `error` are newer: older deploys don't send them. */
export interface CalendarResponse {
  events?: CalendarEvent[];
  connected?: boolean;
  error?: string;
}

export type CalendarState = "loading" | "ready" | "error" | "disconnected";
export type CalendarMode = "month" | "agenda";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The month's request window — exactly what the page has always sent. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export const calendarUrl = (year: number, month: number) =>
  `/api/dashboard/ghl/calendar?${new URLSearchParams(monthRange(year, month))}`;

/** Day numbers for the month grid, padded with nulls to whole weeks (Sunday first). */
export function monthCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const startMs = (e: CalendarEvent) => new Date(e.startTime).getTime();

/** This month's events by day of the month, each day in start-time order. */
export function eventsByDay(events: CalendarEvent[], year: number, month: number): Map<number, CalendarEvent[]> {
  const out = new Map<number, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => startMs(a) - startMs(b))) {
    const d = new Date(e.startTime);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const list = out.get(d.getDate()) ?? [];
    list.push(e);
    out.set(d.getDate(), list);
  }
  return out;
}

const statusKey = (e: CalendarEvent) => (e.status ?? e.appointmentStatus ?? "").toLowerCase().replace(/[\s_-]/g, "");

export const isCancelled = (e: CalendarEvent) => statusKey(e) === "cancelled" || statusKey(e) === "canceled";

/** Status in words and a hue (cancelled red, confirmed/showed green, no-show amber, the rest blue). */
export function statusView(e: CalendarEvent): { tone: Tone; label: string } {
  const k = statusKey(e);
  if (k === "cancelled" || k === "canceled") return { tone: "red", label: "Cancelled" };
  if (k === "confirmed") return { tone: "green", label: "Confirmed" };
  if (k === "showed") return { tone: "green", label: "Showed" };
  if (k === "noshow") return { tone: "amber", label: "No-show" };
  const raw = e.status ?? e.appointmentStatus ?? "";
  return { tone: "blue", label: raw ? raw[0].toUpperCase() + raw.slice(1) : "Booked" };
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** "Tue, Nov 11" */
export const dayLabel = (year: number, month: number, day: number) =>
  new Date(year, month, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** Up to `n` events still ahead of `now` and not cancelled, soonest first. */
export function upcoming(events: CalendarEvent[], now: number, n = 5): CalendarEvent[] {
  return events
    .filter((e) => startMs(e) >= now && !isCancelled(e))
    .sort((a, b) => startMs(a) - startMs(b))
    .slice(0, n);
}

/** The page state from one response. */
export function stateOf(data: CalendarResponse | null, failed: boolean): CalendarState {
  if (failed) return "error";
  if (!data) return "loading";
  if (data.connected === false) return "disconnected";
  if (data.error) return "error";
  return "ready";
}
