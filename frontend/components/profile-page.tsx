'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Edit2, Check, Ruler, Weight, ChevronRight, ShieldCheck, Bell, HelpCircle, FileText, Flame, Dumbbell, TrendingDown, TrendingUp, Minus, Activity, Camera, X, LogOut, User, Star } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export type ProfileInternal = {
  firstName: string
  lastName: string
  age: number
  gender: string
  weight: number
  height: number
  goal: string
  activityDays: number
  avatarUrl?: string
  email?: string
}

interface ProfileTabProps {
  initialData?: Partial<ProfileInternal>
  onSave?: (data: ProfileInternal) => void
  onAvatarChange?: (url: string) => void
}

function calcBMI(weight: number, height: number) {
  const h = height / 100
  return parseFloat((weight / (h * h)).toFixed(1))
}

function bmiStatus(bmi: number) {
  if (bmi < 18.5) return { label: 'น้ำหนักต่ำกว่าเกณฑ์', color: '#3b82f6', bg: 'bg-blue-50', textClass: 'text-blue-500' }
  if (bmi < 23) return { label: 'สมส่วน', color: '#16a34a', bg: 'bg-green-50', textClass: 'text-green-600' }
  if (bmi < 25) return { label: 'ท้วม', color: '#ca8a04', bg: 'bg-yellow-50', textClass: 'text-yellow-600' }
  if (bmi < 30) return { label: 'น้ำหนักเกิน', color: '#ea580c', bg: 'bg-orange-50', textClass: 'text-orange-500' }
  return { label: 'อ้วน', color: '#dc2626', bg: 'bg-red-50', textClass: 'text-red-500' }
}

function activityFactor(days: number) {
  if (days === 0) return 1.2
  if (days <= 2) return 1.375
  if (days <= 4) return 1.55
  if (days <= 6) return 1.725
  return 1.9
}

function calcTDEE(weight: number, height: number, age: number, gender: string, activityDays: number) {
  const bmr = gender === 'ชาย'
    ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
    : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age
  return Math.round(bmr * activityFactor(activityDays))
}

function goalCalorieAdjust(goal: string): number {
  if (goal === 'ลดน้ำหนัก') return -500
  if (goal === 'เพิ่มน้ำหนัก') return 500
  if (goal === 'เพิ่มกล้ามเนื้อ') return 300
  return 0
}

