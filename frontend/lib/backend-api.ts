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
  // ถ้าตั้งค่าใน Vercel/Environment ไว้ชัดเจน และไม่ใช่การรันในเครื่องตัวเอง ให้ใช้ค่านั้นทันที
  if (ENVIRONMENT_BACKEND_URL && !ENVIRONMENT_BACKEND_URL.includes("localhost") && !ENVIRONMENT_BACKEND_URL.includes("127.0.0.1")) {
    return ENVIRONMENT_BACKEND_URL;
  }

  // เช็กสภาพแวดล้อมบน Browser
  if (typeof window !== "undefined") {
    // ถ้าเล่นบนเครื่องตัวเองในคอม (Localhost) ค่อยชี้ไปพอร์ต 8080
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8080";
    }
    // ถ้าอยู่บนเว็บจริง (Vercel) แต่ Environment พัง ให้ชี้ไปที่ Render ตัวหลักเป็นแนวรับสุดท้าย
    return ENVIRONMENT_BACKEND_URL || "https://nutrismart-dc0b.onrender.com";
  }

  // สำหรับฝั่ง Server-side SSR
  return ENVIRONMENT_BACKEND_URL || "http://localhost:8080";
}

// ตัวแปรแกนหลักตัวเดียวที่จะใช้คุยกับ API ทุกฟังก์ชันต่อจากนี้
export const FINAL_BACKEND_URL = getBackendUrl();

import { createClient } from "@/lib/supabase/client";

export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createClient();
      // getUser() triggers auto-refresh ถ้า Token หมดอายุ ก่อนดึง Session
      const { error: userError } = await supabase.auth.getUser();
      if (!userError) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }
    } catch (e) {
      console.warn("[backend-api] Failed to get supabase session", e);
    }
  }
  return headers;
}

export async function fetchWithAuth(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  
  const finalOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    }
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
}

function buildUrl(path: string, userId?: string) {
  const url = new URL(`${FINAL_BACKEND_URL}${path}`)
  if (userId) url.searchParams.set("user_id", userId)
  if (typeof window !== "undefined") {
    console.debug("[backend-api] buildUrl", { FINAL_BACKEND_URL, path, url: url.toString() })
  }
  return url.toString()
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
}): Promise<AnalyzeResult> {
  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/analyze/manual`, {
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

export async function chatWithBackend(
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const response = await fetchWithAuth(`${FINAL_BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const data = await parseJson<{ reply: string }>(response);
  return data.reply;
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
  return parseJson<ScanLogEntry[]>(response);
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