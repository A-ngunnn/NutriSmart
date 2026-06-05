"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Scale, Ruler, Activity, Save, RefreshCw, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface ProfileData {
  name: string
  age: string
  gender: string
  weight: string   // kg
  height: string   // cm
  activityLevel: string
  goal: string
}

interface ProfilePageProps {
  profile: ProfileData
  onSave: (profile: ProfileData) => void
}

const ACTIVITY_LEVELS = [
  { value: "sedentary",   label: "นั่งทำงาน ไม่เคลื่อนไหว", factor: 1.2   },
  { value: "light",       label: "ออกกำลังกาย 1-3 วัน/สัปดาห์", factor: 1.375 },
  { value: "moderate",    label: "ออกกำลังกาย 3-5 วัน/สัปดาห์", factor: 1.55  },
  { value: "active",      label: "ออกกำลังกาย 6-7 วัน/สัปดาห์", factor: 1.725 },
  { value: "very_active", label: "นักกีฬา / งานหนักมาก", factor: 1.9   },
]

const GOALS = [
  { value: "lose",     label: "ลดน้ำหนัก" },
  { value: "maintain", label: "รักษาน้ำหนัก" },
  { value: "gain",     label: "เพิ่มน้ำหนัก / กล้ามเนื้อ" },
]

function calcBMI(w: number, h: number) {
  if (!w || !h) return 0
  return parseFloat((w / ((h / 100) ** 2)).toFixed(1))
}
function calcBMR(w: number, h: number, a: number, g: string) {
  if (!w || !h || !a) return 0
  return g === "female" ? 10*w + 6.25*h - 5*a - 161 : 10*w + 6.25*h - 5*a + 5
}
function calcTDEE(bmr: number, activity: string, goal: string) {
  const f = ACTIVITY_LEVELS.find(a => a.value === activity)?.factor ?? 1.2
  let t = bmr * f
  if (goal === "lose") t -= 500
  if (goal === "gain") t += 500
  return Math.round(t)
}
function bmiInfo(bmi: number) {
  if (bmi === 0) return { text: "ยังไม่มีข้อมูล", color: "text-muted-foreground", pct: 0 }
  if (bmi < 18.5) return { text: "น้ำหนักน้อย", color: "text-blue-500", pct: (bmi / 40) * 100 }
  if (bmi < 23)   return { text: "สมส่วน (เกณฑ์ไทย)", color: "text-primary", pct: (bmi / 40) * 100 }
  if (bmi < 25)   return { text: "สมส่วน (เกณฑ์ตะวันตก)", color: "text-primary", pct: (bmi / 40) * 100 }
  if (bmi < 30)   return { text: "น้ำหนักเกิน", color: "text-secondary", pct: (bmi / 40) * 100 }
  return { text: "โรคอ้วน", color: "text-destructive", pct: Math.min((bmi / 40) * 100, 100) }
}

// BMI scale bar zones
const BMI_ZONES = [
  { label: "<18.5", color: "bg-blue-400",       w: "23%"  },
  { label: "18.5-23", color: "bg-primary",      w: "11%"  },
  { label: "23-25", color: "bg-yellow-400",     w: "5%"   },
  { label: "25-30", color: "bg-secondary",      w: "12%"  },
  { label: ">30", color: "bg-destructive",      w: "49%"  },
]

const profileSchema = z.object({
  name: z.string().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร"),
  age: z.coerce.number().min(10).max(100).transform(String),
  gender: z.enum(["male", "female", "other"]),
  weight: z.coerce.number().min(20).max(300).transform(String),
  height: z.coerce.number().min(100).max(250).transform(String),
  activityLevel: z.string(),
  goal: z.string(),
})

