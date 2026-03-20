"use client";

import { useState, useEffect, useMemo } from "react";

interface CalendarEvent {
  id: string;
  title?: string;
  status: string;
  startTime: string;
  endTime: string;
  source?: "ghl" | "google" | "calcom";
  // Legacy GHL fields
  calendarId?: string;
  contactId?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ghl: { bg: "bg-blue-500/10", text: "text-blue-400", label: "GoHighLevel" },
  google: { bg: "bg-red-500/10", text: "text-red-400", label: "Google Calendar" },
  calcom: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Cal.com" },
};

const SOURCE_DOTS: Record<string, string> = {
  ghl: "#3b82f6",
  google: "#ef4444",
  calcom: "#a855f7",
};

export function CalendarClient() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeSources, setActiveSources] = useState<string[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    setLoading(true);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    end.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });

    fetch(`/api/dashboard/calendar?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
        setActiveSources(data.sources || []);
      })
      .catch(() => {
        setEvents([]);
        setActiveSources([]);
      })
      .finally(() => setLoading(false));
  }, [year, month]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    // Pad beginning
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    // Pad end to fill last row
    while (days.length % 7 !== 0) days.push(null);

    return days;
  }, [year, month]);

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.startTime);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  function getEventStyle(evt: CalendarEvent) {
    if (evt.status === "cancelled") {
      return "bg-rose-500/10 text-rose-400 line-through";
    }
    const source = evt.source || "ghl";
    const colors = SOURCE_COLORS[source] || SOURCE_COLORS.ghl;
    return `${colors.bg} ${colors.text}`;
  }

  function getSourceDot(source?: string) {
    const color = SOURCE_DOTS[source || "ghl"] || SOURCE_DOTS.ghl;
    return color;
  }

  // Determine connected sources for legend
  const connectedSources = useMemo(() => {
    const sources = new Set<string>();
    events.forEach((e) => sources.add(e.source || "ghl"));
    return Array.from(sources);
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
          Calendar
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          View appointments and events
          {activeSources.length > 0 && (
            <> from {activeSources.map((s) => SOURCE_COLORS[s]?.label || s).join(", ")}</>
          )}
        </p>
      </div>

      {/* Month navigation + Source legend */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-4 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-semibold hover:border-blue-500/30 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          Previous
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            {monthName}
          </h2>
          {connectedSources.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-1">
              {connectedSources.map((source) => (
                <div key={source} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: SOURCE_DOTS[source] || "#3b82f6" }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {SOURCE_COLORS[source]?.label || source}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="px-4 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-semibold hover:border-blue-500/30 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          Next
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading calendar...</p>
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--glass-border)]">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center py-3 section-header mb-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] md:min-h-[100px] p-2 border-b border-r border-[var(--glass-border)] transition-colors ${
                      day ? "hover:bg-[var(--input-bg)]" : "opacity-30"
                    }`}
                  >
                    {day && (
                      <>
                        <span
                          className={`inline-flex w-7 h-7 items-center justify-center rounded-lg text-xs font-bold ${
                            isToday(day)
                              ? "bg-blue-500 text-white"
                              : ""
                          }`}
                          style={{ color: isToday(day) ? undefined : "var(--text-main)" }}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.slice(0, 3).map((evt) => (
                            <div
                              key={evt.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium flex items-center gap-1 ${getEventStyle(evt)}`}
                            >
                              {connectedSources.length > 1 && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: getSourceDot(evt.source) }}
                                />
                              )}
                              <span className="truncate">
                                {new Date(evt.startTime).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}{" "}
                                {evt.title || "Event"}
                              </span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                              +{dayEvents.length - 3} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* No sources connected message */}
      {!loading && activeSources.length === 0 && events.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No calendar sources connected.{" "}
            <a
              href="/dashboard/settings"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Connect Google Calendar or Cal.com in Settings
            </a>{" "}
            to see your appointments here.
          </p>
        </div>
      )}

      {/* Upcoming Events list */}
      {events.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="section-header mb-4">
            Upcoming Events
          </h3>
          <div className="space-y-1">
            {events
              .filter((e) => new Date(e.startTime) >= new Date() && e.status !== "cancelled")
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .slice(0, 5)
              .map((evt) => (
                <div key={evt.id} className="flex items-center gap-4 py-3 px-3 rounded-lg hover:bg-[var(--input-bg)] transition-colors">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ color: "var(--text-main)" }}>
                      {new Date(evt.startTime).getDate()}
                    </p>
                    <p className="text-[10px] uppercase font-semibold mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(evt.startTime).toLocaleString("default", { month: "short" })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>
                      {evt.title || "Appointment"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(evt.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {" — "}
                      {new Date(evt.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectedSources.length > 1 && evt.source && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: SOURCE_DOTS[evt.source] || "#3b82f6" }}
                        title={SOURCE_COLORS[evt.source]?.label}
                      />
                    )}
                    <span className={`badge ${
                      evt.status === "confirmed" ? "badge-emerald" : "badge-blue"
                    }`}>
                      {evt.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
