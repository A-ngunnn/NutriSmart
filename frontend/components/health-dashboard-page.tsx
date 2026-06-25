'use client'

import { useState, useMemo } from 'react'
import { Sparkles, Activity, Droplets, Candy, Target, Flame, Award, Camera, TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, ReferenceLine, LabelList,
} from 'recharts'
import { type HealthSummary, fetchAiHealthInsights } from '@/lib/backend-api'

type Period = 'weekly' | 'monthly' | 'yearly'

const FALLBACK_WEEKLY = [
  { day: 'จ', cal: 0, goal: 2000 },
  { day: 'อ', cal: 0, goal: 2000 },
  { day: 'พ', cal: 0, goal: 2000 },
  { day: 'พฤ', cal: 0, goal: 2000 },
  { day: 'ศ', cal: 0, goal: 2000 },
  { day: 'ส', cal: 0, goal: 2000 },
  { day: 'อา', cal: 0, goal: 2000 },
]

const FALLBACK_MONTHLY = [
  { week: 'สัปดาห์ 1', cal: 0 },
  { week: 'สัปดาห์ 2', cal: 0 },
  { week: 'สัปดาห์ 3', cal: 0 },
  { week: 'สัปดาห์ 4', cal: 0 },
]

const FALLBACK_YEARLY = Array.from({ length: 12 }, (_, i) => ({
  month: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][i],
  cal: 0,
}))

const FALLBACK_MACROS = [
  { name: 'โปรตีน', value: 0, color: '#3b82f6' },
  { name: 'คาร์บ', value: 0, color: '#f97316' },
  { name: 'ไขมัน', value: 0, color: '#ef4444' },
]

const FALLBACK_INSIGHTS: Record<Period, string[]> = {
  weekly: ['ยังไม่มีข้อมูลเพียงพอในสัปดาห์นี้ บันทึกอาหารและสแกนต่อเนื่องเพื่อดู Insight ส่วนตัว'],
  monthly: ['ยังไม่มีข้อมูลเพียงพอในเดือนนี้ บันทึกอาหารและสแกนต่อเนื่องเพื่อดู Insight ส่วนตัว'],
  yearly: ['ยังไม่มีข้อมูลเพียงพอในปีนี้ บันทึกอาหารและสแกนต่อเนื่องเพื่อดู Insight ส่วนตัว'],
}

function buildInsights(period: Period, summary: HealthSummary): string[] {
  const tips: string[] = []
  const stats = period === 'weekly' ? null
    : period === 'monthly' ? summary.monthly_stats
      : summary.yearly_stats

  const avgCal = period === 'weekly' ? summary.avg_calories : stats?.avg_calories ?? 0
  if (avgCal > 0 && summary.tdee > 0) {
    const diffPct = Math.round(((avgCal - summary.tdee) / summary.tdee) * 100)
    if (diffPct > 5) {
      tips.push(`แคลอรีเฉลี่ยสูงกว่าเป้าหมาย (TDEE) อยู่ ${diffPct}% ลองลดมื้อเย็นหรือของว่างที่แคลอรีสูง`)
    } else if (diffPct < -5) {
      tips.push(`แคลอรีเฉลี่ยต่ำกว่าเป้าหมาย (TDEE) อยู่ ${Math.abs(diffPct)}% หากไม่ได้ตั้งใจลดน้ำหนัก ควรทานเพิ่ม`)
    } else {
      tips.push('แคลอรีเฉลี่ยใกล้เคียงเป้าหมาย (TDEE) มาก รักษาพฤติกรรมนี้ไว้ได้เลย')
    }
  }

  const mt = summary.macro_totals
  const macroTotal = mt.protein + mt.carbs + mt.fat
  if (macroTotal > 0) {
    const proteinPct = Math.round((mt.protein / macroTotal) * 100)
    if (proteinPct < 15) {
      tips.push(`สัดส่วนโปรตีนอยู่ที่ ${proteinPct}% ของมาโครทั้งหมด ต่ำกว่าเกณฑ์แนะนำ ลองเพิ่มไข่ เนื้อปลา หรือถั่ว`)
    }
  }

  if (period === 'weekly' && summary.last_7_days.length > 0) {
    const overGoalDays = summary.last_7_days.filter(d => d.calories > summary.tdee).length
    if (overGoalDays > 0) {
      tips.push(`${overGoalDays} วันในสัปดาห์นี้ทานเกินเป้าหมายแคลอรี ลองวางแผนมื้ออาหารล่วงหน้า`)
    }
  }

  const scanCount = period === 'weekly' ? summary.scan_count : stats?.scan_count ?? 0
  if (scanCount > 0) {
    tips.push(`บันทึก/สแกนอาหารไปแล้ว ${scanCount} รายการในช่วงนี้ รักษาความต่อเนื่องนี้ไว้!`)
  }

  return tips.length > 0 ? tips : FALLBACK_INSIGHTS[period]
}