export default function ProfilePage({ profile, onSave }: ProfilePageProps) {
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile,
  })

  const w = parseFloat(watch("weight")) || 0
  const h = parseFloat(watch("height")) || 0
  const a = parseFloat(watch("age")) || 0
  const g = watch("gender")
  const act = watch("activityLevel")
  const goal = watch("goal")

  const bmi = calcBMI(w, h)
  const bmr = calcBMR(w, h, a, g)
  const tdee = calcTDEE(bmr, act, goal)
  const info = bmiInfo(bmi)

  // Recommended macros (based on TDEE)
  const macros = tdee > 0 ? {
    protein: Math.round((tdee * 0.25) / 4),
    carbs:   Math.round((tdee * 0.45) / 4),
    fat:     Math.round((tdee * 0.30) / 9),
  } : null

  const initials = (profile.name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  const onSubmit = (data: ProfileData) => {
    onSave(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">

      {/* ── Avatar + Summary Row ── */}
      <div className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0 shadow-lg">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-lg text-foreground truncate">{profile.name || "ผู้ใช้ NutriSmart"}</p>
          <p className="text-sm text-muted-foreground">{profile.age ? `อายุ ${profile.age} ปี` : "ยังไม่มีข้อมูล"} · {profile.gender === "male" ? "ชาย" : profile.gender === "female" ? "หญิง" : "ไม่ระบุ"}</p>
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{w ? `${w} kg` : "—"}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{h ? `${h} cm` : "—"}</span>
          </div>
        </div>
      </div>

      {/* ── BMI + TDEE Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-border p-4 text-center">
          <p className="text-[11px] text-muted-foreground mb-1">ดัชนีมวลกาย BMI</p>
          <p className={`text-3xl font-extrabold ${info.color}`}>{bmi || "—"}</p>
          <p className={`text-[11px] font-semibold mt-1 ${info.color}`}>{info.text}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 text-center">
          <p className="text-[11px] text-muted-foreground mb-1">TDEE เป้าหมายต่อวัน</p>
          <p className="text-3xl font-extrabold text-primary">{tdee > 0 ? tdee.toLocaleString() : "—"}</p>
          <p className="text-[11px] text-primary font-semibold mt-1">kcal</p>
        </div>
      </div>

      {/* ── BMI Scale Bar ── */}
      {bmi > 0 && (
        <div className="bg-white rounded-2xl border border-border p-4">
          <p className="text-sm font-bold text-foreground mb-3">ตำแหน่ง BMI ของคุณ</p>
          <div className="relative h-4 flex rounded-full overflow-hidden mb-4">
            {BMI_ZONES.map(z => (
              <div key={z.label} className={`${z.color} h-full`} style={{ width: z.w }} />
            ))}
            {/* Marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${Math.min(info.pct, 98)}%` }}
            >
              <div className="w-4 h-4 bg-white border-2 border-foreground rounded-full shadow" />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>ต่ำกว่าเกณฑ์</span>
            <span>สมส่วน</span>
            <span>เกินเกณฑ์</span>
            <span>อ้วน</span>
          </div>
        </div>
      )}

      {/* ── Macros Target (if TDEE calculated) ── */}
      {macros && (
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">เป้าหมายสารอาหารต่อวัน</p>
              <p className="text-xs text-muted-foreground">คำนวณจาก TDEE {tdee.toLocaleString()} kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "โปรตีน", value: macros.protein, unit: "g", color: "text-blue-600", bg: "bg-blue-50", bar: "bg-blue-400" },
              { label: "คาร์บ",   value: macros.carbs,   unit: "g", color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-400" },
              { label: "ไขมัน",  value: macros.fat,     unit: "g", color: "text-red-600", bg: "bg-red-50", bar: "bg-red-400" },
            ].map(m => (
              <div key={m.label} className={`${m.bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-extrabold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{m.unit}/วัน</p>
                <p className={`text-[11px] font-bold mt-1 ${m.color}`}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <div className="bg-white rounded-2xl border border-border p-4">
        <h2 className="font-bold text-base text-foreground mb-4">แก้ไขข้อมูลส่วนตัว</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">ชื่อ-นามสกุล</Label>
              <Input placeholder="เช่น สมชาย ใจดี" {...register("name")}
                className={`h-11 ${errors.name ? "border-destructive" : ""}`} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">อายุ (ปี)</Label>
              <Input type="number" inputMode="numeric" placeholder="25" {...register("age")}
                className={`h-11 ${errors.age ? "border-destructive" : ""}`} />
              {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm font-medium">เพศ</Label>
              <Select value={watch("gender")} onValueChange={v => setValue("gender", v, { shouldValidate: true })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="เลือกเพศ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ชาย</SelectItem>
                  <SelectItem value="female">หญิง</SelectItem>
                  <SelectItem value="other">ไม่ระบุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-secondary" /> ข้อมูลร่างกาย
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">น้ำหนัก (kg)</Label>
                <div className="relative">
                  <Input type="number" inputMode="decimal" step="0.1" placeholder="65" {...register("weight")}
                    className={`h-11 pr-10 ${errors.weight ? "border-destructive" : ""}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                </div>
                {errors.weight && <p className="text-xs text-destructive">{errors.weight.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">ส่วนสูง (cm)</Label>
                <div className="relative">
                  <Input type="number" inputMode="numeric" placeholder="170" {...register("height")}
                    className={`h-11 pr-10 ${errors.height ? "border-destructive" : ""}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                </div>
                {errors.height && <p className="text-xs text-destructive">{errors.height.message}</p>}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> กิจกรรมและเป้าหมาย
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">ระดับกิจกรรม</Label>
              <Select value={watch("activityLevel")} onValueChange={v => setValue("activityLevel", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVELS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">เป้าหมาย</Label>
              <div className="grid grid-cols-3 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.value} type="button"
                    onClick={() => setValue("goal", g.value)}
                    className={`h-12 rounded-xl text-xs font-semibold border transition-all ${
                      watch("goal") === g.value
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {g.value === "lose" ? "🏃 ลดน้ำหนัก" : g.value === "maintain" ? "⚖️ รักษาน้ำหนัก" : "💪 เพิ่มกล้าม"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1 h-11 font-semibold flex items-center gap-2">
              <Save className="w-4 h-4" />
              บันทึกโปรไฟล์
            </Button>
            <Button type="button" variant="outline" onClick={() => { reset(profile); setSaved(false) }} className="h-11 px-4">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {saved && (
            <p className="text-center text-sm text-primary font-medium animate-in fade-in zoom-in duration-300">
              ✅ บันทึกเรียบร้อยแล้ว!
            </p>
          )}
        </form>
      </div>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed pb-4">
        คำนวณโดยสูตร Mifflin-St Jeor · เกณฑ์ BMI ไทย (Asian Cut-off) · ไม่ใช่คำแนะนำทางการแพทย์
      </p>
    </div>
  )
}
