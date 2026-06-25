"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NutriNotification,
  NotificationCategory,
  NotificationStatus,
  PRIORITY_WEIGHT,
} from "./notification.types";

import { FINAL_BACKEND_URL, fetchWithAuth, reportUnauthorized } from "../backend-api";

// ─── State Shape ──────────────────────────────────────────────────────────────

interface NotificationState {
  items: NutriNotification[];
  loading: boolean;
  error: string | null;
}

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseNotificationsReturn {
  /** All non-dismissed notifications, sorted by priority → date */
  notifications: NutriNotification[];
  /** Unread count (badge number) */
  unreadCount: number;
  /** True while fetching from backend */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
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
  /** Re-fetch from backend */
  refresh: () => void;
}

// ─── Map backend row → NutriNotification ─────────────────────────────────────

interface BackendNotification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  priority: "low" | "medium" | "high";
  title: string;
  body: string;
  emoji: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

function mapBackend(row: BackendNotification): NutriNotification {
  return {
    id: row.id,
    category: row.category,
    priority: row.priority,
    status: row.is_read ? "read" : "unread",
    title: row.title,
    body: row.body,
    emoji: row.emoji,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(userId?: string): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({
    items: [],
    loading: true,
    error: null,
  });
  const [activeCategory, setActiveCategory] = useState<
    NotificationCategory | undefined
  >(undefined);

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch from backend ────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    // ยกเลิก request เก่าถ้ายังค้างอยู่
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/notifications`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        // session ที่ค้างใน localStorage อาจเสีย (เช่นถูกลบฝั่ง Supabase ไปแล้ว) ทำให้ทุก request
        // 401 ซ้ำไปเรื่อยๆ ไม่มีที่สิ้นสุดถ้าไม่มีจุดไหนสั่ง sign-out — สั่งออกทันทีให้ login ใหม่ได้
        if (res.status === 401) void reportUnauthorized();
        throw new Error(`HTTP ${res.status}`);
      }

      const rows: BackendNotification[] = await res.json();
      setState({
        items: rows.map(mapBackend),
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("[useNotifications] fetch error:", msg);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: msg,
      }));
    }
  }, [userId]);

  // โหลดครั้งแรกเมื่อ component mount หรือ userId เปลี่ยน
  useEffect(() => {
    fetchNotifications();
    return () => abortRef.current?.abort();
  }, [fetchNotifications]);

  // ── Derived ──────────────────────────────────────────────────────────────

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

  // ── Mutators (Local state + API call) ────────────────────────────────────

  const updateLocalStatus = useCallback(
    (id: string, status: NotificationStatus, extra?: Partial<NutriNotification>) =>
      setState((prev) => ({
        ...prev,
        items: prev.items.map((n) =>
          n.id === id ? { ...n, status, ...extra } : n
        ),
      })),
    []
  );

  const markAsRead = useCallback(
    (id: string) => {
      // Optimistic update
      updateLocalStatus(id, "read", { readAt: new Date().toISOString() });
      // Persist to backend
      fetchWithAuth(`${FINAL_BACKEND_URL}/api/notifications/${id}/read`, {
        method: "PUT",
      }).catch((e) => console.warn("[useNotifications] markAsRead error:", e));
    },
    [updateLocalStatus, userId]
  );

  const markAllAsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((n) =>
        n.status === "unread"
          ? { ...n, status: "read", readAt: new Date().toISOString() }
          : n
      ),
    }));
    // เรียก API ทีละตัวสำหรับของที่ยังไม่ได้อ่าน
    state.items
      .filter((n) => n.status === "unread")
      .forEach((n) => {
        fetchWithAuth(`${FINAL_BACKEND_URL}/api/notifications/${n.id}/read`, {
          method: "PUT",
        }).catch(() => {});
      });
  }, [state.items, userId]);

  const dismiss = useCallback(
    (id: string) => {
      updateLocalStatus(id, "dismissed");
      fetchWithAuth(`${FINAL_BACKEND_URL}/api/notifications/${id}`, {
        method: "DELETE",
      }).catch((e) => console.warn("[useNotifications] dismiss error:", e));
    },
    [updateLocalStatus, userId]
  );

  const dismissAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((n) => ({ ...n, status: "dismissed" })),
    }));
    // ไม่ bulk delete ฝั่ง API เพื่อรักษา audit trail
  }, []);

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
      setState((prev) => ({ ...prev, items: [newItem, ...prev.items] }));
    },
    []
  );

  return {
    notifications,
    unreadCount,
    loading: state.loading,
    error: state.error,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    filterByCategory,
    activeCategory,
    push,
    refresh: fetchNotifications,
  };
}
