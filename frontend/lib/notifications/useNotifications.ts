"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEMO_NOTIFICATIONS,
  NutriNotification,
  NotificationCategory,
  NotificationStatus,
  PRIORITY_WEIGHT,
} from "./notification.types";

// ─── State Shape ──────────────────────────────────────────────────────────────

interface NotificationState {
  items: NutriNotification[];
}

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseNotificationsReturn {
  /** All non-dismissed notifications, sorted by priority → date */
  notifications: NutriNotification[];
  /** Unread count (badge number) */
  unreadCount: number;
  /** Mark a single notification as read */
  markAsRead: (id: string) => void;
  /** Mark all unread as read */
  markAllAsRead: () => void;
  /** Soft-delete (dismiss) a notification */
  dismiss: (id: string) => void;
  /** Dismiss all */
  dismissAll: () => void;
  /** Filter by category — undefined = show all */
  filterByCategory: (category: NotificationCategory | undefined) => void;
  /** Currently active category filter */
  activeCategory: NotificationCategory | undefined;
  /** Add a new notification programmatically (e.g. from push or polling) */
  push: (notification: Omit<NutriNotification, "id" | "createdAt" | "status">) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(
  seed: NutriNotification[] = DEMO_NOTIFICATIONS
): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({ items: seed });
  const [activeCategory, setActiveCategory] = useState<
    NotificationCategory | undefined
  >(undefined);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const notifications = useMemo(() => {
    const visible = state.items.filter((n) => {
      if (n.status === "dismissed") return false;
      if (activeCategory && n.category !== activeCategory) return false;
      return true;
    });

    return visible.sort((a, b) => {
      // 1. unread before read
      if (a.status !== b.status) {
        return a.status === "unread" ? -1 : 1;
      }
      // 2. higher priority first
      const priorityDiff =
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // 3. newest first
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [state.items, activeCategory]);

  const unreadCount = useMemo(
    () => state.items.filter((n) => n.status === "unread").length,
    [state.items]
  );

  // ── Mutators ─────────────────────────────────────────────────────────────────

  const updateStatus = useCallback(
    (id: string, status: NotificationStatus, extra?: Partial<NutriNotification>) =>
      setState((prev) => ({
        items: prev.items.map((n) =>
          n.id === id ? { ...n, status, ...extra } : n
        ),
      })),
    []
  );

  const markAsRead = useCallback(
    (id: string) =>
      updateStatus(id, "read", { readAt: new Date().toISOString() }),
    [updateStatus]
  );

  const markAllAsRead = useCallback(
    () =>
      setState((prev) => ({
        items: prev.items.map((n) =>
          n.status === "unread"
            ? { ...n, status: "read", readAt: new Date().toISOString() }
            : n
        ),
      })),
    []
  );

  const dismiss = useCallback(
    (id: string) => updateStatus(id, "dismissed"),
    [updateStatus]
  );

  const dismissAll = useCallback(
    () =>
      setState((prev) => ({
        items: prev.items.map((n) => ({ ...n, status: "dismissed" })),
      })),
    []
  );

  const filterByCategory = useCallback(
    (category: NotificationCategory | undefined) =>
      setActiveCategory(category),
    []
  );

  const push = useCallback(
    (notification: Omit<NutriNotification, "id" | "createdAt" | "status">) => {
      const newItem: NutriNotification = {
        ...notification,
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        status: "unread",
      };
      setState((prev) => ({ items: [newItem, ...prev.items] }));
    },
    []
  );

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    filterByCategory,
    activeCategory,
    push,
  };
}
