import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

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
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from("profiles").update({ name }).eq("id", session.user.id)
        }
      },

      setProfile: async (profile) => {
        set((state) => ({
          profile,
          userName: profile.name || state.userName,
        }))
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from("profiles").upsert({
            id: session.user.id,
            name: profile.name,
            age: profile.age ? Number(profile.age) : null,
            gender: profile.gender,
            weight: profile.weight ? Number(profile.weight) : null,
            height: profile.height ? Number(profile.height) : null,
            activity_level: profile.activityLevel,
            goal: profile.goal,
          })
        }
      },

      addFoodEntry: async (entry) => {
        const tempId = `food_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const dateStr = todayKey()
        const newEntry: FoodEntry = {
          ...entry,
          id: tempId,
          date: dateStr,
        }
        set((state) => ({ foodEntries: [newEntry, ...state.foodEntries] }))

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data, error } = await supabase.from("food_logs").insert({
            name: entry.name,
            meal_type: entry.mealType,
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            date: dateStr,
            user_id: session.user.id
          }).select().single()

          if (!error && data) {
            set((state) => ({
              foodEntries: state.foodEntries.map((e) => e.id === tempId ? { ...e, id: data.id } : e)
            }))
          }
        }
      },

      removeFoodEntry: async (id) => {
        set((state) => ({ foodEntries: state.foodEntries.filter((e) => e.id !== id) }))

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from("food_logs").delete().eq("id", id).eq("user_id", session.user.id)
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
        const tempId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const dateStr = todayKey()
        const thaiDate = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
        const newScan: ScanRecord = {
          ...scan,
          id: tempId,
          date: thaiDate,
        }
        set((state) => ({ scanHistory: [newScan, ...state.scanHistory] }))

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data, error } = await supabase.from("scan_history").insert({
            product_name: scan.productName,
            calories: scan.calories,
            protein: scan.protein,
            carbs: scan.carbs,
            total_fat: scan.totalFat,
            sugar: scan.sugar,
            sodium: scan.sodium,
            score: scan.score,
            status: scan.status,
            date: dateStr,
            user_id: session.user.id
          }).select().single()

          if (!error && data) {
            set((state) => ({
              scanHistory: state.scanHistory.map((s) => s.id === tempId ? { ...s, id: data.id } : s)
            }))
          }
        }
      },

      addWaterEntry: async (amount) => {
        const tempId = `water_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const dateStr = todayKey()
        const newEntry: WaterEntry = {
          id: tempId,
          amount,
          date: dateStr,
        }
        set((state) => ({ waterEntries: [newEntry, ...state.waterEntries] }))

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data, error } = await supabase.from("water_logs").insert({
            amount,
            date: dateStr,
            user_id: session.user.id
          }).select().single()

          if (!error && data) {
            set((state) => ({
              waterEntries: state.waterEntries.map((w) => w.id === tempId ? { ...w, id: data.id } : w)
            }))
          }
        }
      },

      removeWaterEntry: async (id) => {
        set((state) => ({ waterEntries: state.waterEntries.filter((e) => e.id !== id) }))

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from("water_logs").delete().eq("id", id).eq("user_id", session.user.id)
        }
      },

      getTodayWater: () => {
        const today = todayKey()
        return get().waterEntries
          .filter((e) => e.date === today)
          .reduce((sum, e) => sum + e.amount, 0)
      },

      fetchUserData: async (userId) => {
        const supabase = createClient()
        
        // 1. Fetch Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()
        
        let profile = DEFAULT_PROFILE
        let userName = ""
        if (profileData) {
          profile = {
            name: profileData.name || "",
            age: profileData.age?.toString() || "",
            gender: profileData.gender || "male",
            weight: profileData.weight?.toString() || "",
            height: profileData.height?.toString() || "",
            activityLevel: profileData.activity_level || "sedentary",
            goal: profileData.goal || "maintain",
          }
          userName = profileData.name || ""
        }

        // 2. Fetch Food Entries
        const { data: foodData } = await supabase
          .from("food_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
        
        const foodEntries: FoodEntry[] = (foodData || []).map((f) => ({
          id: f.id,
          name: f.name,
          mealType: f.meal_type,
          calories: Number(f.calories),
          protein: Number(f.protein),
          carbs: Number(f.carbs),
          fat: Number(f.fat),
          date: f.date,
        }))

        // 3. Fetch Scan History
        const { data: scanData } = await supabase
          .from("scan_history")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
        
        const scanHistory: ScanRecord[] = (scanData || []).map((s) => {
          let thaiDate = ""
          try {
            const [y, m, d] = s.date.split("-").map(Number)
            const dateObj = new Date(y, m - 1, d)
            thaiDate = dateObj.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
          } catch {
            thaiDate = s.date
          }
          return {
            id: s.id,
            date: thaiDate,
            productName: s.product_name,
            calories: Number(s.calories),
            protein: Number(s.protein),
            carbs: Number(s.carbs),
            totalFat: Number(s.total_fat),
            sugar: Number(s.sugar),
            sodium: Number(s.sodium),
            score: Number(s.score),
            status: s.status as "safe" | "moderate" | "danger",
          }
        })

        // 4. Fetch Water Entries
        const { data: waterData } = await supabase
          .from("water_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
        
        const waterEntries: WaterEntry[] = (waterData || []).map((w) => ({
          id: w.id,
          amount: Number(w.amount),
          date: w.date,
        }))

        set({
          userName,
          profile,
          foodEntries,
          scanHistory,
          waterEntries,
        })
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