const MOCK_STATS: Record<Period, { avgCal: string; avgScore: string; totalScans: string }> = {
  weekly: { avgCal: '—', avgScore: '—', totalScans: '—' },
  monthly: { avgCal: '—', avgScore: '—', totalScans: '—' },
  yearly: { avgCal: '—', avgScore: '—', totalScans: '—' },
}

// อ้างอิง Thai RDI: โซเดียมไม่เกิน 2,000mg/วัน, น้ำตาลไม่เกิน 24g/วัน
const SODIUM_RDI = 2000
const SUGAR_RDI = 24

function rdiBarColor(pct: number) {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 70) return 'bg-orange-400'
  return 'bg-primary'
}

function goalHitRate(values: number[], goal: number) {
  const logged = values.filter(v => v > 0)
  if (logged.length === 0) return null
  const hit = logged.filter(v => v <= goal * 1.05).length
  return { hit, total: logged.length }
}

function calcDomain(values: number[]): [number, number] {
  const max = Math.max(...values, 0)
  if (max <= 0) return [0, 2500]
  return [0, Math.ceil((max * 1.15) / 200) * 200]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-primary">{payload[0].value.toLocaleString()} kcal</p>
    </div>
  )
}

interface HealthTabProps {
  summary?: HealthSummary | null
}

