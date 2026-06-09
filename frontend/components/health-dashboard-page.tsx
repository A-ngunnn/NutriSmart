"use client"

import { useMemo } from "react"
import { ChevronRight, Activity, TrendingUp, PieChart as PieChartIcon } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from "recharts"
import { type HealthSummary } from "@/lib/backend-api"

interface ScanRecord {
  id: string
  date: string
  productName: string
  calories: number
  sugar: number
  sodium: number
  score: number
  status: "safe" | "moderate" | "danger"
}

interface FoodEntry {
  id: string
  name: string
  mealType: string
  calories: number
  protein: number
  carbs: number
  fat: number
  date: string
}

interface ProfileData {
  age: string
  gender: string
  weight: string
  height: string
  activityLevel: string
  goal: string
}

interface HealthDashboardProps {
  scanHistory?: ScanRecord[]
  foodEntries?: FoodEntry[]
  profile?: ProfileData
  summary?: HealthSummary | null
}

function calcTDEE(p: ProfileData | undefined): number {
  if (!p || !p.weight || !p.height || !p.age) return 2000
  const w = parseFloat(p.weight), h = parseFloat(p.height), a = parseFloat(p.age)
  const bmr = p.gender === "female" ? 10*w + 6.25*h - 5*a - 161 : 10*w + 6.25*h - 5*a + 5
  const factors: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
  let tdee = bmr * (factors[p.activityLevel] ?? 1.2)
  if (p.goal === "lose") tdee -= 500
  if (p.goal === "gain") tdee += 500
  return Math.round(tdee)
}

export default function HealthDashboardPage({ scanHistory = [], foodEntries = [], profile, summary }: HealthDashboardProps) {
  const profileData = summary?.profile ?? profile
  const tdee = summary?.tdee ?? calcTDEE(profileData)
  const scanHistoryData = summary?.scan_history ?? scanHistory

  const last7Days = useMemo(() => {
    if (summary?.last_7_days) {
      return summary.last_7_days
    }
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString("th-TH", { weekday: "short" }).replace("วัน", "")
      const entries = foodEntries.filter(e => e.date === dateStr)
      days.push({
        date: dateStr, label,
        calories: entries.reduce((s, e) => s + e.calories, 0),
        protein:  entries.reduce((s, e) => s + e.protein, 0),
        carbs:    entries.reduce((s, e) => s + e.carbs, 0),
        fat:      entries.reduce((s, e) => s + e.fat, 0),
      })
    }
    return days
  }, [foodEntries, summary])

  const totalMacros = useMemo(() => {
    let protein = 0, carbs = 0, fat = 0
    last7Days.forEach(d => { protein += d.protein; carbs += d.carbs; fat += d.fat })
    return { protein, carbs, fat }
  }, [last7Days])

  const avgCal = Math.round(last7Days.reduce((s, d) => s + d.calories, 0) / 7)
  const avgScore = summary?.avg_scan_score ?? (
    scanHistoryData.length > 0
      ? Math.round(scanHistoryData.reduce((a, b) => a + b.score, 0) / scanHistoryData.length) : 0
  )

  const macroData = [
    { name: "โปรตีน", value: totalMacros.protein, fill: "var(--color-primary)" },
    { name: "คาร์บ",   value: totalMacros.carbs,   fill: "var(--color-secondary)" },
    { name: "ไขมัน",  value: totalMacros.fat,      fill: "var(--color-chart-4)" },
  ]

  return (
    <div className="p-4 pb-24 space-y-4 max-w-2xl mx-auto">

      {/* ── HIGHLIGHTS ── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="text-base">✨</span>
          <p className="font-bold text-sm text-foreground">สรุปภาพรวม</p>
        </div>
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">🔥</span>
              <span className="text-sm font-medium text-foreground">เป้าหมายแคลอรี</span>
            </div>
            <span className="font-bold text-foreground">{tdee} <span className="text-xs font-normal text-muted-foreground">kcal</span></span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">⭐️</span>
              <span className="text-sm font-medium text-foreground">คะแนนสแกนเฉลี่ย</span>
            </div>
            <span className={`font-bold ${avgScore >= 70 ? "text-primary" : avgScore >= 50 ? "text-secondary" : avgScore > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {avgScore > 0 ? avgScore : "–"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">📋</span>
              <span className="text-sm font-medium text-foreground">สแกนทั้งหมด</span>
            </div>
            <span className="font-bold text-foreground">{summary?.scan_count ?? scanHistoryData.length} <span className="text-xs font-normal text-muted-foreground">รายการ</span></span>
          </div>
        </div>
      </div>

      {/* ── CALORIE CHART ── */}
      <div className="bg-white rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="font-bold text-sm text-foreground">พลังงาน 7 วันย้อนหลัง</p>
          </div>
          <span className="text-[11px] bg-muted px-2 py-1 rounded-full text-muted-foreground">เป้าหมาย {tdee} kcal</span>
        </div>

        <div className="mb-3">
          <span className="text-2xl font-extrabold text-foreground">{avgCal}</span>
          <span className="text-sm text-muted-foreground ml-1">kcal เฉลี่ย/วัน</span>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={last7Days} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)", rx: 4 }}
              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            />
            <ReferenceLine y={tdee} stroke="var(--color-secondary)" strokeDasharray="4 2" strokeWidth={1.5} />
            <Bar dataKey="calories" name="แคลอรี" radius={[4, 4, 0, 0]} barSize={28}>
              {last7Days.map((entry, i) => (
                <Cell key={`cal-${i}`} fill={entry.calories > tdee ? "var(--color-destructive)" : "var(--color-primary)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── MACROS ── */}
      <div className="bg-white rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-secondary" />
          <p className="font-bold text-sm text-foreground">สัดส่วนสารอาหาร (7 วัน)</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-[110px] h-[110px] relative flex-shrink-0">
            {(summary?.macro_totals?.protein ?? totalMacros.protein) === 0 && (summary?.macro_totals?.carbs ?? totalMacros.carbs) === 0 && (summary?.macro_totals?.fat ?? totalMacros.fat) === 0 ? (
              <div className="w-full h-full rounded-full border-4 border-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground text-center leading-tight">ยังไม่มีข้อมูล</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macroData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                    {macroData.map((entry, i) => <Cell key={`m-${i}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex-1 space-y-2.5">
            {macroData.map(m => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.fill }} />
                  <span className="text-xs font-medium text-muted-foreground">{m.name}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{Math.round(m.value)}g</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCAN HISTORY ── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <p className="font-bold text-sm text-foreground">ประวัติการสแกนฉลาก</p>
        </div>
        {scanHistoryData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">ยังไม่มีประวัติสแกนสินค้า</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {[...scanHistoryData].reverse().slice(0, 10).map(r => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-semibold text-foreground truncate">{r.productName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.date} · {r.calories} kcal · น้ำตาล {r.sugar}g · โซเดียม {r.sodium}mg
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-sm font-extrabold ${r.score >= 70 ? "text-primary" : r.score >= 50 ? "text-secondary" : "text-destructive"}`}>
                    {r.score}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
