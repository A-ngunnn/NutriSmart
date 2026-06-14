"use client"

import { useState, useMemo } from "react"
import { Plus, Trash2, CalendarDays, Utensils, TrendingDown, TrendingUp, Sparkles, Loader2, History, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { FINAL_BACKEND_URL } from "@/lib/backend-api"

const MEAL_TYPES = [
  { value: "breakfast", label: "มื้อเช้า (Breakfast)", emoji: "🌅" },
  { value: "lunch", label: "มื้อเที่ยง (Lunch)", emoji: "☀️" },
  { value: "dinner", label: "มื้อเย็น (Dinner)", emoji: "🌙" },
  { value: "snack", label: "ของว่าง (Snack)", emoji: "🍿" },
]

const QUICK_ADD = [
  { name: "ข้าวกะเพราไก่ไข่ดาว", mealType: "lunch", calories: 550, protein: 25, carbs: 65, fat: 18 },
  { name: "ข้าวมันไก่", mealType: "lunch", calories: 480, protein: 28, carbs: 55, fat: 15 },
  { name: "โยเกิร์ตกรีก + กราโนล่า", mealType: "breakfast", calories: 250, protein: 15, carbs: 30, fat: 8 },
  { name: "ส้มตำ", mealType: "dinner", calories: 120, protein: 3, carbs: 15, fat: 5 },
  { name: "กล้วยน้ำว้า 2 ลูก", mealType: "snack", calories: 180, protein: 2, carbs: 42, fat: 0.5 },
  { name: "ชาเขียวมัทฉะ ลาเต้", mealType: "snack", calories: 160, protein: 5, carbs: 25, fat: 4 },
]

interface FoodLogPageProps {
  tdee?: number
}

export default function FoodLogPage({ tdee = 2000 }: FoodLogPageProps) {
  const { foodEntries, addFoodEntry, removeFoodEntry, scanHistory } = useAppStore()
  const [form, setForm] = useState({
    name: "",
    mealType: "breakfast",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  })
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  // ฟังก์ชันเรียกคำนวณผ่านโมเดลที่เสถียรที่สุด (gemini-1.5-flash) ป้องกัน 404/403/429
  const handleEstimate = async () => {
    if (!form.name.trim()) return;

    setEstimating(true);
    setEstimateError(null);

    try {
      const res = await fetch(
        `${FINAL_BACKEND_URL}/api/analyze/estimate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            food_name: form.name.trim(),
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 429) {
          setEstimateError("AI กำลังมีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้ง");
        } else if (res.status === 404) {
          setEstimateError("ไม่พบบริการวิเคราะห์อาหาร");
        } else {
          setEstimateError(`เกิดข้อผิดพลาด (${res.status})`);
        }
        return;
      }

      const data = await res.json();

      setForm((prev) => ({
        ...prev,
        calories: String(data.calories ?? 0),
        protein: String(data.protein ?? 0),
        carbs: String(data.carbs ?? 0),
        fat: String(data.fat ?? 0),
      }));
    } catch (err) {
      console.error("Estimate Error:", err);
      setEstimateError("ไม่สามารถเชื่อมต่อระบบวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setEstimating(false);
    }
  };

  // Filter today's entries
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntries = useMemo(
    () => foodEntries.filter((e) => e.date === todayKey),
    [foodEntries, todayKey]
  )

  const totalCal = todayEntries.reduce((a, b) => a + b.calories, 0)
  const totalProtein = todayEntries.reduce((a, b) => a + b.protein, 0)
  const totalCarbs = todayEntries.reduce((a, b) => a + b.carbs, 0)
  const totalFat = todayEntries.reduce((a, b) => a + b.fat, 0)
  const calProgress = Math.min((totalCal / tdee) * 100, 100)
  const remaining = tdee - totalCal

  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  // Group by meal type
  const grouped = useMemo(() => {
    const map: Record<string, typeof todayEntries> = {}
    for (const entry of todayEntries) {
      if (!map[entry.mealType]) map[entry.mealType] = []
      map[entry.mealType].push(entry)
    }
    return map
  }, [todayEntries])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.calories) return
    addFoodEntry({
      name: form.name,
      mealType: form.mealType,
      calories: parseFloat(form.calories) || 0,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
    })
    setForm({ name: "", mealType: "breakfast", calories: "", protein: "", carbs: "", fat: "" })
  }

  const handleQuickAdd = (item: typeof QUICK_ADD[0]) => {
    addFoodEntry(item)
  }

  return (
    <div className="p-4 md:max-w-5xl md:mx-auto">
      <Tabs defaultValue="diary" className="w-full">
        <div className="flex justify-center mb-6">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="diary" className="text-sm">
              <Utensils className="w-4 h-4 mr-2" />
              ไดอารี่อาหาร
            </TabsTrigger>
            <TabsTrigger value="scans" className="text-sm">
              <History className="w-4 h-4 mr-2" />
              ประวัติวิเคราะห์
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── TAB 1: FOOD DIARY ────────────────────────────────────── */}
        <TabsContent value="diary" className="mt-0 outline-none">
          <div className="flex flex-col md:flex-row gap-4">

            {/* Left column: Add form */}
            <div className="w-full md:w-[400px] md:flex-shrink-0 space-y-3">
              <div className="bg-white rounded-2xl border border-border p-4 space-y-4">
                <h2 className="font-bold text-base text-foreground">เพิ่มรายการอาหารประจำวัน</h2>

                <form onSubmit={handleAdd} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">ชื่อรายการอาหาร</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="เช่น กะเพราไข่ดาว / โยเกิร์ต"
                        value={form.name}
                        onChange={(e) => { set("name", e.target.value); setEstimateError(null) }}
                        className="h-11 flex-1"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleEstimate}
                        disabled={estimating || !form.name.trim()}
                        title="ให้ AI ประมาณค่าโภชนาการ"
                        className="h-11 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:from-violet-600 hover:to-indigo-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {estimating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">AI คำนวณ</span>
                      </button>
                    </div>
                    {estimateError && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> {estimateError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">มื้ออาหารหลัก</Label>
                    <Select value={form.mealType} onValueChange={(v) => set("mealType", v)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.emoji} {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "calories", label: "พลังงาน (KCAL)", placeholder: "350" },
                      { key: "protein", label: "โปรตีน (กรัม)", placeholder: "15" },
                      { key: "carbs", label: "คาร์บ (กรัม)", placeholder: "45" },
                      { key: "fat", label: "ไขมัน (กรัม)", placeholder: "8" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          placeholder={placeholder}
                          value={form[key as keyof typeof form]}
                          onChange={(e) => set(key, e.target.value)}
                          className="h-11"
                        />
                      </div>
                    ))}
                  </div>

                  <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-semibold text-sm mt-2">
                    <Plus className="w-4 h-4 mr-2" />
                    บันทึกมื้ออาหารลงไดอารี่
                  </Button>
                </form>
              </div>

              {/* Quick Add section */}
              <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-primary" />
                  <p className="font-bold text-sm text-foreground">เมนูยอดนิยม (กดเพิ่มเลย)</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ADD.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleQuickAdd(item)}
                      className="text-left rounded-xl border border-border p-2.5 hover:bg-muted/50 active:scale-[0.98] transition-all"
                    >
                      <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.calories} kcal</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Daily summary */}
            <div className="flex-1 space-y-3">
              {/* Progress card */}
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-bold text-sm text-foreground">สรุปรายการอาหารประจำวันนี้</p>
                    <p className="text-xs text-muted-foreground">{today}</p>
                  </div>
                </div>

                {/* Calorie progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">พลังงานรวมสะสมวันนี้</span>
                    <span className="text-foreground font-bold">
                      {totalCal.toLocaleString()} / {tdee.toLocaleString()} kcal
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${calProgress >= 100 ? "bg-destructive" : calProgress >= 80 ? "bg-secondary" : "bg-primary"}`}
                      style={{ width: `${calProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {remaining > 0 ? (
                      <TrendingDown className="w-3 h-3 text-primary" />
                    ) : (
                      <TrendingUp className="w-3 h-3 text-destructive" />
                    )}
                    <p className={`text-[11px] font-medium ${calProgress >= 100 ? "text-destructive" : "text-primary"}`}>
                      {calProgress >= 100 ? `เกินเป้าหมายไป ${Math.abs(remaining).toLocaleString()} kcal` : `เหลืออีก ${remaining.toLocaleString()} kcal`}
                    </p>
                  </div>
                </div>

                {/* Macro totals */}
                {todayEntries.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: "โปรตีน", val: totalProtein, unit: "g", color: "text-blue-600", bg: "bg-blue-50" },
                      { label: "คาร์บ", val: totalCarbs, unit: "g", color: "text-secondary", bg: "bg-orange-50" },
                      { label: "ไขมัน", val: totalFat, unit: "g", color: "text-destructive", bg: "bg-red-50" },
                    ].map(({ label, val, unit, color, bg }) => (
                      <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                        <p className={`text-base font-extrabold ${color}`}>{val.toFixed(1)}<span className="text-[10px] ml-0.5">{unit}</span></p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Entries list */}
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="font-bold text-sm text-foreground">รายการอาหาร</p>
                  {todayEntries.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{todayEntries.length} รายการ</span>
                  )}
                </div>
                {todayEntries.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                    <Utensils className="w-8 h-8 text-muted-foreground/30" />
                    วันนี้คุณยังไม่ได้บันทึกเมนูอาหาร
                  </div>
                ) : (
                  <div>
                    {MEAL_TYPES.map((mealType) => {
                      const items = grouped[mealType.value]
                      if (!items || items.length === 0) return null
                      const mealCal = items.reduce((s, e) => s + e.calories, 0)
                      return (
                        <div key={mealType.value}>
                          <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              {mealType.emoji} {mealType.label.split(" ")[0]}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">{mealCal} kcal</span>
                          </div>
                          <ul className="divide-y divide-border/50">
                            {items.map((e) => (
                              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">{e.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {e.calories} kcal &middot; P {e.protein}g &middot; C {e.carbs}g &middot; F {e.fat}g
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFoodEntry(e.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: SCAN HISTORY (ดึงกลับมาครบถ้วนสมบูรณ์แล้ว) ─────────────────── */}
        <TabsContent value="scans" className="mt-0 outline-none">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="font-bold text-base text-foreground">ประวัติการวิเคราะห์ทั้งหมด</h2>
              <span className="text-xs text-muted-foreground">{scanHistory.length} รายการ</span>
            </div>

            {scanHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border py-16 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <History className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">ยังไม่มีประวัติการวิเคราะห์</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                    ลองใช้ AI Scanner สแกนฉลากโภชนาการเพื่อดูข้อมูลวิเคราะห์ที่นี่
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...scanHistory].reverse().map((scan) => {
                  const isSafe = scan.status === "safe"
                  const isMod = scan.status === "moderate"
                  const isDanger = scan.status === "danger"
                  return (
                    <div key={scan.id} className="bg-white rounded-2xl border border-border p-4 space-y-3 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate pr-2">{scan.productName}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(scan.date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${isSafe ? "bg-green-50 text-green-700 border-green-200" :
                            isDanger ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-orange-50 text-orange-700 border-orange-200"
                            }`}
                        >
                          {isSafe ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                          คะแนน {scan.score}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/50 p-2 rounded-lg">
                          <p className="text-[10px] text-muted-foreground">พลังงาน</p>
                          <p className="font-bold">{scan.calories} kcal</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded-lg">
                          <p className="text-[10px] text-muted-foreground">น้ำตาล</p>
                          <p className={`font-bold ${scan.sugar > 24 ? "text-destructive" : ""}`}>{scan.sugar} g</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded-lg">
                          <p className="text-[10px] text-muted-foreground">โซเดียม</p>
                          <p className={`font-bold ${scan.sodium > 2000 ? "text-destructive" : ""}`}>{scan.sodium} mg</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded-lg">
                          <p className="text-[10px] text-muted-foreground">ไขมันรวม</p>
                          <p className={`font-bold ${scan.totalFat > 65 ? "text-destructive" : ""}`}>{scan.totalFat} g</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}