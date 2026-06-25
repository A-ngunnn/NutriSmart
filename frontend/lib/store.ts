import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserProfile,
  saveUserProfile,
  fetchFoodLogs,
  createFoodLog,
  deleteFoodLog,
  fetchScanLogs,
  createScanLog,
  fetchWaterLogs,
  createWaterLog,
  deleteWaterLog,
  type ProfileData,
} from "@/lib/backend-api";

// ── Supabase Singleton ─────────────────────────────────────────────────────────────────────────
const supabaseClient = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export type { ProfileData };

export interface FoodEntry {
  id: string
  name: string
  mealType: string
  calories: number
  protein: number
  carbs: number
  fat: number
  date: string // ISO date string "YYYY-MM-DD"
}

export interface ScanRecord {
  id: string
  date: string
  productName: string
  calories: number
  protein: number
  carbs: number
  totalFat: number
  sugar: number
  sodium: number
  score: number
  status: "safe" | "moderate" | "danger"
  imageUrl?: string
}

export interface WaterEntry {
  id: string
  amount: number
  date: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: ProfileData = {
  name: "",
  email: "",
  avatarUrl: "",
  age: "",
  gender: "male",
  weight: "",
  height: "",
  activityLevel: "sedentary",
  goal: "maintain",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calcBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0
  const m = heightCm / 100
  return parseFloat((weightKg / (m * m)).toFixed(1))
}

export function calcTDEE(weight: number, height: number, age: number, gender: string, activityLevel: string, goal: string): number {
  if (!weight || !height || !age) return 0
  const bmr = gender === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5
  const factors: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  }
  let tdee = bmr * (factors[activityLevel] ?? 1.2)
  if (goal === "lose") tdee -= 500
  if (goal === "gain") tdee += 500
  if (goal === "muscle") tdee += 300
  return Math.round(tdee)
}

