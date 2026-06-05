/**
 * NutriSmart API Client
 * Calls Python FastAPI Backend (port 8080) for AI analysis and chat.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

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

// ── Analyze: image ────────────────────────────────────────────────────────────

export async function analyzeImageWithBackend(
  imageBase64DataURL: string
): Promise<AnalyzeResult> {
  // Extract mime type and base64 data from data URL
  const match = imageBase64DataURL.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image format");

  const mimeType = match[1];
  const base64Data = match[2];

  const formData = new FormData();
  // Convert base64 to Blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  formData.append("file", blob, "nutrition-label.jpg");

  const response = await fetch(`${BACKEND_URL}/api/analyze/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Backend analysis failed");
  }

  return response.json();
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
  const response = await fetch(`${BACKEND_URL}/api/analyze/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Backend analysis failed");
  }

  return response.json();
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function chatWithBackend(
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Chat failed");
  }

  const data = await response.json();
  return data.reply;
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
