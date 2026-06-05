"use client"

import { useMemo } from "react"
import { Activity, Zap, ScanLine, Search, MessageCircle, ArrowRight, Droplet, Plus, Flame, ChevronRight, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { calcBMI, calcTDEE } from "@/lib/store"
import Link from "next/link"

function getGreeting(name: string): { text: string; sub: string } {
  const h = new Date().getHours()
  if (h < 12) return { text: `อรุณสวัสดิ์ คุณ${name} 🌅`, sub: "มาเริ่มวันใหม่ด้วยมื้อเช้าที่ดีต่อสุขภาพกันเถอะ!" }
  if (h < 17) return { text: `สวัสดีตอนบ่าย คุณ${name} ☀️`, sub: "อย่าลืมดื่มน้ำเพียงพอในช่วงกลางวันนะครับ" }
  return { text: `สวัสดีตอนเย็น คุณ${name} 🌙`, sub: "มาสรุปผลโภชนาการของวันนี้กันเถอะ!" }
}

const MEAL_CONFIG = [
  { key: "breakfast", label: "มื้อเช้า",    emoji: "🌅", color: "bg-amber-50 text-amber-600 border-amber-200"  },
  { key: "lunch",     label: "มื้อกลางวัน", emoji: "☀️", color: "bg-green-50 text-green-600 border-green-200"  },
  { key: "dinner",    label: "มื้อเย็น",    emoji: "🌙", color: "bg-blue-50 text-blue-600 border-blue-200"    },
  { key: "snack",     label: "ของว่าง",    emoji: "🍿", color: "bg-orange-50 text-orange-600 border-orange-200" },
]

// SVG ring progress
function CalorieRing({ current, target }: { current: number; target: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(current / target, 1) : 0
  const dash = pct * circ
  const over = current > target

  return (
    <div className="relative w-[140px] h-[140px] flex-shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f0f0f0" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={over ? "var(--color-destructive)" : "var(--color-primary)"}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ / 4}
          transform="rotate(0 70 70)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-extrabold leading-none ${over ? "text-destructive" : "text-foreground"}`}>
          {current.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted-foreground mt-0.5">/ {target.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground">kcal</span>
      </div>
    </div>
  )
}

export default function HomeDashboard() {
  const { userName, profile, foodEntries, waterEntries, scanHistory, addWaterEntry } = useAppStore()

  const todayKey = new Date().toISOString().slice(0, 10)

  const todayEntries = useMemo(() => foodEntries.filter(e => e.date === todayKey), [foodEntries, todayKey])
  const waterToday = useMemo(
    () => waterEntries.filter(e => e.date === todayKey).reduce((s, e) => s + e.amount, 0),
    [waterEntries, todayKey]
  )

  const bmi = calcBMI(parseFloat(profile.weight), parseFloat(profile.height))
  const tdee = calcTDEE(
    parseFloat(profile.weight), parseFloat(profile.height),
    parseFloat(profile.age), profile.gender, profile.activityLevel, profile.goal
  )
  const waterTarget = Math.round((parseFloat(profile.weight) || 60) * 33)
  const caloriesToday = todayEntries.reduce((s, e) => s + e.calories, 0)

  const greeting = getGreeting(userName || "คุณ")

  const bmiColor = bmi === 0 ? "text-muted-foreground" : bmi < 25 ? "text-primary" : "text-destructive"
  const bmiLabel = bmi === 0 ? "ยังไม่มีข้อมูล" : bmi < 18.5 ? "น้ำหนักน้อย" : bmi < 25 ? "สมส่วนดี" : bmi < 30 ? "น้ำหนักเกิน" : "อ้วน"

  // Meals eaten today
  const mealsToday = useMemo(() => {
    const map: Record<string, number> = {}
    todayEntries.forEach(e => { map[e.mealType] = (map[e.mealType] || 0) + e.calories })
    return map
  }, [todayEntries])

  return (
    <div className="p-4 space-y-4 pb-24 max-w-2xl mx-auto">

      {/* ── Welcome Banner ── */}
      <div className="rounded-2xl bg-primary px-5 py-5 text-white">
        <p className="text-xs text-white/60 mb-1">
          {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h2 className="text-xl font-extrabold mb-1">{greeting.text}</h2>
        <p className="text-white/75 text-xs leading-relaxed">{greeting.sub}</p>
      </div>

      {/* ── Calorie Ring + Quick Stats ── */}
      <div className="bg-white rounded-2xl border border-border p-4">
        <p className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-secondary" />
          พลังงานวันนี้
        </p>
        <div className="flex items-center gap-5">
          <CalorieRing current={caloriesToday} target={tdee} />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground">เป้าหมาย TDEE</p>
              <p className="font-extrabold text-lg text-foreground">{tdee > 0 ? `${tdee.toLocaleString()} kcal` : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">เหลือได้อีก</p>
              <p className={`font-extrabold text-lg ${caloriesToday > tdee ? "text-destructive" : "text-primary"}`}>
                {tdee > 0 ? `${Math.abs(tdee - caloriesToday).toLocaleString()} kcal` : "—"}
              </p>
              {caloriesToday > tdee && <p className="text-[10px] text-destructive">⚠️ เกินเป้าหมายแล้ว</p>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="text-center bg-muted/40 rounded-lg py-1.5">
                <p className="text-[10px] text-muted-foreground">BMI</p>
                <p className={`text-sm font-bold ${bmiColor}`}>{bmi > 0 ? bmi.toFixed(1) : "—"}</p>
                <p className={`text-[9px] font-semibold ${bmiColor}`}>{bmiLabel}</p>
              </div>
              <div className="text-center bg-muted/40 rounded-lg py-1.5">
                <p className="text-[10px] text-muted-foreground">สแกนแล้ว</p>
                <p className="text-sm font-bold text-foreground">{scanHistory.length}</p>
                <p className="text-[9px] text-muted-foreground">รายการ</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Meals Today ── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <p className="font-bold text-sm text-foreground">มื้ออาหารวันนี้</p>
          </div>
          <Link href="/logs" className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline">
            ดูทั้งหมด <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-border/50">
          {MEAL_CONFIG.map(m => {
            const cal = mealsToday[m.key]
            return (
              <div key={m.key} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                </div>
                {cal ? (
                  <span className="text-sm font-bold text-foreground">{cal} <span className="text-[11px] font-normal text-muted-foreground">kcal</span></span>
                ) : (
                  <Link href="/logs">
                    <span className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-2 py-1 hover:border-primary hover:text-primary transition-colors cursor-pointer">+ เพิ่ม</span>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Water Tracking ── */}
      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Droplet className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">น้ำดื่มวันนี้</p>
              <p className="text-[11px] text-muted-foreground">เป้า {waterTarget.toLocaleString()} ml</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-extrabold text-blue-500">{waterToday.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground ml-1">ml</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-blue-50 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((waterToday / waterTarget) * 100, 100)}%` }}
          />
        </div>

        {/* Water buttons */}
        <div className="grid grid-cols-3 gap-2">
          {[150, 250, 500].map(ml => (
            <button
              key={ml}
              onClick={() => addWaterEntry(ml)}
              className="h-10 rounded-xl border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> {ml}ml
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/analyzer" className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">วิเคราะห์ฉลาก</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">สแกนและตรวจสอบโภชนาการทันที</p>
          </div>
          <span className="text-xs text-primary font-semibold flex items-center gap-1">เริ่มสแกน <ArrowRight className="w-3 h-3" /></span>
        </Link>

        <Link href="/health" className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">ภาพรวมสุขภาพ</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">กราฟ 7 วันและประวัติทั้งหมด</p>
          </div>
          <span className="text-xs text-secondary font-semibold flex items-center gap-1">ดูกราฟ <ArrowRight className="w-3 h-3" /></span>
        </Link>
      </div>

      {/* Prompt to fill profile if empty */}
      {!profile.weight && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-amber-800">กรุณากรอกข้อมูลโปรไฟล์</p>
            <p className="text-xs text-amber-700">เพื่อให้ระบบคำนวณ BMI และ TDEE ส่วนตัว</p>
          </div>
          <Link href="/profile">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0 h-9 px-3 text-xs">กรอก</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