export function calcWaterTarget(weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 2000
  return Math.round(weightKg * 33)
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppState {
  // Profile
  userName: string
  profile: ProfileData

  // Food log
  foodEntries: FoodEntry[]

  // Scan history
  scanHistory: ScanRecord[]

  // Water log
  waterEntries: WaterEntry[]

  // Actions
  setUserName: (name: string) => Promise<void>
  setProfile: (profile: ProfileData) => Promise<void>
  setAvatarUrl: (avatarUrl: string) => Promise<void>

  addFoodEntry: (entry: Omit<FoodEntry, "id" | "date">) => Promise<void>
  removeFoodEntry: (id: string) => Promise<void>
  getTodayEntries: () => FoodEntry[]
  getTodayCalories: () => number

  addScan: (scan: Omit<ScanRecord, "id" | "date">) => Promise<void>
  addScanLocal: (scan: Omit<ScanRecord, "id" | "date">) => void

  addWaterEntry: (amount: number) => Promise<void>
  removeWaterEntry: (id: string) => Promise<void>
  getTodayWater: () => number

  fetchUserData: (userId: string) => Promise<void>
  clearState: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userName: "",
      profile: DEFAULT_PROFILE,
      foodEntries: [],
      scanHistory: [],
      waterEntries: [],

      setUserName: async (name) => {
        set((state) => ({ 
          userName: name,
          profile: { ...state.profile, name }
        }))
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session) {
          const saved = await saveUserProfile({ ...get().profile, name }, session.user.id)
          set({ profile: saved, userName: saved.name || name })
        }
      },

      setProfile: async (profile) => {
        set((state) => ({
          profile,
          userName: profile.name || state.userName,
        }))
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session) {
          const saved = await saveUserProfile(profile, session.user.id)
          set({ profile: saved, userName: saved.name || profile.name || get().userName })
        }
      },

      setAvatarUrl: async (avatarUrl) => {
        // Optimistic update ทันที แล้วค่อย sync หลังบ้าน
        set((state) => ({ profile: { ...state.profile, avatarUrl } }))
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session) {
          try {
            const { updateAvatarUrl } = await import("@/lib/backend-api")
            const saved = await updateAvatarUrl(avatarUrl, session.user.id)
            set((state) => ({ profile: { ...state.profile, avatarUrl: saved.avatarUrl || avatarUrl } }))
          } catch (e) {
            console.error("[store] setAvatarUrl failed:", e)
          }
        }
      },

      addFoodEntry: async (entry) => {
        // 🚀 Optimistic Update: โชว์ข้อมูลบนหน้าจอทันที ก่อนรอเช็ค session
        const tempId = `temp-${Date.now()}`
        const optimisticEntry: FoodEntry = { ...entry, id: tempId, date: todayKey() }
        set((state) => ({ foodEntries: [optimisticEntry, ...state.foodEntries] }))

        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) {
          set((state) => ({ foodEntries: state.foodEntries.filter((e) => e.id !== tempId) }))
          return
        }

        try {
          const created = await createFoodLog({ ...entry, date: todayKey() }, session.user.id)
          // 🔄 แทนที่ tempId ด้วยของจริงจากเซิร์ฟเวอร์
          set((state) => ({ 
            foodEntries: state.foodEntries.map((e) => (e.id === tempId ? created : e)) 
          }))
        } catch (error) {
          console.error("Failed to add food log:", error)
          // 🔙 Rollback ถ้ายิง API ไม่สำเร็จ
          set((state) => ({ 
            foodEntries: state.foodEntries.filter((e) => e.id !== tempId) 
          }))
        }
      },

      removeFoodEntry: async (id) => {
        set((state) => ({ foodEntries: state.foodEntries.filter((e) => e.id !== id) }))

        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session) {
          await deleteFoodLog(id, session.user.id)
        }
      },

      getTodayEntries: () => {
        const today = todayKey()
        return get().foodEntries.filter((e) => e.date === today)
      },

      getTodayCalories: () => {
        const today = todayKey()
        return get().foodEntries
          .filter((e) => e.date === today)
          .reduce((sum, e) => sum + e.calories, 0)
      },

      // ใช้ตอน backend auto-save สแกนนี้ไปแล้วเอง (เช่นผ่าน /api/analyze/image หรือ /manual ที่ save=true
      // อยู่แล้วในตัว) — แค่ sync local state ให้ตรง ไม่ต้องยิง POST ซ้ำเป็นรายการที่สองของสแกนเดียวกัน
      addScanLocal: (scan) => {
        const localScan: ScanRecord = { ...scan, id: `temp-${Date.now()}`, date: todayKey() }
        set((state) => ({ scanHistory: [localScan, ...state.scanHistory] }))
      },

      addScan: async (scan) => {
        // 🚀 Optimistic Update: โชว์ข้อมูลบนหน้าจอทันที ก่อนรอเช็ค session
        const tempId = `temp-${Date.now()}`
        const optimisticScan: ScanRecord = { ...scan, id: tempId, date: todayKey() }
        set((state) => ({ scanHistory: [optimisticScan, ...state.scanHistory] }))

        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) {
          set((state) => ({ scanHistory: state.scanHistory.filter((e) => e.id !== tempId) }))
          return
        }

        try {
          const created = await createScanLog({ ...scan, date: todayKey() }, session.user.id)
          set((state) => ({ 
            scanHistory: state.scanHistory.map((e) => (e.id === tempId ? (created as ScanRecord) : e)) 
          }))
        } catch (error) {
          console.error("Failed to add scan log:", error)
          set((state) => ({ 
            scanHistory: state.scanHistory.filter((e) => e.id !== tempId) 
          }))
        }
      },

      addWaterEntry: async (amount) => {
        // 🚀 Optimistic Update: โชว์ข้อมูลบนหน้าจอทันที ก่อนรอเช็ค session
        const tempId = `temp-${Date.now()}`
        const optimisticEntry: WaterEntry = { id: tempId, amount, date: todayKey() }
        set((state) => ({ waterEntries: [optimisticEntry, ...state.waterEntries] }))

        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) {
          set((state) => ({ waterEntries: state.waterEntries.filter((e) => e.id !== tempId) }))
          return
        }

        try {
          const created = await createWaterLog(amount, todayKey(), session.user.id)
          set((state) => ({ 
            waterEntries: state.waterEntries.map((e) => (e.id === tempId ? created : e)) 
          }))
        } catch (error) {
          console.error("Failed to add water log:", error)
          set((state) => ({ 
            waterEntries: state.waterEntries.filter((e) => e.id !== tempId) 
          }))
        }
      },

      removeWaterEntry: async (id) => {
        set((state) => ({ waterEntries: state.waterEntries.filter((e) => e.id !== id) }))

        // entry ที่ยังเป็น optimistic id (ยังไม่ถูกแทนที่ด้วย UUID จริงจาก backend)
        // ยังไม่มีอยู่ใน DB เลย — ลบจาก local state ก็พอ ห้ามยิง DELETE ไปเพราะ backend
        // จะ throw 500 (invalid uuid syntax) เนื่องจาก id ไม่ใช่ uuid ที่ถูกต้อง
        if (id.startsWith("temp-")) return

        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session) {
          await deleteWaterLog(id, session.user.id)
        }
      },

      getTodayWater: () => {
        const today = todayKey()
        return get().waterEntries
          .filter((e) => e.date === today)
          .reduce((sum, e) => sum + e.amount, 0)
      },

      fetchUserData: async (userId) => {
        if (!userId) return

        try {
          const [profile, foodEntries, scanHistory, waterEntries] = await Promise.all([
            fetchUserProfile(userId),
            fetchFoodLogs(userId),
            fetchScanLogs(userId) as Promise<ScanRecord[]>,
            fetchWaterLogs(userId),
          ])

          set({
            userName: profile.name || "",
            profile,
            foodEntries,
            scanHistory,
            waterEntries,
          })

          // Auto-sync avatar from Supabase auth metadata if not already in DB
          // LINE login → raw_user_meta_data.avatar_url (LINE pictureUrl)
          // Email login → raw_user_meta_data.avatar_url (gravatar or provider picture)
          if (!profile.avatarUrl) {
            try {
              const { data: { user } } = await supabaseClient.auth.getUser()
              const metaAvatar =
                user?.user_metadata?.avatar_url ||
                user?.user_metadata?.picture ||
                user?.user_metadata?.pictureUrl ||
                ""
              const metaEmail = user?.email || user?.user_metadata?.email || ""
              if (metaAvatar) {
                // บันทึกลง DB โดย call PATCH /api/profile/avatar
                const { updateAvatarUrl } = await import("@/lib/backend-api")
                const saved = await updateAvatarUrl(metaAvatar, userId)
                set((state) => ({
                  profile: {
                    ...state.profile,
                    avatarUrl: saved.avatarUrl || metaAvatar,
                    email: saved.email || metaEmail || state.profile.email,
                  },
                }))
              } else if (metaEmail) {
                // ไม่มีรูป แต่มีอีเมล — sync อีเมลไว้ก่อน
                set((state) => ({ profile: { ...state.profile, email: metaEmail } }))
              }
            } catch (avatarErr) {
              console.warn("[store] Avatar auto-sync failed (non-critical):", avatarErr)
            }
          }
        } catch (error) {
          console.error("fetchUserData failed:", error)
        }
      },

      clearState: () => set({
        userName: "",
        profile: DEFAULT_PROFILE,
        foodEntries: [],
        scanHistory: [],
        waterEntries: [],
      }),
    }),
    {
      name: "nutrismart-storage",
    }
  )
);
