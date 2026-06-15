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
} from "@/lib/backend-api";

// ── Supabase Singleton ─────────────────────────────────────────────────────────────────────────
const supabaseClient = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  name: string
  age: string
  gender: string
  weight: string
  height: string
  activityLevel: string
  goal: string
}

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
}

export interface WaterEntry {
  id: string
  amount: number
  date: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: ProfileData = {
  name: "",
  age: "",
  gender: "male",
  weight: "",
  height: "",
  activityLevel: "sedentary",
  goal: "maintain",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
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

  addFoodEntry: (entry: Omit<FoodEntry, "id" | "date">) => Promise<void>
  removeFoodEntry: (id: string) => Promise<void>
  getTodayEntries: () => FoodEntry[]
  getTodayCalories: () => number

  addScan: (scan: Omit<ScanRecord, "id" | "date">) => Promise<void>

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

      addFoodEntry: async (entry) => {
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) return

        // 🚀 Optimistic Update: โชว์ข้อมูลบนหน้าจอทันที
        const tempId = `temp-${Date.now()}`
        const optimisticEntry: FoodEntry = { ...entry, id: tempId, date: todayKey() }
        set((state) => ({ foodEntries: [optimisticEntry, ...state.foodEntries] }))

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

      addScan: async (scan) => {
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) return

        // 🚀 Optimistic Update
        const tempId = `temp-${Date.now()}`
        const optimisticScan: ScanRecord = { ...scan, id: tempId, date: todayKey() }
        set((state) => ({ scanHistory: [optimisticScan, ...state.scanHistory] }))

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
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) return

        // 🚀 Optimistic Update
        const tempId = `temp-${Date.now()}`
        const optimisticEntry: WaterEntry = { id: tempId, amount, date: todayKey() }
        set((state) => ({ waterEntries: [optimisticEntry, ...state.waterEntries] }))

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
          const profile = await fetchUserProfile(userId)
          const foodEntries = await fetchFoodLogs(userId)
          const scanHistory = (await fetchScanLogs(userId)) as ScanRecord[]
          const waterEntries = await fetchWaterLogs(userId)

          set({
            userName: profile.name || "",
            profile,
            foodEntries,
            scanHistory,
            waterEntries,
          })
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
