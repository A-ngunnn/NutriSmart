/**
 * NutriSmart API Client
 * Calls Python FastAPI Backend for AI analysis, chat, and app data.
 */

// 1. ดึงค่าจาก Environment Variables (ดักไว้ทุกคีย์ที่อาจเป็นไปได้)
const ENVIRONMENT_BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

// 2. ฟังก์ชันคำนวณ URL ปลายทางอย่างแม่นยำ แยก Production และ Localhost เด็ดขาด
export function getBackendUrl(): string {
  // ถ้าตั้งค่า Environment Variable ไว้ชัดเจน ให้ใช้ค่านั้นเสมอ ไม่ว่าจะเป็น localhost หรือ production
  // (เดิมโค้ดนี้เมิน env var ทุกครั้งที่มีคำว่า "localhost" แล้วฮาร์ดโค้ด 8080 ทับ ทำให้แก้ .env.local
  // เปลี่ยนพอร์ตแล้วไม่มีผลอะไรเลยตอน dev บนเครื่อง — เป็นสาเหตุที่พอร์ตสับสนกันมาตลอด)
  if (ENVIRONMENT_BACKEND_URL) {
    return ENVIRONMENT_BACKEND_URL;
  }

  // ไม่มี env var ตั้งไว้เลย — ค่อยเดาตามสภาพแวดล้อมเป็นแนวรับสุดท้าย
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return "https://nutrismart-dc0b.onrender.com";
  }

  // สำหรับฝั่ง Server-side SSR
  return "http://localhost:8000";
}

// ตัวแปรแกนหลักตัวเดียวที่จะใช้คุยกับ API ทุกฟังก์ชันต่อจากนี้
export const FINAL_BACKEND_URL = getBackendUrl().replace("localhost", "127.0.0.1");

import { createClient } from "@/lib/supabase/client";

// เวลาที่หลายๆ component ยิง fetchWithAuth พร้อมกัน (เช่น fetchUserData ที่ยิง 4 request
// พร้อมกันด้วย Promise.all) แต่ละ request เคยเรียก supabase.auth.getSession() แยกกันเอง
// ซ้ำซ้อนโดยไม่จำเป็น (ได้ access_token เดียวกันทุกครั้งอยู่แล้ว) ทำให้ทุก request ต้องรอ
// session call ของตัวเองจบก่อน ถึงจะเริ่มยิงจริง — cache แบบ "in-flight" นี้ทำให้ทุก request ที่
// ยิงพร้อมกันในช่วงเวลาสั้นๆ ใช้ผลลัพธ์จาก getSession() ครั้งเดียวกัน ลดจำนวนรอบที่ต้องรอ
let _inflightSession: Promise<string | undefined> | null = null;

async function _getAccessToken(): Promise<string | undefined> {
  if (_inflightSession) return _inflightSession;

  _inflightSession = (async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token;
    } catch (e) {
      console.warn("[backend-api] Failed to get supabase session", e);
      return undefined;
    } finally {
      // เคลียร์ cache ทันทีหลังจบ ไม่ใช่ cache ค้างไว้นาน — แค่ dedupe การยิงพร้อมกันช่วงสั้นๆ เท่านั้น
      _inflightSession = null;
    }
  })();

  return _inflightSession;
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const accessToken = await _getAccessToken();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
  }
  return headers;
}

// ฐานข้อมูล (Postgres แบบ hosted) อาจ cold-start หลัง idle นานๆ ทำให้ query แรกช้ากว่าปกติมาก
// 15s เคยพอ แต่ cold-start จริงบางทีเกิน นั้น เลยขยับเป็น 30s กันเคส timeout หลอกๆ ตอนเปิดแอปครั้งแรก
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export async function fetchWithAuth(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();

  const finalOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    },
    signal: options.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  };

  return fetch(url, finalOptions);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  productName: string;
  servingSize?: string;
  calories: number;
  protein: number;
  carbs: number;
  totalFat: number;
  saturatedFat?: number;
  transFat?: number;
  sugar: number;
  sodium: number;
  fiber?: number;
  score: number;
  status: "safe" | "moderate" | "danger";
  warnings: string[];
  advice: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProfileData {
  name: string;
  email: string;
  avatarUrl: string;
  age: string;
  gender: string;
  weight: string;
  height: string;
  activityLevel: string;
  goal: string;
}

export interface DashboardSummary {
  profile: ProfileData;
  bmi: number;
  tdee: number;
  calories_today: number;
  calories_remaining: number;
  scan_count: number;
  water_today: number;
  water_target: number;
  meal_totals: Record<string, number>;
}

