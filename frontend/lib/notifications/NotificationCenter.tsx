"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_CONFIG,
  NutriNotification,
  NotificationCategory,
} from "./notification.types";
import { useNotifications } from "./useNotifications";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

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
  const cfg = CATEGORY_CONFIG[n.category];
  const isUnread = n.status === "unread";

  return (
    <div
      onClick={() => isUnread && onRead(n.id)}
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        background: isUnread
          ? "var(--nutri-surface-raised, #FAFAFA)"
          : "transparent",
        borderLeft: isUnread
          ? `3px solid ${cfg.color}`
          : "3px solid transparent",
        cursor: isUnread ? "pointer" : "default",
        transition: "background 0.15s",
        position: "relative",
      }}
    >
      {/* Emoji badge */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: cfg.bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {n.emoji}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {isUnread && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: cfg.color,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: isUnread ? 600 : 500,
              color: "var(--nutri-text-primary, #111827)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {n.title}
          </span>
        </div>

        <p
          style={{
            fontSize: 12,
            color: "var(--nutri-text-secondary, #6B7280)",
            margin: 0,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {n.body}
        </p>

        {/* Progress bar (optional) */}
        {n.meta?.progress !== undefined && (
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: "var(--nutri-surface-muted, #E5E7EB)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(n.meta.progress * 100, 100)}%`,
                background: cfg.color,
                borderRadius: 2,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--nutri-text-muted, #9CA3AF)" }}>
            {relativeTime(n.createdAt)}
          </span>

          <span
            style={{
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 20,
              background: cfg.bgColor,
              color: cfg.color,
              fontWeight: 500,
            }}
          >
            {CATEGORY_CONFIG[n.category].label}
          </span>

          {n.action && (
            <a
              href={n.action.href}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 11,
                color: cfg.color,
                textDecoration: "none",
                fontWeight: 600,
                marginLeft: "auto",
              }}
            >
              {n.action.label} →
            </a>
          )}
        </div>
      </div>

      {/* Dismiss × */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(n.id);
        }}
        aria-label="ปิดการแจ้งเตือน"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 20,
          height: 20,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--nutri-text-muted, #9CA3AF)",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          opacity: 0,
          transition: "opacity 0.15s",
        }}
        className="nutri-dismiss-btn"
      >
        ×
      </button>
    </div>
  );
}

// ─── Category Filter Tabs ─────────────────────────────────────────────────────

const CATEGORIES: (NotificationCategory | "all")[] = [
  "all",
  "daily",
  "goal",
  "ai",
  "system",
];

const CAT_LABELS: Record<string, string> = {
  all: "ทั้งหมด",
  daily: "กิจวัตร",
  goal: "เป้าหมาย",
  ai: "Nutri AI",
  system: "ระบบ",
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  /** Custom seed data (leave empty to use demo data) */
  initialNotifications?: NutriNotification[];
}

export default function NotificationCenter({
  initialNotifications,
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    filterByCategory,
    activeCategory,
    push,
  } = useNotifications(initialNotifications);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <style>{`
        .nutri-notif-item:hover .nutri-dismiss-btn { opacity: 1 !important; }
        .nutri-notif-item:hover { background: var(--nutri-surface-hover, #F3F4F6) !important; }
        .nutri-bell-btn:hover { background: var(--nutri-surface-raised, #F3F4F6) !important; }
        .nutri-tab:hover { color: var(--nutri-text-primary, #111827) !important; }
        @keyframes nutri-slide-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes nutri-badge-pop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* ── Bell Trigger ── */}
      <div style={{ position: "relative", display: "inline-block" }} ref={panelRef}>
        <button
          className="nutri-bell-btn text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ใหม่)` : ""}`}
          style={{
            position: "relative",
            width: 40,
            height: 40,
            borderRadius: 12,
            background: open
              ? "var(--nutri-surface-raised, #F3F4F6)"
              : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            transition: "background 0.15s, color 0.15s",
            border: "none",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 6,
                minWidth: 16,
                height: 16,
                borderRadius: 9,
                background: "#EF4444",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "2px solid var(--nutri-surface, #fff)",
                animation: "nutri-badge-pop 0.3s ease",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Panel ── */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 360,
              maxHeight: 520,
              borderRadius: 16,
              background: "var(--nutri-surface, #FFFFFF)",
              border: "1px solid var(--nutri-border, #E5E7EB)",
              boxShadow:
                "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -4px rgba(0,0,0,0.10)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "nutri-slide-in 0.18s ease",
              zIndex: 999,
              fontFamily: "'Sarabun', 'Prompt', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 16px 10px",
                borderBottom: "1px solid var(--nutri-border, #E5E7EB)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--nutri-text-primary, #111827)",
                  }}
                >
                  การแจ้งเตือน
                  {unreadCount > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#EF4444",
                        borderRadius: 10,
                        padding: "1px 7px",
                      }}
                    >
                      {unreadCount} ใหม่
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        fontSize: 12,
                        color: "#1D9E75",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontFamily: "inherit",
                      }}
                    >
                      อ่านทั้งหมด
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={dismissAll}
                      style={{
                        fontSize: 12,
                        color: "var(--nutri-text-muted, #9CA3AF)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
                {CATEGORIES.map((cat) => {
                  const isActive =
                    cat === "all" ? !activeCategory : activeCategory === cat;
                  const color =
                    cat === "all"
                      ? "#1D9E75"
                      : CATEGORY_CONFIG[cat as NotificationCategory].color;
                  return (
                    <button
                      key={cat}
                      className="nutri-tab"
                      onClick={() =>
                        filterByCategory(
                          cat === "all" ? undefined : (cat as NotificationCategory)
                        )
                      }
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: 12,
                        padding: "4px 11px",
                        borderRadius: 20,
                        border: isActive
                          ? `1.5px solid ${color}`
                          : "1.5px solid transparent",
                        background: isActive
                          ? cat === "all"
                            ? "#E6F7F2"
                            : CATEGORY_CONFIG[cat as NotificationCategory].bgColor
                          : "var(--nutri-surface-muted, #F3F4F6)",
                        color: isActive
                          ? color
                          : "var(--nutri-text-secondary, #6B7280)",
                        cursor: "pointer",
                        fontWeight: isActive ? 600 : 400,
                        transition: "all 0.15s",
                        fontFamily: "inherit",
                      }}
                    >
                      {CAT_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {notifications.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 24px",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 36 }}>🔕</span>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--nutri-text-muted, #9CA3AF)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    ไม่มีการแจ้งเตือนในขณะนี้
                  </p>
                </div>
              ) : (
                notifications.map((n, idx) => (
                  <div
                    key={n.id}
                    className="nutri-notif-item"
                    style={{
                      borderBottom:
                        idx < notifications.length - 1
                          ? "1px solid var(--nutri-border-light, #F3F4F6)"
                          : "none",
                    }}
                  >
                    <NotificationItem
                      n={n}
                      onRead={markAsRead}
                      onDismiss={dismiss}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Demo: push button (remove in production) */}
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--nutri-border, #E5E7EB)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() =>
                  push({
                    category: "daily",
                    priority: "medium",
                    emoji: "🥤",
                    title: "เวลาดื่มน้ำแล้วนะ!",
                    body: "จิบน้ำสักแก้วตอนนี้เลย ร่างกายจะขอบคุณคุณมากเลย 💧",
                    action: { label: "บันทึก", href: "/log/water" },
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 10,
                  border: "1.5px dashed #9FE1CB",
                  background: "transparent",
                  color: "#1D9E75",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
              >
                + จำลองการแจ้งเตือนใหม่ (Demo)
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
