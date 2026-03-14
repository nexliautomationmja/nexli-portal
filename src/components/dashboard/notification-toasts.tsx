"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/hooks/use-notifications";

interface Toast {
  id: string;
  notification: Notification;
  exiting: boolean;
}

interface NotificationToastsProps {
  newNotifications: Notification[];
  onClear: () => void;
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

export function NotificationToasts({
  newNotifications,
  onClear,
}: NotificationToastsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (newNotifications.length === 0) return;

    const newToasts: Toast[] = newNotifications.map((n) => ({
      id: n.id,
      notification: n,
      exiting: false,
    }));

    setToasts((prev) => [...newToasts, ...prev].slice(0, 3));
    onClear();

    newToasts.forEach((toast) => {
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) =>
            t.id === toast.id ? { ...t, exiting: true } : t
          )
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 300);
      }, 5000);
    });
  }, [newNotifications, onClear]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "glass-card p-4 flex items-start gap-3 transition-all duration-300",
            toast.exiting
              ? "opacity-0 translate-x-full"
              : "opacity-100 translate-x-0 animate-slideInRight"
          )}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <span className="text-xl shrink-0">
            {TYPE_ICONS[toast.notification.type] || "\u{1F4CC}"}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              {toast.notification.title}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {toast.notification.message}
            </p>
          </div>
          <button
            onClick={() => {
              setToasts((prev) =>
                prev.map((t) =>
                  t.id === toast.id ? { ...t, exiting: true } : t
                )
              );
              setTimeout(() => {
                setToasts((prev) =>
                  prev.filter((t) => t.id !== toast.id)
                );
              }, 300);
            }}
            className="shrink-0 text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
