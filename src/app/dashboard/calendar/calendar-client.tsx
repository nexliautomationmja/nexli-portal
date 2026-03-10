"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarIcon } from "@/components/ui/icons";

interface CalendarEvent {
  id: string;
  calendarId: string;
  title?: string;
  status: string;
  contactId: string;
  startTime: string;
  endTime: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarClient() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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

    fetch(`/api/dashboard/ghl/calendar?${params}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-main)" }}>
          Calendar
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          View appointments and events from GoHighLevel
        </p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-sm font-bold hover:border-blue-500/30 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          Previous
        </button>
        <h2 className="text-lg font-black" style={{ color: "var(--text-main)" }}>
          {monthName}
        </h2>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-sm font-bold hover:border-blue-500/30 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          Next
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--text-muted)" }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading calendar...
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--glass-border)]">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center py-2 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
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
                    className={`min-h-[80px] md:min-h-[100px] p-1.5 border-b border-r border-[var(--glass-border)] ${
                      day ? "hover:bg-blue-500/5" : "opacity-30"
                    }`}
                  >
                    {day && (
                      <>
                        <span
                          className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
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
                              className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                                evt.status === "cancelled"
                                  ? "bg-red-500/10 text-red-400 line-through"
                                  : evt.status === "confirmed"
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-blue-500/10 text-blue-400"
                              }`}
                            >
                              {new Date(evt.startTime).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              {evt.title || "Event"}
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

      {/* Upcoming Events list */}
      {events.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            Upcoming Events
          </h3>
          <div className="space-y-2">
            {events
              .filter((e) => new Date(e.startTime) >= new Date() && e.status !== "cancelled")
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .slice(0, 5)
              .map((evt) => (
                <div key={evt.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-blue-500/5 transition-colors">
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ color: "var(--text-main)" }}>
                      {new Date(evt.startTime).getDate()}
                    </p>
                    <p className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                      {new Date(evt.startTime).toLocaleString("default", { month: "short" })}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {evt.title || "Appointment"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(evt.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {" — "}
                      {new Date(evt.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    evt.status === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {evt.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