const GOALS = [
  { id: 'ลดน้ำหนัก', icon: TrendingDown, color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-500', activeText: 'text-white' },
  { id: 'เพิ่มกล้ามเนื้อ', icon: Dumbbell, color: 'text-green-600', bg: 'bg-green-50', activeBg: 'bg-green-600', activeText: 'text-white' },
  { id: 'เพิ่มน้ำหนัก', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50', activeBg: 'bg-orange-500', activeText: 'text-white' },
  { id: 'รักษาน้ำหนัก', icon: Minus, color: 'text-violet-500', bg: 'bg-violet-50', activeBg: 'bg-violet-500', activeText: 'text-white' },
]

const ACTIVITY_LEVELS = [
  { days: 0, label: 'ไม่ออกกำลังกาย', sub: '0 วัน/สัปดาห์' },
  { days: 2, label: 'เบา', sub: '1-2 วัน/สัปดาห์' },
  { days: 4, label: 'ปานกลาง', sub: '3-4 วัน/สัปดาห์' },
  { days: 6, label: 'หนัก', sub: '5-6 วัน/สัปดาห์' },
  { days: 7, label: 'หนักมาก', sub: 'ทุกวัน' },
]

const bmiSegments = [
  { label: 'ต่ำ', color: '#93c5fd', from: 10, to: 18.5 },
  { label: 'สมส่วน', color: '#4ade80', from: 18.5, to: 23 },
  { label: 'ท้วม', color: '#fde047', from: 23, to: 25 },
  { label: 'เกิน', color: '#fb923c', from: 25, to: 30 },
  { label: 'อ้วน', color: '#f87171', from: 30, to: 40 },
]
const BMI_MIN = 10, BMI_MAX = 40

export default function ProfileTab({ initialData, onSave, onAvatarChange }: ProfileTabProps) {
  const router = useRouter()
  const { clearState } = useAppStore()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearState()
    router.push("/")
  }

  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState({
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    age: initialData?.age ?? 28,
    gender: initialData?.gender ?? 'ชาย',
    weight: initialData?.weight ?? 65,
    height: initialData?.height ?? 170,
  })
  const [draft, setDraft] = useState({ ...profile })
  const [goal, setGoal] = useState(initialData?.goal ?? 'รักษาน้ำหนัก')
  const [activityDays, setActivityDays] = useState(initialData?.activityDays ?? 4)
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl ?? '')

  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const goalLoaded = useRef(false)

  useEffect(() => {
    if (!initialData || editing) return
    const next = {
      firstName: initialData.firstName ?? '',
      lastName: initialData.lastName ?? '',
      age: initialData.age ?? 28,
      gender: initialData.gender ?? 'ชาย',
      weight: initialData.weight ?? 65,
      height: initialData.height ?? 170,
    }
    setProfile(next)
    setDraft(next)
    if (initialData.avatarUrl !== undefined) {
      setAvatarUrl(initialData.avatarUrl)
    }
    if (!goalLoaded.current) {
      setGoal(initialData.goal ?? 'รักษาน้ำหนัก')
      setActivityDays(initialData.activityDays ?? 4)
      if (initialData.goal != null || initialData.activityDays != null) {
        goalLoaded.current = true
      }
    }
  }, [initialData])

  const bmi = calcBMI(profile.weight, profile.height)
  const status = bmiStatus(bmi)
  const tdee = calcTDEE(profile.weight, profile.height, profile.age, profile.gender, activityDays)
  const targetCalories = tdee + goalCalorieAdjust(goal)
  const macros = {
    protein: Math.round(profile.weight * (goal === 'เพิ่มกล้ามเนื้อ' ? 2.2 : 1.8)),
    carbs: Math.round((targetCalories * 0.50) / 4),
    fat: Math.round((targetCalories * 0.25) / 9),
  }
  const indicatorPos = Math.min(100, Math.max(0, ((bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100))

  const handleSave = () => {
    setProfile({ ...draft })
    setEditing(false)
    onSave?.({ ...draft, goal, activityDays, avatarUrl })
  }
  const handleCancel = () => { setDraft({ ...profile }); setEditing(false) }

  const initials = ((profile.firstName || 'ผ')[0] + (profile.lastName ? profile.lastName[0] : '')).toUpperCase()

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) {
        setAvatarUrl(dataUrl)
        setShowAvatarDialog(false)
        onAvatarChange?.(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="p-4 space-y-4 lg:space-y-6 pb-8 max-w-2xl lg:max-w-6xl mx-auto">
      <div className="pt-2 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <User size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">โปรไฟล์</h1>
          <p className="text-sm text-muted-foreground">ข้อมูลส่วนตัวและเป้าหมายสุขภาพ</p>
        </div>
      </div>

      {/* Profile Identity Card */}
      <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
              ) : (
                <span className="text-2xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <button
              onClick={() => setShowAvatarDialog(true)}
              aria-label="เปลี่ยนรูปโปรไฟล์"
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'ผู้ใช้ NutriSmart'}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.age} ปี · {profile.gender}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Weight size={11} />{profile.weight} kg</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Ruler size={11} />{profile.height} cm</span>
            </div>
          </div>
          <button
            onClick={() => setEditing(e => !e)}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted px-3 py-1.5 rounded-full shrink-0"
          >
            <Edit2 size={12} />แก้ไข
          </button>
        </div>

        {/* Inline Edit Form */}
        {editing && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ชื่อ</label>
                <input value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">นามสกุล</label>
                <input value={draft.lastName} onChange={e => setDraft(d => ({ ...d, lastName: e.target.value }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">อายุ (ปี)</label>
                <input type="number" value={draft.age} onChange={e => setDraft(d => ({ ...d, age: Number(e.target.value) }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">เพศ</label>
                <select value={draft.gender} onChange={e => setDraft(d => ({ ...d, gender: e.target.value }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50">
                  <option>ชาย</option>
                  <option>หญิง</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">น้ำหนัก (kg)</label>
                <input type="number" value={draft.weight} onChange={e => setDraft(d => ({ ...d, weight: Number(e.target.value) }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ส่วนสูง (cm)</label>
                <input type="number" value={draft.height} onChange={e => setDraft(d => ({ ...d, height: Number(e.target.value) }))}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none focus:border-primary/50" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCancel}
                className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-semibold">
                ยกเลิก
              </button>
              <button onClick={handleSave}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
                <Check size={15} />บันทึก
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid Layout สำหรับแสดงเนื้อหาแยกเป็น 2 ฝั่งบนหน้าจอคอม */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">

        {/* ── ฝั่งซ้าย: สรุปผล BMI และค่าพลังงาน ── */}
        <div className="xl:col-span-2 space-y-4 lg:space-y-6">
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">ดัชนีมวลกาย (BMI)</h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.bg} ${status.textClass}`}>
                {status.label}
              </span>
            </div>

            <div className="flex items-end justify-center gap-2 mb-5">
              <span className={`text-6xl font-black ${status.textClass}`}>{bmi}</span>
              <span className="text-muted-foreground text-sm mb-2">kg/m²</span>
            </div>

            <div className="relative mb-2">
              <div className="flex h-4 rounded-full overflow-hidden">
                {bmiSegments.map(seg => (
                  <div key={seg.label}
                    style={{ width: `${((seg.to - seg.from) / (BMI_MAX - BMI_MIN)) * 100}%`, background: seg.color }} />
                ))}
              </div>
              <div className="absolute top-0 h-4 transition-all duration-700 pointer-events-none"
                style={{ left: `clamp(6px, calc(${indicatorPos}% - 6px), calc(100% - 18px))` }}>
                <div className="w-3 h-4 flex flex-col items-center">
                  <div className="w-0.5 h-full bg-foreground rounded-full" />
                  <div className="w-2 h-2 rounded-full bg-foreground -mt-1 absolute bottom-0" />
                </div>
              </div>
            </div>
            <div className="flex justify-between px-0.5 mt-1">
              {bmiSegments.map(seg => (
                <div key={seg.label} className="relative text-center" style={{ width: `${((seg.to - seg.from) / (BMI_MAX - BMI_MIN)) * 100}%` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <p className="text-[10px] font-medium text-muted-foreground leading-tight">{seg.label}</p>
                    <p className="text-[9px] text-muted-foreground">{seg.from}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">TDEE (ฐาน)</p>
                  <p className="text-lg font-bold text-foreground">{tdee.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">เป้าหมาย ({goal})</p>
                  <p className={`text-lg font-bold ${goalCalorieAdjust(goal) < 0 ? 'text-blue-500' : goalCalorieAdjust(goal) > 0 ? 'text-orange-500' : 'text-primary'}`}>
                    {targetCalories.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">kcal</span>
                  </p>
                </div>
              </div>
              {goalCalorieAdjust(goal) !== 0 && (
                <p className="text-xs text-muted-foreground mt-1.5 text-right">
                  {goalCalorieAdjust(goal) > 0 ? `+${goalCalorieAdjust(goal)}` : goalCalorieAdjust(goal)} kcal จาก TDEE
                </p>
              )}
            </div>
          </div>

          {/* เลือกเป้าหมายหลัก */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={17} className="text-primary" />
              <h2 className="font-semibold text-foreground">เป้าหมายของฉัน</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GOALS.map(g => {
                const Icon = g.icon
                const active = goal === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => { setGoal(g.id); onSave?.({ ...profile, goal: g.id, activityDays }) }}
                    className={`flex items-center justify-center gap-2 px-2 py-3 rounded-2xl border-2 transition-all duration-200 text-center ${active
                      ? `${g.activeBg} border-transparent ${g.activeText} shadow-sm`
                      : `${g.bg} border-transparent ${g.color}`
                      }`}
                  >
                    <Icon size={18} className={`shrink-0 ${active ? g.activeText : g.color}`} />
                    <span className={`text-sm font-semibold truncate ${active ? g.activeText : 'text-foreground'}`}>{g.id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ระดับการออกกำลังกาย */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={17} className="text-primary" />
              <h2 className="font-semibold text-foreground">ระดับการออกกำลังกาย</h2>
            </div>
            <div className="space-y-2">
              {ACTIVITY_LEVELS.map(level => {
                const active = activityDays === level.days
                const filledDots = level.days === 0 ? 0 : level.days === 2 ? 2 : level.days === 4 ? 4 : level.days === 6 ? 6 : 7
                return (
                  <button
                    key={level.days}
                    onClick={() => { setActivityDays(level.days); onSave?.({ ...profile, goal, activityDays: level.days }) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all duration-200 ${active
                      ? 'bg-primary border-primary'
                      : 'bg-background border-border hover:border-primary/30'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[0, 1, 2, 3, 4, 5, 6].map(i => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i < filledDots
                            ? (active ? 'bg-primary-foreground' : 'bg-primary')
                            : (active ? 'bg-primary-foreground/30' : 'bg-muted')
                            }`} />
                        ))}
                      </div>
                      <span className={`text-sm font-semibold ${active ? 'text-primary-foreground' : 'text-foreground'}`}>{level.label}</span>
                    </div>
                    <span className={`text-xs ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{level.sub}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Activity Factor</p>
              <p className="text-sm font-bold text-foreground">× {activityFactor(activityDays).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* ── ฝั่งขวา: สารอาหารมาโครและเมนูตั้งค่าอื่นๆ ── */}
        <div className="space-y-4 lg:space-y-6">
          {/* สารอาหารมาโคร */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-3">เป้าหมายมาโครต่อวัน</h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'โปรตีน', value: macros.protein, unit: 'g', color: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-400' },
                { label: 'คาร์บ', value: macros.carbs, unit: 'g', color: 'bg-orange-50', text: 'text-orange-500', bar: 'bg-orange-400' },
                { label: 'ไขมัน', value: macros.fat, unit: 'g', color: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-400' },
              ].map(m => (
                <div key={m.label} className={`rounded-2xl p-2 sm:p-3.5 ${m.color} text-center flex flex-col items-center justify-center`}>
                  <div className={`w-8 h-1.5 rounded-full ${m.bar} mb-1 sm:mb-2`} />
                  <p className={`text-xl sm:text-2xl font-bold ${m.text}`}>{m.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">{m.unit}/วัน</p>
                </div>
              ))}
            </div>
          </div>

          {/* รายการตั้งค่าแอปทั่วไป */}
          <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden divide-y divide-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-4 pb-2">การตั้งค่า</p>
            {[
              { icon: <Bell size={16} className="text-orange-500" />, label: 'การแจ้งเตือน', desc: 'จัดการการแจ้งเตือนทั้งหมด', href: '/profile/notifications' },
              { icon: <Star size={16} className="text-amber-500" />, label: 'ให้คะแนนแอป', desc: 'แชร์ความคิดเห็นการใช้งานของคุณ', href: '/profile/review' },
              { icon: <ShieldCheck size={16} className="text-green-600" />, label: 'ความเป็นส่วนตัว', desc: 'ข้อมูลและการอนุญาต', href: '/profile/privacy' },
              { icon: <HelpCircle size={16} className="text-blue-500" />, label: 'ช่วยเหลือ & คำถามที่พบบ่อย', desc: 'คู่มือการใช้งาน', href: '/profile/help' },
              { icon: <FileText size={16} className="text-muted-foreground" />, label: 'นโยบายและเงื่อนไข', desc: 'Terms & Privacy Policy', href: '/profile/terms' },
            ].map(item => (
              <Link key={item.label} href={item.href} className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </Link>
            ))}

            {/* ปุ่มออกจากระบบ (Log Out) ท้ายสุดของเมนูตั้งค่า */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-red-50 text-red-500 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={16} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">ออกจากระบบ</p>
                <p className="text-xs text-red-400">Sign out จากบัญชีผู้ใช้ปัจจุบัน</p>
              </div>
              <ChevronRight size={16} className="text-red-400 shrink-0" />
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground pb-2 mt-4">NutriSmart v1.0.0</p>
        </div>

      </div>

      {/* ── Avatar Change Dialog ── */}
      {showAvatarDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAvatarDialog(false) }}
        >
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground">เปลี่ยนรูปโปรไฟล์</h3>
              <button onClick={() => setShowAvatarDialog(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex justify-center mb-5">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/20 bg-muted flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar preview" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                ) : (
                  <span className="text-3xl font-bold text-primary">{initials}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-accent transition-all duration-200 mb-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Camera size={18} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">อัปโหลดรูปภาพ</p>
                <p className="text-xs text-muted-foreground">เลือกจากอุปกรณ์ของคุณ</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            {avatarUrl && (
              <button
                onClick={() => { setAvatarUrl(''); setShowAvatarDialog(false); onAvatarChange?.('') }}
                className="w-full mt-1 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
              >
                ลบรูปโปรไฟล์
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}