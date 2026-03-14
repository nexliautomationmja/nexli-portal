"use client";

import { createContext, useContext } from "react";
import {
  useNotifications,
  type Notification,
} from "@/lib/hooks/use-notifications";
import { NotificationToasts } from "./notification-toasts";

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    notifications,
    unreadCount,
    newNotifications,
    markAsRead,
    markAllAsRead,
    clearNewNotifications,
  } = useNotifications();

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead }}
    >
      {children}
      <NotificationToasts
        newNotifications={newNotifications}
        onClear={clearNewNotifications}
      />
    </NotificationContext.Provider>
  );
}
