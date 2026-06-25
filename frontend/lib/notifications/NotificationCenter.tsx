"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck, Salad, Activity, Sparkles, AlertCircle } from "lucide-react";
import {
  CATEGORY_CONFIG,
  NutriNotification,
  NotificationCategory,
} from "./notification.types";
import { useNotifications } from "./useNotifications";
import { LoadingFruits } from "@/components/ui/loading-fruits";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

const CATEGORY_ICON: Record<NotificationCategory, React.ReactNode> = {
  daily: <Salad size={16} />,
  goal: <Activity size={16} />,
  ai: <Sparkles size={16} />,
  system: <AlertCircle size={16} />,
};

// ─── NotificationItem ─────────────────────────────────────────────────────────

function NotificationItem({
  n,
  onRead,
  onDismiss,
}: {
  n: NutriNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = CATEGORY_CONFIG[n.category as NotificationCategory];
  const isUnread = n.status === "unread";

  return (
    <div
      onClick={() => isUnread && onRead(n.id)}
      className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
        isUnread ? "bg-primary/5 cursor-pointer" : "cursor-default"
      }`}
    >
      <div
        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: cfg.bgColor, color: cfg.color }}
      >
        {CATEGORY_ICON[n.category as NotificationCategory]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm text-foreground leading-tight ${isUnread ? "font-semibold" : "font-medium"}`}>
            {n.title}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(n.id);
            }}
            aria-label="ลบการแจ้งเตือน"
            className="shrink-0 w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={11} className="text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>

        {n.meta?.progress !== undefined && (
          <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(n.meta.progress * 100, 100)}%`, background: cfg.color }}
            />
          </div>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground/70">{relativeTime(n.createdAt)}</span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: cfg.bgColor, color: cfg.color }}
          >
            {cfg.label}
          </span>
          {n.action && (
            <a
              href={n.action.href}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-semibold ml-auto hover:underline"
              style={{ color: cfg.color }}
            >
              {n.action.label} →
            </a>
          )}
        </div>
      </div>

      {isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
    </div>
  );
}

// ─── Category Filter Tabs ─────────────────────────────────────────────────────

const CATEGORIES: (NotificationCategory | "all")[] = ["all", "daily", "goal", "ai", "system"];

const CAT_LABELS: Record<string, string> = {
  all: "ทั้งหมด",
  daily: "กิจวัตร",
  goal: "เป้าหมาย",
  ai: "Nutri AI",
  system: "ระบบ",
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  /** Supabase user ID — ถ้าไม่ส่งมาจะแสดงการแจ้งเตือนของ default user */
  initialUserId?: string;
}

export default function NotificationCenter({ initialUserId }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    filterByCategory,
    activeCategory,
    refresh,
  } = useNotifications(initialUserId);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // เปิดดูแล้วถือว่าอ่านแล้ว — ไม่ต้องกดทีละรายการเอง หน่วงไว้นิดหน่อยให้ทันเห็นว่าอันไหนใหม่
  // ก่อนจุดจะหายไป (ไม่ใช่หายทันทีจนไม่รู้ว่าเมื่อกี้มีอะไรใหม่บ้าง)
  useEffect(() => {
    if (!open || unreadCount === 0) return;
    const timer = setTimeout(() => markAllAsRead(), 1500);
    return () => clearTimeout(timer);
  }, [open, unreadCount, markAllAsRead]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ใหม่)` : ""}`}
        className="relative w-9 h-9 rounded-full bg-muted hover:bg-accent flex items-center justify-center transition-colors"
      >
        <Bell size={18} className="text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 bg-card rounded-3xl shadow-xl border border-border overflow-hidden animate-in slide-in-from-top-2 duration-200 flex flex-col max-h-128">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">การแจ้งเตือน</h3>
                  {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} รายการที่ยังไม่ได้อ่าน</p>}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                    >
                      <CheckCheck size={13} />อ่านทั้งหมด
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={dismissAll} className="text-xs text-muted-foreground hover:underline">
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map((cat) => {
                  const isActive = cat === "all" ? !activeCategory : activeCategory === cat;
                  const color = cat === "all" ? "#1D9E75" : CATEGORY_CONFIG[cat as NotificationCategory].color;
                  const bg =
                    cat === "all" ? "#E6F7F2" : CATEGORY_CONFIG[cat as NotificationCategory].bgColor;
                  return (
                    <button
                      key={cat}
                      onClick={() => filterByCategory(cat === "all" ? undefined : (cat as NotificationCategory))}
                      className="whitespace-nowrap text-xs px-3 py-1 rounded-full border transition-colors"
                      style={
                        isActive
                          ? { borderColor: color, background: bg, color, fontWeight: 600 }
                          : { borderColor: "transparent", background: "var(--muted)", color: "var(--muted-foreground)" }
                      }
                    >
                      {CAT_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <LoadingFruits label="กำลังโหลดการแจ้งเตือน..." size="sm" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2.5 px-6">
                  <AlertCircle size={28} className="text-red-500" />
                  <p className="text-xs text-red-500 font-semibold text-center">โหลดการแจ้งเตือนไม่สำเร็จ</p>
                  <p className="text-[11px] text-muted-foreground text-center break-all">{error}</p>
                  <button
                    onClick={refresh}
                    className="mt-1 text-xs font-medium px-4 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} n={n} onRead={markAsRead} onDismiss={dismiss} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
