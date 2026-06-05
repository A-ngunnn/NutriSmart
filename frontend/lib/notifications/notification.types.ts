// ─── Notification Types for NutriSmart ───────────────────────────────────────

export type NotificationCategory =
  | "daily"      // กิจวัตรประจำวัน
  | "goal"       // เป้าหมายสุขภาพ
  | "ai"         // Nutri AI Insights
  | "system";    // ระบบและโปรไฟล์

export type NotificationPriority = "low" | "medium" | "high";

export type NotificationStatus = "unread" | "read" | "dismissed";

// ─── Core Notification Model ──────────────────────────────────────────────────

export interface NutriNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;

  title: string;
  body: string;
  emoji: string;

  /** ISO timestamp string */
  createdAt: string;
  readAt?: string;

  /** Optional deep-link action when tapped */
  action?: NotificationAction;

  /** For goal / AI insights — optional numeric context */
  meta?: NotificationMeta;
}

export interface NotificationAction {
  label: string;
  /** Internal route or command key, e.g. "/log/meal" or "open_report" */
  href: string;
}

export interface NotificationMeta {
  /** e.g. remaining calories, sodium mg, protein g … */
  value?: number;
  unit?: string;
  /** 0–1 progress toward goal */
  progress?: number;
}

// ─── Category Config (icon, label, accent color) ─────────────────────────────

export interface CategoryConfig {
  label: string;
  color: string;       // accent for badges / icons
  bgColor: string;     // soft background for icon wrapper
}

export const CATEGORY_CONFIG: Record<NotificationCategory, CategoryConfig> = {
  daily:  { label: "กิจวัตรประจำวัน", color: "#0EA5E9", bgColor: "#E0F2FE" },
  goal:   { label: "เป้าหมายสุขภาพ", color: "#F59E0B", bgColor: "#FEF3C7" },
  ai:     { label: "Nutri AI",        color: "#8B5CF6", bgColor: "#EDE9FE" },
  system: { label: "ระบบ",            color: "#64748B", bgColor: "#F1F5F9" },
};

export const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  high:   3,
  medium: 2,
  low:    1,
};

// ─── Seed / Demo Data ─────────────────────────────────────────────────────────

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const DEMO_NOTIFICATIONS: NutriNotification[] = [
  // Daily
  {
    id: "n1",
    category: "daily",
    priority: "medium",
    status: "unread",
    emoji: "🥗",
    title: "อย่าลืมบันทึกมื้อเที่ยง!",
    body: "เลยเวลาอาหารกลางวันไปแล้ว แต่ยังไม่เห็นรายการมื้อเที่ยงของคุณเลยนะ",
    createdAt: ago(45),
    action: { label: "บันทึกเดี๋ยวนี้", href: "/log/meal" },
  },
  {
    id: "n2",
    category: "daily",
    priority: "low",
    status: "unread",
    emoji: "💧",
    title: "ได้เวลาจิบน้ำแล้ว",
    body: "วันนี้คุณดื่มน้ำไปแค่ 2 แก้วเองนะ เป้าหมายคือ 8 แก้วต่อวัน",
    createdAt: ago(90),
    meta: { value: 2, unit: "แก้ว", progress: 0.25 },
    action: { label: "อัปเดตการดื่มน้ำ", href: "/log/water" },
  },
  {
    id: "n3",
    category: "daily",
    priority: "low",
    status: "read",
    emoji: "⚖️",
    title: "ถึงกำหนดชั่งน้ำหนักประจำสัปดาห์",
    body: "อัปเดตน้ำหนักเพื่อติดตามความคืบหน้าของเป้าหมายคุณได้เลย",
    createdAt: ago(180),
    readAt: ago(120),
    action: { label: "บันทึกน้ำหนัก", href: "/log/weight" },
  },

  // Goal
  {
    id: "n4",
    category: "goal",
    priority: "high",
    status: "unread",
    emoji: "⚠️",
    title: "เหลือแคลอรี่แค่ 200 kcal!",
    body: "วันนี้คุณทานไปมากแล้ว เหลือโควต้าอีกเพียง 200 kcal เท่านั้น",
    createdAt: ago(20),
    meta: { value: 200, unit: "kcal", progress: 0.9 },
    action: { label: "ดูสรุปวันนี้", href: "/summary/today" },
  },
  {
    id: "n5",
    category: "goal",
    priority: "medium",
    status: "unread",
    emoji: "🧂",
    title: "โซเดียมมื้อล่าสุดค่อนข้างสูง",
    body: "มื้อเที่ยงโซเดียมสูงกว่าค่าแนะนำ มื้อเย็นแนะนำให้ทานอาหารรสอ่อนลงนะ",
    createdAt: ago(60),
    action: { label: "ดูเมนูแนะนำ", href: "/suggest/low-sodium" },
  },
  {
    id: "n6",
    category: "goal",
    priority: "low",
    status: "read",
    emoji: "🎉",
    title: "บรรลุเป้าหมายโปรตีนวันนี้!",
    body: "เยี่ยมมาก! วันนี้คุณทานโปรตีนถึงเป้าหมายที่ตั้งไว้แล้ว 💪",
    createdAt: ago(240),
    readAt: ago(200),
    meta: { value: 60, unit: "g", progress: 1 },
  },

  // AI
  {
    id: "n7",
    category: "ai",
    priority: "medium",
    status: "unread",
    emoji: "📊",
    title: "รายงานประจำสัปดาห์พร้อมแล้ว",
    body: "น้อง Nutri วิเคราะห์พฤติกรรมการกินสัปดาห์นี้ของคุณเสร็จแล้ว แตะเพื่อดูรายงาน",
    createdAt: ago(30),
    action: { label: "ดูรายงาน", href: "/report/weekly" },
  },
  {
    id: "n8",
    category: "ai",
    priority: "low",
    status: "read",
    emoji: "💡",
    title: "AI มีเมนูแนะนำสำหรับคุณ",
    body: "ช่วงนี้คุณทานคาร์บน้อยลง AI ของเรามีเมนูแนะนำสำหรับเติมพลังงานให้คุณ",
    createdAt: ago(300),
    readAt: ago(250),
    action: { label: "ดูเมนูแนะนำ", href: "/suggest/ai" },
  },

  // System
  {
    id: "n9",
    category: "system",
    priority: "medium",
    status: "unread",
    emoji: "👤",
    title: "โปรไฟล์ยังไม่ครบถ้วน",
    body: "คุณยังไม่ได้กรอกข้อมูลส่วนสูงและเป้าหมายน้ำหนักในหน้าโปรไฟล์",
    createdAt: ago(360),
    action: { label: "กรอกข้อมูล", href: "/profile/edit" },
  },
  {
    id: "n10",
    category: "system",
    priority: "low",
    status: "dismissed",
    emoji: "✨",
    title: "ฟีเจอร์ใหม่: สแกนฉลากโภชนาการ",
    body: "อัปเดตใหม่! ตอนนี้คุณสามารถสแกนฉลากโภชนาการได้โดยตรงจากกล้อง",
    createdAt: ago(1440),
    action: { label: "ลองใช้งาน", href: "/scan" },
  },
];