export interface FoodLogEntry {
  id: string;
  user_id: string;
  name: string;
  mealType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  created_at: string;
}

export interface ScanLogEntry {
  id: string;
  user_id: string;
  productName: string;
  calories: number;
  protein: number;
  carbs: number;
  totalFat: number;
  sugar: number;
  sodium: number;
  score: number;
  status: "safe" | "moderate" | "danger";
  image_url?: string;
  date: string;
  created_at: string;
}

export interface WaterLogEntry {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  database: string;
  model: string;
  ai_api_key_set: boolean;
  database_error?: string;
}

export interface PeriodStats {
  avg_calories: number;
  avg_scan_score: number;
  scan_count: number;
}

export interface HealthSummary {
  profile: ProfileData;
  tdee: number;
  last_7_days: Array<{
    date: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  avg_calories: number;
  avg_scan_score: number;
  scan_count: number;
  macro_totals: {
    protein: number;
    carbs: number;
    fat: number;
  };
  scan_history: ScanLogEntry[];
  monthly_data: Array<{ week: string; cal: number }>;
  monthly_stats: PeriodStats;
  yearly_data: Array<{ month: string; cal: number }>;
  yearly_stats: PeriodStats;
}

function buildUrl(path: string, userId?: string) {
  const url = new URL(`${FINAL_BACKEND_URL}${path}`)
  if (userId) url.searchParams.set("user_id", userId)
  return url.toString()
}

// เคยเจอบั๊ก: ถ้า session/token ที่ค้างอยู่ใน localStorage เสียจริง (เช่น session ถูกลบฝั่ง Supabase แล้ว
// แต่ access_token ยังไม่หมดอายุตาม timestamp） getSession() ฝั่ง client จะยังคืน token เดิมซ้ำๆ
// ทุกครั้งโดยไม่รู้ตัวว่ามันใช้ไม่ได้แล้ว ทำให้ทุก request 401 ซ้ำไปเรื่อยๆ ไม่มีที่สิ้นสุด (หน้าเว็บค้าง
// ที่ error ตลอดเพราะไม่มีจุดไหนสั่ง sign-out ออกจาก session ที่เสียนี้เลย) — แก้โดยให้ 401 ทุกครั้ง
// สั่ง sign-out ทันที ซึ่งจะไปเข้า onAuthStateChange ใน app-shell.tsx (session=null) แล้ว redirect
// ไปหน้า login ให้เอง ผู้ใช้แค่ login ใหม่ได้ปกติ ไม่ต้องไปเคลียร์ localStorage มือเอง
let _signingOut = false

export async function reportUnauthorized() {
  if (_signingOut || typeof window === "undefined") return
  _signingOut = true
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch (e) {
    console.warn("[backend-api] Failed to sign out after 401:", e)
  } finally {
    _signingOut = false
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    if (typeof window !== "undefined") {
      console.debug("[backend-api] parseJson error", { status: response.status, body })
    }
    let error
    try {
      error = JSON.parse(body)
    } catch {
      error = {}
    }
    if (response.status === 401) {
      void reportUnauthorized()
    }
    throw new Error(error.detail || body || "Backend request failed")
  }
  return response.json();
}

// ── Analyze: image ────────────────────────────────────────────────────────────

export async function analyzeImageWithBackend(
  imageBase64DataURL: string,
  userId?: string
): Promise<AnalyzeResult> {
  const match = imageBase64DataURL.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image format");

  const mimeType = match[1];
  const base64Data = match[2];

  const formData = new FormData();
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  formData.append("file", blob, "nutrition-label.jpg");
  if (userId) {
    formData.append("user_id", userId);
  }

  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/analyze/image`, {
    method: "POST",
    body: formData,
  });

  return parseJson<AnalyzeResult>(response);
}

// ── Analyze: manual input ─────────────────────────────────────────────────────

export async function analyzeManualWithBackend(data: {
  productName: string;
  calories: number;
  protein: number;
  carbs: number;
  totalFat: number;
  sugar: number;
  sodium: number;
}, save: boolean = true): Promise<AnalyzeResult> {
  // save=false ใช้ตอนข้อมูลนี้มาจากการสแกนรูป (/api/analyze/image auto-save ไปแล้วรอบหนึ่ง) —
  // ขอแค่คะแนนวิเคราะห์ ไม่ต้อง insert ซ้ำเป็นรายการที่สองของสแกนเดียวกัน
  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/analyze/manual?save=${save}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return parseJson<AnalyzeResult>(response);
}

// ── Analyze: estimate (by name) ─────────────────────────────────────────────

export async function estimateFoodWithBackend(foodName: string): Promise<Partial<AnalyzeResult>> {
  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/analyze/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food_name: foodName }),
  });
  return parseJson<Partial<AnalyzeResult>>(response);
}

// ── Chat ──────────────────────────────────────────────────────────────────────

// 🌟 [แก้ไข] เปิดท่อรับอาร์กิวเมนต์ตัวที่ 3 (userProfile) และยัดพ่วงลง Body ส่งไปให้ Python
export async function chatWithBackend(
  message: string,
  history: ChatMessage[] = [],
  userProfile?: {
    name: string;
    weight: number | string;
    height: number | string;
    age: number | string;
    gender: string;
    goal_calories: number | string;
  }
): Promise<string> {
  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message: message,
      history: history,
      user_profile: userProfile
    }),
  });

  // ใช้รูปแบบการดึงค่าผลลัพธ์แบบฉลาดตามโครงสร้างเดิมของไฟล์นาย
  try {
    const data = await parseJson<{ reply?: string; content?: string }>(response);
    return data.reply || data.content || (data as unknown as string);
  } catch {
    // แบ็กอัปเผื่อหลังบ้านพ่น Text เปล่ากลับมา
    return response.text();
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function fetchDashboardSummary(userId?: string): Promise<DashboardSummary> {
  const response = await fetchWithAuth(buildUrl("/api/dashboard/summary", userId));
  return parseJson<DashboardSummary>(response);
}

// ── Profile ─────────────────────────────────────────────────────────────────--

export async function fetchUserProfile(userId?: string): Promise<ProfileData> {
  const response = await fetchWithAuth(buildUrl("/api/profile", userId));
  return parseJson<ProfileData>(response);
}

export async function saveUserProfile(profile: ProfileData, userId?: string): Promise<ProfileData> {
  const response = await fetchWithAuth(buildUrl("/api/profile", userId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return parseJson<ProfileData>(response);
}

export async function updateAvatarUrl(avatarUrl: string, userId?: string): Promise<ProfileData> {
  /**
   * PATCH /api/profile/avatar — อัปเดตเฉพาะรูปโปรไฟล์ ไม่ต้องส่ง payload ทั้งหมด
   * เรียกใช้เมื่อ:
   *  1. ผู้ใช้กดเปลี่ยนรูปบนหน้า Profile
   *  2. Auto-sync จาก LINE / Email auth metadata ตอน login ครั้งแรก
   */
  const response = await fetchWithAuth(buildUrl("/api/profile/avatar", userId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatarUrl }),
  });
  return parseJson<ProfileData>(response);
}

export async function registerFcmToken(fcmToken: string, userId?: string): Promise<{ success: boolean }> {
  /** PATCH /api/profile/fcm-token — ลงทะเบียน FCM token ของอุปกรณ์นี้ สำหรับรับ Web Push Notification */
  const response = await fetchWithAuth(buildUrl("/api/profile/fcm-token", userId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken }),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function unregisterFcmToken(fcmToken: string, userId?: string): Promise<{ success: boolean }> {
  /** DELETE /api/profile/fcm-token — ยกเลิกรับการแจ้งเตือนบนอุปกรณ์นี้ */
  const response = await fetchWithAuth(buildUrl("/api/profile/fcm-token", userId), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken }),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function testPushNotification(userId?: string): Promise<{ success: boolean; devicesNotified: number }> {
  /** POST /api/notifications/test-push — ส่ง Web Push ทดสอบทันที เพื่อยืนยันว่าเปิดรับแจ้งเตือนถูกต้องจริง */
  const response = await fetchWithAuth(buildUrl("/api/notifications/test-push", userId), {
    method: "POST",
  });
  return parseJson<{ success: boolean; devicesNotified: number }>(response);
}

interface TriggerSummaryResult {
  inserted: boolean;
  notificationId: string;
  title: string;
  body: string;
}

async function postTrigger(path: string, body: Record<string, unknown> = {}): Promise<TriggerSummaryResult> {
  const response = await fetchWithAuth(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ inserted?: boolean; sent?: boolean; notification_id?: string; title: string; body: string }>(response);
  return {
    inserted: data.inserted ?? data.sent ?? false,
    notificationId: data.notification_id ?? "",
    title: data.title,
    body: data.body,
  };
}

/** ใช้ทดสอบฟีเจอร์สรุปสุขภาพรายสัปดาห์/เดือน/ปี และแจ้งเตือนตามจิกให้มาอัปเดตมื้ออาหาร — เงื่อนไขจริงของ
 * ระบบ (เช่น "สรุปรายสัปดาห์ส่งทุกวันจันทร์เท่านั้น") กว่าจะถึงรอบจริงอาจรอนาน เลย expose endpoint
 * ทดสอบเหล่านี้ให้กดดูผลได้ทันทีโดยไม่ต้องรอถึงวันที่กำหนดจริง */
export const triggerWeeklySummary = () => postTrigger("/api/notifications/trigger-summary/weekly");
export const triggerMonthlySummary = () => postTrigger("/api/notifications/trigger-summary/monthly");
export const triggerYearlySummary = () => postTrigger("/api/notifications/trigger-summary/yearly");
export const triggerMealReminder = () => postTrigger("/api/notifications/trigger-reminder", { force: true });
export const triggerSodiumGoodDay = () => postTrigger("/api/notifications/trigger-summary/sodium-good-day");

// ── Food logs ────────────────────────────────────────────────────────────────

export async function fetchFoodLogs(userId?: string): Promise<FoodLogEntry[]> {
  const response = await fetchWithAuth(buildUrl("/api/logs/food", userId));
  return parseJson<FoodLogEntry[]>(response);
}

export async function createFoodLog(
  entry: Omit<FoodLogEntry, "id" | "user_id" | "created_at">,
  userId?: string
): Promise<FoodLogEntry> {
  const response = await fetchWithAuth(buildUrl("/api/logs/food", userId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  return parseJson<FoodLogEntry>(response);
}

export async function deleteFoodLog(entryId: string, userId?: string): Promise<void> {
  const response = await fetchWithAuth(buildUrl(`/api/logs/food/${entryId}`, userId), {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Delete food log failed");
  }
}

// ── Scan logs ───────────────────────────────────────────────────────────────

export async function fetchScanLogs(userId?: string): Promise<ScanLogEntry[]> {
  const response = await fetchWithAuth(buildUrl("/api/logs/scan", userId));
  const data = await parseJson<any[]>(response);
  return data.map(item => ({
    ...item,
    imageUrl: item.image_url
  })) as ScanLogEntry[];
}

export async function createScanLog(
  scan: Omit<ScanLogEntry, "id" | "user_id" | "created_at">,
  userId?: string
): Promise<ScanLogEntry> {
  const response = await fetchWithAuth(buildUrl("/api/logs/scan", userId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scan),
  });
  return parseJson<ScanLogEntry>(response);
}

// ── Water logs ───────────────────────────────────────────────────────────────

export async function fetchWaterLogs(userId?: string): Promise<WaterLogEntry[]> {
  const response = await fetchWithAuth(buildUrl("/api/logs/water", userId));
  return parseJson<WaterLogEntry[]>(response);
}

export async function createWaterLog(
  amount: number,
  date?: string,
  userId?: string
): Promise<WaterLogEntry> {
  const response = await fetchWithAuth(buildUrl("/api/logs/water", userId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, date }),
  });
  return parseJson<WaterLogEntry>(response);
}

export async function deleteWaterLog(entryId: string, userId?: string): Promise<void> {
  const response = await fetchWithAuth(buildUrl(`/api/logs/water/${entryId}`, userId), {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Delete water entry failed");
  }
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function fetchHealthStatus(userId?: string): Promise<HealthStatus> {
  const response = await fetchWithAuth(buildUrl("/api/health/status", userId));
  return parseJson<HealthStatus>(response);
}

export async function fetchHealthSummary(userId?: string): Promise<HealthSummary> {
  const response = await fetchWithAuth(buildUrl("/api/health/summary", userId));
  return parseJson<HealthSummary>(response);
}

export async function fetchAiHealthInsights(period: "weekly" | "monthly" | "yearly", userId?: string): Promise<string[]> {
  /** GET /api/health/insights — insight ที่ AI (MedGemma + RAG) วิเคราะห์จริงตามบริบทของ user
   * (โรคประจำตัว, สัดส่วนมาโคร, แนวโน้ม) ต่างจาก insight แบบ template ที่คำนวณฝั่ง frontend */
  const url = new URL(buildUrl("/api/health/insights", userId));
  url.searchParams.set("period", period);
  const response = await fetchWithAuth(url.toString());
  const data = await parseJson<{ insights: string[] }>(response);
  return data.insights;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FINAL_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}