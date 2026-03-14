"use client";

import { useState, useRef, useEffect } from "react";
import { useNotificationContext } from "./notification-provider";
import { cn } from "@/lib/utils";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const TYPE_ICONS: Record<string, string> = {
  invoice_paid: "\u{1F4B0}",
  document_uploaded: "\u{1F4C4}",
  engagement_signed: "\u270D\uFE0F",
  esign_completed: "\u2705",
  new_lead: "\u{1F514}",
  portal_login: "\u{1F511}",
  document_viewed: "\u{1F441}",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationBellProps {
  collapsed: boolean;
}

export function NotificationBell({ collapsed }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationContext();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--input-bg)]",
          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
        )}
        style={{ color: "var(--text-muted)" }}
        title={collapsed ? `Notifications (${unreadCount})` : undefined}
      >
        <div className="relative shrink-0">
          <BellIcon className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #EF4444, #DC2626)",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && <span>Notifications</span>}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute z-[100] glass-card overflow-hidden",
            collapsed
              ? "left-full top-0 ml-2 w-[360px]"
              : "left-0 bottom-full mb-2 w-full min-w-[320px]"
          )}
          style={{ maxHeight: "480px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const icon = TYPE_ICONS[notif.type] || "\u{1F4CC}";
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) markAsRead(notif.id);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--input-bg)] border-b border-[var(--card-border)]",
                      !notif.read && "bg-blue-500/5"
                    )}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-main)" }}
                      >
                        {notif.title}
                      </p>
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {notif.message}
                      </p>
                      <p
                        className="text-[10px] mt-1"
                        style={{
                          color: "var(--text-muted)",
                          opacity: 0.7,
                        }}
                      >
                        {formatTimeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.read && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0 mt-2"
                        style={{ background: "#2563EB" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