export default function HealthDashboardPage({ summary }: HealthTabProps) {
  const [period, setPeriod] = useState<Period>('weekly')

  const weeklyGoal = summary?.tdee ?? 2000
  const weeklyData = summary?.last_7_days.map(d => ({
    day: d.label,
    cal: d.calories,
    goal: weeklyGoal,
  })) ?? FALLBACK_WEEKLY

  const mt = summary?.macro_totals
  const macroTotal = mt ? mt.protein + mt.carbs + mt.fat : 0
  const macroData = macroTotal > 0
    ? [
      { name: 'โปรตีน', value: Math.round((mt!.protein / macroTotal) * 100), color: '#3b82f6' },
      { name: 'คาร์บ', value: Math.round((mt!.carbs / macroTotal) * 100), color: '#f97316' },
      { name: 'ไขมัน', value: Math.round((mt!.fat / macroTotal) * 100), color: '#ef4444' },
    ]
    : FALLBACK_MACROS

  const toStats = (avg_cal: number, avg_score: number, count: number) => ({
    avgCal: avg_cal > 0 ? Math.round(avg_cal).toLocaleString() : '—',
    avgScore: avg_score > 0 ? String(Math.round(avg_score)) : '—',
    totalScans: count.toLocaleString(),
  })

  const templateInsights = useMemo(
    () => (summary ? buildInsights(period, summary) : FALLBACK_INSIGHTS[period]),
    [summary, period]
  )

  // ── AI Insight จริง (MedGemma + RAG) — เรียกเฉพาะตอนกดปุ่ม ไม่ auto-call ทุกครั้งที่เปิดหน้า
  // เพื่อประหยัดโควตา AI ค่าเริ่มต้นคือ insight แบบ template (ฟรี, ทันที) ของเดิม
  const [aiInsights, setAiInsights] = useState<string[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const insights = aiInsights ?? templateInsights
  const usingAiInsights = aiInsights !== null

  const handleAnalyzeWithAi = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await fetchAiHealthInsights(period)
      setAiInsights(result)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'วิเคราะห์ด้วย AI ไม่สำเร็จ')
    } finally {
      setAiLoading(false)
    }
  }

  const statsMap = summary
    ? {
      weekly: toStats(summary.avg_calories, summary.avg_scan_score, summary.scan_count),
      monthly: toStats(summary.monthly_stats.avg_calories, summary.monthly_stats.avg_scan_score, summary.monthly_stats.scan_count),
      yearly: toStats(summary.yearly_stats.avg_calories, summary.yearly_stats.avg_scan_score, summary.yearly_stats.scan_count),
    }
    : MOCK_STATS
  const stats = statsMap[period]

  const chartData =
    period === 'weekly' ? weeklyData :
      period === 'monthly' ? (summary?.monthly_data ?? FALLBACK_MONTHLY) :
        (summary?.yearly_data ?? FALLBACK_YEARLY)

  const weeklyDomain  = useMemo(() => calcDomain([...weeklyData.map(d => d.cal), weeklyGoal]), [weeklyData, weeklyGoal])
  const monthlyDomain = useMemo(() => calcDomain([...(summary?.monthly_data ?? FALLBACK_MONTHLY).map(d => d.cal), weeklyGoal]), [summary, weeklyGoal])
  const yearlyDomain  = useMemo(() => calcDomain([...(summary?.yearly_data ?? FALLBACK_YEARLY).map(d => d.cal), weeklyGoal]), [summary, weeklyGoal])

  // ── ใช้ scan_history (มีอยู่แล้วใน HealthSummary แต่ยังไม่เคยถูกใช้) เพื่อสรุปโซเดียม/น้ำตาลเทียบ Thai RDI ──
  const periodScans = useMemo(() => {
    const history = summary?.scan_history ?? []
    if (period === 'weekly') {
      const weekDates = new Set((summary?.last_7_days ?? []).map(d => d.date))
      return history.filter(s => weekDates.has(s.date))
    }
    const now = new Date()
    if (period === 'monthly') {
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      return history.filter(s => s.date.startsWith(prefix))
    }
    return history.filter(s => s.date.startsWith(String(now.getFullYear())))
  }, [summary, period])

  const avgSodium = periodScans.length > 0 ? periodScans.reduce((s, e) => s + e.sodium, 0) / periodScans.length : 0
  const avgSugar  = periodScans.length > 0 ? periodScans.reduce((s, e) => s + e.sugar, 0) / periodScans.length : 0

  const goalHit = useMemo(() => {
    const values = chartData.map((d: { cal: number }) => d.cal)
    return goalHitRate(values, period === 'weekly' ? weeklyGoal : weeklyGoal)
  }, [chartData, weeklyGoal, period])

  return (
    <div className="p-4 space-y-4 lg:space-y-6 pb-24 max-w-2xl lg:max-w-6xl mx-auto">

      {/* Title Header */}
      <div className="pt-2 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <TrendingUp size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">วิเคราะห์สุขภาพ</h1>
          <p className="text-xs text-muted-foreground font-medium">สถิติและแนวโน้มด้านโภชนาการส่วนบุคคล</p>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="bg-muted rounded-2xl p-1 flex gap-1 border border-border/40">
        {([['weekly', 'รายสัปดาห์'], ['monthly', 'รายเดือน'], ['yearly', 'รายปี']] as [Period, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setPeriod(key); setAiInsights(null); setAiError(null) }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${period === key ? 'bg-white text-primary shadow-sm border border-border/10' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {[
          { label: 'แคลอรีเฉลี่ย/วัน', value: stats.avgCal, unit: 'kcal', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'คะแนนสแกนเฉลี่ย', value: stats.avgScore, unit: 'pts', icon: Award, color: 'text-violet-500', bg: 'bg-violet-50' },
          { label: 'รายการที่สแกน', value: stats.totalScans, unit: 'รายการ', icon: Camera, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'ทำได้ตามเป้าหมาย', value: goalHit ? `${goalHit.hit}/${goalHit.total}` : '—', unit: 'วัน/ช่วง', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(s => {
          const StatIcon = s.icon
          return (
            <div key={s.label} className="bg-card rounded-2xl p-2.5 sm:p-3 shadow-sm border border-border flex flex-col gap-1.5">
              <div className={`w-7 h-7 rounded-xl ${s.bg} flex items-center justify-center`}>
                <StatIcon size={14} className={s.color} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground leading-tight">{s.label} <span className="opacity-60">({s.unit})</span></p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <div className="xl:col-span-2 space-y-4 lg:space-y-6">

          {/* Calories Trend Chart */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Flame size={14} className="text-orange-500" />
                </span>
                แนวโน้มพลังงาน (kcal)
              </h2>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                เป้าหมาย {weeklyGoal.toLocaleString()} kcal/วัน
              </span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              {period === 'weekly' ? (
                <BarChart data={chartData} margin={{ top: 16, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={weeklyDomain} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={weeklyGoal} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Bar dataKey="cal" radius={[6, 6, 0, 0]}>
                    {(chartData as typeof weeklyData).map((entry, i) => (
                      <Cell key={i} fill={entry.cal > (entry.goal ?? weeklyGoal) ? '#f97316' : '#41a347'} />
                    ))}
                    <LabelList dataKey="cal" position="top" style={{ fontSize: 10, fontWeight: 600, fill: '#52525b' }}
                      formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
                  </Bar>
                </BarChart>
              ) : period === 'monthly' ? (
                <BarChart data={chartData} margin={{ top: 16, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={monthlyDomain} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={weeklyGoal} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Bar dataKey="cal" fill="#41a347" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="cal" position="top" style={{ fontSize: 10, fontWeight: 600, fill: '#52525b' }}
                      formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 16, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={yearlyDomain} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={weeklyGoal} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="cal" stroke="#41a347" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#41a347', strokeWidth: 0 }} />
                </LineChart>
              )}
            </ResponsiveContainer>

            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="w-3 border-t border-dashed border-gray-400 inline-block" /> เส้นประ = เป้าหมายแคลอรี
            </p>

            {period === 'weekly' && (
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#41a347] inline-block" /> ภายในเป้าหมาย
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> เกินเป้าหมาย
                </span>
              </div>
            )}
          </div>

          {/* ── AI Insights — ใช้สีม่วงแทนเขียว ให้ดูเป็นโซน "AI" ที่แยกจากโซนสุขภาพ/เป้าหมาย (เขียว) ── */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center border border-violet-100/50">
                  <Sparkles size={15} />
                </div>
                <h2 className="font-semibold text-sm text-foreground">AI Health Insights</h2>
                {usingAiInsights && (
                  <span className="text-[9px] font-semibold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">AI วิเคราะห์จริง</span>
                )}
              </div>
              <button
                onClick={handleAnalyzeWithAi}
                disabled={aiLoading}
                title={usingAiInsights ? 'วิเคราะห์ใหม่อีกครั้ง' : 'ให้ AI วิเคราะห์เชิงลึกตามบริบทจริงของคุณ'}
                className="shrink-0 text-[11px] font-semibold text-violet-500 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : usingAiInsights ? <RefreshCw size={12} /> : <Sparkles size={12} />}
                {aiLoading ? 'กำลังวิเคราะห์...' : usingAiInsights ? 'วิเคราะห์ใหม่' : 'วิเคราะห์ด้วย AI'}
              </button>
            </div>

            {aiError && <p className="text-[11px] text-destructive mb-2">{aiError}</p>}

            <div className="space-y-2.5">
              {insights.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 bg-violet-50/40 border border-violet-100/30 rounded-2xl">
                  {/* เปลี่ยนเป็นจุด Sparkle Dot อ่อน ๆ ดูไฮเทค ไม่รกสายตา */}
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-2" />
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">{tip}</p>
                </div>
              ))}
            </div>

            {!usingAiInsights && (
              <p className="text-[10px] text-muted-foreground mt-2.5">
                ข้อความข้างบนเป็น insight แบบเทียบเกณฑ์อัตโนมัติ — กด &quot;วิเคราะห์ด้วย AI&quot; เพื่อให้ AI อ่านบริบทจริงของคุณ (โรคประจำตัว/แนวโน้ม) แทน
              </p>
            )}
          </div>

        </div>{/* end left column */}

        {/* ── Right rail: macros donut ── */}
        <div className="space-y-4 lg:space-y-6">
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center">
                <Activity size={14} className="text-blue-500" />
              </span>
              สัดส่วนสารอาหารหลัก
            </h2>
            <div className="flex items-center gap-6">
              <PieChart width={110} height={110}>
                <Pie data={macroData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" strokeWidth={0}>
                  {macroData.map((entry: { color: string }, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {macroData.map((m: { name: string; value: number; color: string }) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="text-xs font-medium text-muted-foreground">{m.name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{m.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── โซเดียม & น้ำตาลเฉลี่ย เทียบ Thai RDI (จากผลสแกนในช่วงนี้) ── */}
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center">
                <Target size={14} className="text-red-500" />
              </span>
              โซเดียม & น้ำตาลเฉลี่ย
            </h2>
            {periodScans.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีผลสแกนในช่วงนี้ — สแกนฉลากเพื่อติดตามโซเดียม/น้ำตาล</p>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'โซเดียม', icon: Droplets, value: avgSodium, rdi: SODIUM_RDI, unit: 'mg' },
                  { label: 'น้ำตาล', icon: Candy, value: avgSugar, rdi: SUGAR_RDI, unit: 'g' },
                ].map(m => {
                  const pct = Math.round((m.value / m.rdi) * 100)
                  const Icon = m.icon
                  return (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Icon size={12} /> {m.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">
                          {Math.round(m.value).toLocaleString()}{m.unit} <span className="text-muted-foreground font-normal">/ {m.rdi.toLocaleString()}{m.unit}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${rdiBarColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      {pct >= 100 && (
                        <p className="text-[10px] text-red-500 mt-1">เกิน Thai RDI แล้ว ลองลดอาหารแปรรูป/ของหวานในมื้อถัดไป</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>{/* end right rail */}

      </div>{/* end grid */}

    </div>
  )
}