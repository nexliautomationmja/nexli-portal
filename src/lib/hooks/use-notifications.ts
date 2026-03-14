"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL = 30_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newNotifications, setNewNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const lastPollRef = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lastPollRef.current) {
        params.set("since", lastPollRef.current);
      }

      const res = await fetch(`/api/dashboard/notifications?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);

      if (data.newNotifications?.length > 0 && lastPollRef.current) {
        setNewNotifications((prev) =>
          [...data.newNotifications, ...prev].slice(0, 5)
        );
      }

      lastPollRef.current = new Date().toISOString();
    } catch {
      // Silent fail — next poll will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await fetch("/api/dashboard/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    await fetch("/api/dashboard/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
  }, []);

  const clearNewNotifications = useCallback(() => {
    setNewNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    newNotifications,
    loading,
    markAsRead,
    markAllAsRead,
    clearNewNotifications,
  };
}
