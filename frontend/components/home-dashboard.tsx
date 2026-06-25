"use client"

import { useMemo } from "react"
import { Plus, Minus, Apple, Droplets, Flame, Activity, Search, ArrowRight, Sunrise, Sun, Moon, Cookie, CheckCircle2, Circle, Flame as FireIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore, calcBMI, calcTDEE } from "@/lib/store"
import Link from "next/link"
import type { DashboardSummary } from "@/lib/backend-api"

interface HomeDashboardProps {
  summary?: DashboardSummary | null
}

// ── การ์ดทักทายแบบ Dynamic เปลี่ยนไอคอน/สีตามช่วงเวลา — ใช้การ์ดขาว + ไอคอนวงกลมสี
// ให้เข้ากับสไตล์ของการ์ดอื่นๆ ในแดชบอร์ด (ของเดิมเป็นบล็อกไล่เฉดสีเต็มการ์ด ดูคนละแนวกับที่เหลือ)
function getGreeting(): { text: string; icon: LucideIcon; iconBg: string; iconColor: string } {
  const h = new Date().getHours()

  if (h >= 5 && h < 12) {
    return { text: "สวัสดีตอนเช้า", icon: Sunrise, iconBg: "bg-amber-50", iconColor: "text-amber-500" }
  }
  if (h >= 12 && h < 17) {
    return { text: "สวัสดีตอนบ่าย", icon: Sun, iconBg: "bg-sky-50", iconColor: "text-sky-500" }
  }
  return { text: "สวัสดียามค่ำคืน", icon: Moon, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" }
}
const MEAL_CONFIG = [
  { key: "breakfast", label: "มื้อเช้า",     icon: <Sunrise className="w-4 h-4" />, bg: "bg-amber-50",  text: "text-amber-600",  border: "border-amber-100/50" },
  { key: "lunch",     label: "มื้อกลางวัน", icon: <Sun className="w-4 h-4" />,     bg: "bg-green-50",  text: "text-green-600",  border: "border-green-100/50" },
  { key: "dinner",    label: "มื้อเย็น",    icon: <Moon className="w-4 h-4" />,     bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-100/50" },
  { key: "snack",     label: "ของว่าง",     icon: <Cookie className="w-4 h-4" />,  bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100/50" },
]

export default function HomeDashboard({ summary }: HomeDashboardProps) {
  const { userName, profile, foodEntries, waterEntries, addWaterEntry, removeWaterEntry } = useAppStore()

  const todayKey = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const todayEntries = useMemo(
    () => foodEntries.filter(e => e.date === todayKey),
    [foodEntries, todayKey]
  )

  const waterTodayLocal = useMemo(
    () => waterEntries.filter(e => e.date === todayKey).reduce((s, e) => s + e.amount, 0),
    [waterEntries, todayKey]
  )

  // รายการน้ำล่าสุดของวันนี้ — ใช้สำหรับปุ่ม "ลบรายการล่าสุด" เผื่อกดผิด
  const lastWaterEntryToday = useMemo(
    () => waterEntries.find(e => e.date === todayKey) ?? null,
    [waterEntries, todayKey]
  )

  // จำนวนวันที่บันทึกอาหารต่อเนื่องจนถึงวันนี้ (streak)
  const loggingStreak = useMemo(() => {
    const loggedDates = new Set(foodEntries.map(e => e.date))
    let streak = 0
    const cursor = new Date()
    while (true) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      if (!loggedDates.has(`${y}-${m}-${d}`)) break
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }, [foodEntries])

  const activeProfile = summary?.profile || profile
  const displayName = summary?.profile?.name || userName || "เพื่อน"
  const waterToday = waterTodayLocal
  const caloriesToday = todayEntries.reduce((s, e) => s + e.calories, 0)
  
  const weightNum = parseFloat(activeProfile.weight) || 0
  const heightNum = parseFloat(activeProfile.height) || 0
  const ageNum = parseFloat(activeProfile.age) || 0

  const tdee = summary?.tdee ?? calcTDEE(
    weightNum, heightNum, ageNum,
    activeProfile.gender, activeProfile.activityLevel, activeProfile.goal
  )
  const waterTarget = summary?.water_target ?? Math.round((weightNum || 60) * 33)

  const greeting = getGreeting()
  const GreetingIcon = greeting.icon
  const formattedDate = new Date().toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })

  const calorieGoal = tdee > 0 ? tdee : 2000
  const caloriePercent = Math.round((caloriesToday / calorieGoal) * 100)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (Math.min(caloriePercent, 100) / 100) * circumference

  const macrosToday = useMemo(() => {
    let protein = 0, carbs = 0, fat = 0
    todayEntries.forEach(e => {
      protein += e.protein || 0
      carbs += e.carbs || 0
      fat += e.fat || 0
    })
    return { protein, carbs, fat }
  }, [todayEntries])

  const macroGoals = {
    protein: Math.round((calorieGoal * 0.25) / 4),
    carbs: Math.round((calorieGoal * 0.50) / 4),
    fat: Math.round((calorieGoal * 0.25) / 9),
  }

  const todayChecklist = [
    { label: 'บันทึกอาหารแล้ว', done: todayEntries.length > 0 },
    { label: 'ดื่มน้ำครบเป้าหมาย', done: waterTarget > 0 && waterToday >= waterTarget },
    { label: 'แคลอรีอยู่ในเป้าหมาย', done: caloriesToday > 0 && caloriesToday <= calorieGoal },
  ]

  const entriesByMeal = useMemo(() => {
    const map: Record<string, typeof todayEntries> = { breakfast: [], lunch: [], dinner: [], snack: [] }
    todayEntries.forEach(e => {
      if (map[e.mealType]) map[e.mealType].push(e)
    })
    return map
  }, [todayEntries])

  return (
    <div className="p-4 space-y-4 lg:space-y-6 pb-24 max-w-2xl lg:max-w-6xl mx-auto">

      {/* ── การ์ดหัวข้อต้อนรับ — เปลี่ยนจากบล็อกไล่เฉดสีเต็มการ์ดเป็นการ์ดขาว + ไอคอนวงกลมสี
          ให้เข้าสไตล์เดียวกับการ์ดอื่นๆ ในแดชบอร์ด (calorie ring, macro cards, water tracking ฯลฯ) ── */}
      <div className="p-5 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-12 h-12 rounded-2xl ${greeting.iconBg} flex items-center justify-center shrink-0`}>
            <GreetingIcon className={`w-6 h-6 ${greeting.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              NutriSmart Dashboard
            </p>
            <h1 className="text-lg font-bold text-foreground truncate">
              {greeting.text}, <span className="text-primary">คุณ{displayName}</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              วันนี้พร้อมสำหรับเป้าหมายสุขภาพของคุณแล้วหรือยัง? ลุยกันเลย!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <div className="xl:col-span-2 space-y-4 lg:space-y-6">

          {/* ── Calorie Ring Card ── */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-primary" /> เป้าหมายแคลอรีวันนี้
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">{formattedDate}</span>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <svg width="128" height="128" className="-rotate-90">
                  <circle cx="64" cy="64" r="54" stroke="#e4f0e5" strokeWidth="12" fill="none" />
                  <circle
                    cx="64" cy="64" r="54"
                    stroke={caloriesToday > calorieGoal ? "var(--color-destructive)" : "#41a347"}
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${caloriesToday > calorieGoal ? "text-destructive" : "text-foreground"}`}>
                    {caloriePercent}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">ของเป้าหมาย</span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">รับประทานแล้ว</p>
                  <p className={`text-2xl font-bold ${caloriesToday > calorieGoal ? "text-destructive" : "text-primary"}`}>
                    {caloriesToday.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">จาก {calorieGoal.toLocaleString()} kcal</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${caloriesToday > calorieGoal ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min(caloriePercent, 100)}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${caloriesToday > calorieGoal ? "text-destructive" : "text-green-600"}`}>
                  {caloriesToday > calorieGoal 
                    ? `⚠️ เกินเป้าหมายมา ${Math.abs(calorieGoal - caloriesToday).toLocaleString()} kcal`
                    : `เหลืออีก ${(calorieGoal - caloriesToday).toLocaleString()} kcal`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* ── Macro Mini Cards ── */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'โปรตีน', value: Math.round(macrosToday.protein), target: macroGoals.protein, unit: 'g', icon: <Activity size={14} />, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'คาร์บ', value: Math.round(macrosToday.carbs), target: macroGoals.carbs, unit: 'g', icon: <Apple size={14} />, color: 'text-orange-500', bg: 'bg-orange-50' },
              { label: 'ไขมัน', value: Math.round(macrosToday.fat), target: macroGoals.fat, unit: 'g', icon: <Droplets size={14} />, color: 'text-red-500', bg: 'bg-red-50' },
            ].map((m) => {
              const pct = m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0
              return (
                <div key={m.label} className="bg-card rounded-2xl p-2 sm:p-3 shadow-sm border border-border flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className={`w-7 h-7 rounded-xl ${m.bg} flex items-center justify-center mb-2 ${m.color}`}>
                    {m.icon}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-foreground">
                    {m.value}
                    <span className="text-[9px] sm:text-[10px] font-normal text-muted-foreground ml-0.5">/{m.target}{m.unit}</span>
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{m.label}</p>
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${m.color.replace('text', 'bg')}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── มื้ออาหารวันนี้ ── */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-foreground">มื้ออาหารวันนี้</h2>
              <Link href="/logs" className="text-xs text-primary font-medium hover:underline">ดูประวัติ</Link>
            </div>
            
            <div className="divide-y divide-border/40">
              {MEAL_CONFIG.map((meal) => {
                const meals = entriesByMeal[meal.key] || []
                const hasMeals = meals.length > 0

                return (
                  <div key={meal.key} className="py-2.5 first:pt-0 last:pb-0">
                    {hasMeals ? (
                      <div className="space-y-1.5">
                        {meals.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-xl ${meal.bg} ${meal.text} border ${meal.border} flex items-center justify-center shrink-0`}>
                                {meal.icon}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{item.name}</p>
                                <p className="text-[11px] text-muted-foreground">{meal.label}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-primary">{item.calories} kcal</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-muted text-muted-foreground/70 flex items-center justify-center shrink-0">
                            {meal.icon}
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">{meal.label}</span>
                        </div>
                        <Link href={`/logs?action=add&type=${meal.key}`}>
                          <button className="h-7 px-3 text-xs font-medium border border-border hover:border-primary/40 hover:text-primary rounded-xl transition-all flex items-center gap-1 active:scale-95 bg-white text-muted-foreground shadow-sm">
                            <Plus size={12} /> เพิ่มอาหาร
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>{/* end left column */}

        {/* ── Right rail ── */}
        <div className="space-y-4 lg:space-y-6">

          {/* ── Water Tracking ── */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Droplets size={18} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-foreground">ปริมาณน้ำดื่มวันนี้</h2>
                  <p className="text-xs text-muted-foreground">เป้าหมาย {waterTarget.toLocaleString()} ml</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => lastWaterEntryToday && removeWaterEntry(lastWaterEntryToday.id)}
                  disabled={!lastWaterEntryToday}
                  title="ลบรายการน้ำล่าสุด (เผื่อกดผิด)"
                  className="w-7 h-7 rounded-full border border-blue-100 bg-white hover:bg-blue-50 text-blue-500 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-white transition-colors shrink-0"
                >
                  <Minus size={13} />
                </button>
                <div className="text-right">
                  <span className="text-xl font-bold text-blue-500">{waterToday.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">ml</span>
                </div>
              </div>
            </div>

            <div className="w-full bg-blue-50/50 rounded-full h-2 overflow-hidden border border-blue-100/30">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min((waterToday / waterTarget) * 100, 100)}%` }} />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-0.5">
              {[150, 250, 500].map(ml => (
                <button
                  key={ml}
                  onClick={() => addWaterEntry(ml)}
                  className="h-9 rounded-xl border border-blue-100 bg-white hover:bg-blue-50 text-blue-600 text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus size={12} /> {ml}ml
                </button>
              ))}
            </div>
          </div>

          {/* ── เป้าหมายวันนี้ + Streak ── */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">เป้าหมายวันนี้</h2>
              {loggingStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
                  <FireIcon size={11} /> ต่อเนื่อง {loggingStreak} วัน
                </span>
              )}
            </div>
            <div className="space-y-2">
              {todayChecklist.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  {item.done ? (
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={`text-xs ${item.done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── การ์ดทางลัด ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <Link href="/analyzer" className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">วิเคราะห์ฉลาก</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">สแกนและตรวจสอบโภชนาการทันที</p>
              </div>
              <span className="text-xs text-primary font-semibold flex items-center gap-1 mt-auto">เริ่มสแกน <ArrowRight className="w-3 h-3" /></span>
            </Link>

            <Link href="/health" className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                <Activity className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">ภาพรวมสุขภาพ</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">กราฟ 7 วันและประวัติทั้งหมด</p>
              </div>
              <span className="text-xs text-secondary font-semibold flex items-center gap-1 mt-auto">ดูกราฟ <ArrowRight className="w-3 h-3" /></span>
            </Link>
          </div>

        </div>{/* end right rail */}

      </div>{/* end grid */}

    </div>
  )
}