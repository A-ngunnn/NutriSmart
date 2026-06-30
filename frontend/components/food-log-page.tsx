'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Search, Sparkles, X, Loader2, CalendarDays,
  Sunrise, Sun, Moon, Cookie, Leaf, Drumstick, Egg, Apple, Milk, Coffee, Fish,
  UtensilsCrossed, Camera, Flame, Candy, Droplets, Shrimp, Beef, Salad, Wheat,
  CakeSlice, Croissant, Sandwich, Pizza, Soup, BookOpen, type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { CarrotMascot } from '@/components/ui/error-mascots'
import { FINAL_BACKEND_URL, fetchWithAuth } from '@/lib/backend-api'
import { LoadingFruits } from '@/components/ui/loading-fruits'

type SubTab = 'diary' | 'scan' | 'library'
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'เช้า', lunch: 'กลางวัน', dinner: 'เย็น', snack: 'ของว่าง',
}
const MEAL_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Cookie,
}
// Muted, bordered tints rather than solid saturated fills — reads as a
// data label, not a toy badge.
const MEAL_STYLES: Record<MealType, string> = {
  breakfast: 'bg-amber-50 text-amber-700 border border-amber-100',
  lunch:     'bg-sky-50 text-sky-700 border border-sky-100',
  dinner:    'bg-violet-50 text-violet-700 border border-violet-100',
  snack:     'bg-emerald-50 text-emerald-700 border border-emerald-100',
}

interface MenuItem {
  id: number; name: string; cal: number; protein: number; carbs: number; fat: number
  category: string; icon: LucideIcon
}

const DRINK_KEYWORDS = ['นม', 'กาแฟ', 'ชา', 'น้ำ', 'โอเลี้ยง', 'ลาเต้']

// จับคู่ชื่อเมนูกับไอคอนที่ตรงกับชนิดอาหารจริง (ไม่ใช่แค่หมวดสารอาหาร) —
// เรียงจากเฉพาะเจาะจงไปกว้าง ตัวแรกที่ match ชื่อจะถูกใช้
const FOOD_ICON_RULES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ['ไข่'], icon: Egg },
  { keywords: ['กุ้ง', 'ปู', 'หมึก'], icon: Shrimp },
  { keywords: ['ปลา', 'แซลมอน', 'ทูน่า'], icon: Fish },
  { keywords: ['ไก่'], icon: Drumstick },
  { keywords: ['หมู', 'เนื้อ', 'วัว', 'สเต็ก'], icon: Beef },
  { keywords: ['เค้ก', 'บราวนี่'], icon: CakeSlice },
  { keywords: ['ขนมปัง', 'ครัวซองต์'], icon: Croissant },
  { keywords: ['แซนวิช'], icon: Sandwich },
  { keywords: ['พิซซ่า'], icon: Pizza },
  { keywords: ['โยเกิร์ต', 'นม'], icon: Milk },
  { keywords: ['กาแฟ', 'ชา', 'มัทฉะ', 'ลาเต้', 'โอเลี้ยง'], icon: Coffee },
  { keywords: ['สลัด', 'ส้มตำ', 'ผัก'], icon: Salad },
  { keywords: ['กล้วย', 'ผลไม้', 'แอปเปิ้ล', 'ส้ม'], icon: Apple },
  { keywords: ['ข้าว', 'เส้น', 'บะหมี่', 'วุ้นเส้น', 'ก๋วยเตี๋ยว'], icon: Wheat },
  { keywords: ['ต้ม', 'แกง', 'ซุป'], icon: Soup },
]

function categoryFallbackIcon(category: string): LucideIcon {
  if (category === 'เครื่องดื่ม') return Coffee
  if (category === 'แคลต่ำ') return Leaf
  if (category === 'โปรตีนสูง') return Drumstick
  return UtensilsCrossed
}

function getFoodIcon(name: string, category: string): LucideIcon {
  const rule = FOOD_ICON_RULES.find(r => r.keywords.some(k => name.includes(k)))
  return rule ? rule.icon : categoryFallbackIcon(category)
}

function classifyMenu(name: string, cal: number, protein: number): { category: string; icon: LucideIcon } {
  let category: string
  if (DRINK_KEYWORDS.some(k => name.includes(k))) category = 'เครื่องดื่ม'
  else if (cal <= 100) category = 'แคลต่ำ'
  else if (cal > 0 && (protein * 4) / cal >= 0.3) category = 'โปรตีนสูง'
  else category = 'คาร์บ'
  return { category, icon: getFoodIcon(name, category) }
}

// Used only if the /api/food/popular call fails (e.g. offline) so the tab isn't empty.
const FALLBACK_MENUS: MenuItem[] = [
  { id: 1, name: 'ข้าวมันไก่',      cal: 550, protein: 28, carbs: 55, fat: 15, ...classifyMenu('ข้าวมันไก่', 550, 28) },
  { id: 2, name: 'ส้มตำไทย',        cal: 120, protein: 3,  carbs: 15, fat: 5,  ...classifyMenu('ส้มตำไทย', 120, 3) },
  { id: 3, name: 'ไข่ดาว',          cal: 90,  protein: 6,  carbs: 0,  fat: 7,  ...classifyMenu('ไข่ดาว', 90, 6) },
  { id: 4, name: 'อกไก่นึ่ง',       cal: 165, protein: 31, carbs: 0,  fat: 3,  ...classifyMenu('อกไก่นึ่ง', 165, 31) },
  { id: 5, name: 'กล้วยหอม',        cal: 89,  protein: 1,  carbs: 23, fat: 0,  ...classifyMenu('กล้วยหอม', 89, 1) },
  { id: 6, name: 'นมไขมันต่ำ',      cal: 85,  protein: 8,  carbs: 12, fat: 0,  ...classifyMenu('นมไขมันต่ำ', 85, 8) },
  { id: 7, name: 'กาแฟดำ',          cal: 5,   protein: 0,  carbs: 0,  fat: 0,  ...classifyMenu('กาแฟดำ', 5, 0) },
  { id: 8, name: 'ปลาแซลมอนย่าง',  cal: 220, protein: 25, carbs: 0,  fat: 12, ...classifyMenu('ปลาแซลมอนย่าง', 220, 25) },
]

const LIB_CATEGORIES = ['ทั้งหมด', 'แคลต่ำ', 'โปรตีนสูง', 'เครื่องดื่ม', 'คาร์บ']

// ไอคอนแต่ละการ์ดในคลังเมนูเคยใช้สีเขียว (bg-accent) ซ้ำทุกใบหมดเลย — แยกสีตามหมวดให้ดูมีมิติ
const LIB_CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  'แคลต่ำ':    { bg: 'bg-green-50',  text: 'text-green-600' },
  'โปรตีนสูง': { bg: 'bg-blue-50',   text: 'text-blue-600' },
  'เครื่องดื่ม': { bg: 'bg-amber-50',  text: 'text-amber-600' },
  'คาร์บ':     { bg: 'bg-orange-50', text: 'text-orange-600' },
}
const THAI_MONTHS    = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const THAI_DAYS      = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function getWeekDays(anchor: Date) {
  const dow = anchor.getDay()
  const mon = new Date(anchor)
  mon.setDate(anchor.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const fullDate = `${year}-${month}-${day}`
    return { day: THAI_DAYS[d.getDay()], date: d.getDate(), fullDate }
  })
}

function getMonthGrid(anchor: Date) {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday-start padding
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return { date: d, fullDate: `${year}-${month}-${day}`, inCurrentMonth: d.getMonth() === anchor.getMonth() }
  })
}

function scoreChip(score: number) {
  if (score >= 70) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-red-500 bg-red-50 border-red-200'
}

interface FoodLogPageProps { tdee?: number }

export default function FoodLogPage({ tdee = 2000 }: FoodLogPageProps) {
  const { foodEntries, addFoodEntry, removeFoodEntry, scanHistory } = useAppStore()

  const today    = new Date()
  const tYear = today.getFullYear()
  const tMonth = String(today.getMonth() + 1).padStart(2, '0')
  const tDay = String(today.getDate()).padStart(2, '0')
  const todayStr = `${tYear}-${tMonth}-${tDay}`

  const [subTab,       setSubTab]       = useState<SubTab>('diary')
  const [weekAnchor,   setWeekAnchor]   = useState(today)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [libCategory,  setLibCategory]  = useState('ทั้งหมด')
  const [showForm,     setShowForm]     = useState(false)
  const [estimating,   setEstimating]   = useState(false)
  const [popularMenus, setPopularMenus] = useState<MenuItem[] | null>(null)
  const [pickingMealFor, setPickingMealFor] = useState<MenuItem | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(today)
  const [form, setForm] = useState({
    name: '', meal: 'breakfast' as MealType, calories: '', protein: '', carbs: '', fat: '',
  })

  // ── Catalog search (ค้นคลังเมนูกลางก่อนเรียก AI — ฟรี ไม่เปลืองโทเคน) ──
  const [catalogResults, setCatalogResults] = useState<
    { id: string; name: string; calories: number; protein: number; carbs: number; fat: number }[]
  >([])
  const [searchingCatalog, setSearchingCatalog] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const lastPickedNameRef = useRef<string | null>(null)

  // Auto-open form if navigated with ?action=add
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('action') === 'add') {
        setShowForm(true)
        const type = params.get('type')
        if (type && ['breakfast', 'lunch', 'dinner', 'snack'].includes(type)) {
          setForm(f => ({ ...f, meal: type as MealType }))
        }
        // ลบ param ออกจาก URL เพื่อไม่ให้โชว์ฟอร์มซ้ำตอนรีเฟรช
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  useEffect(() => {
    if (subTab !== 'library' || popularMenus !== null) return
    let cancelled = false
    fetchWithAuth(`${FINAL_BACKEND_URL}/api/food/popular?limit=20`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then((items: { id: string; name: string; calories: number; protein: number; carbs: number; fat: number }[]) => {
        if (cancelled) return
        setPopularMenus(items.map((item, i) => ({
          id: i,
          name: item.name,
          cal: Math.round(item.calories),
          protein: Math.round(item.protein),
          carbs: Math.round(item.carbs),
          fat: Math.round(item.fat),
          ...classifyMenu(item.name, item.calories, item.protein),
        })))
      })
      .catch(() => { if (!cancelled) setPopularMenus(FALLBACK_MENUS) })
    return () => { cancelled = true }
  }, [subTab, popularMenus])

  // ค้นคลังเมนูกลาง (GlobalFoodItem) แบบ debounce ทุกครั้งที่พิมพ์ชื่ออาหาร —
  // ถ้ามีคนเคยบันทึก/ให้ AI ประมาณชื่อนี้ไปแล้ว จะเจอที่นี่ก่อนเสมอ ไม่ต้องเรียก AI ซ้ำ
  useEffect(() => {
    const query = form.name.trim()
    if (!showForm || query.length < 2 || query === lastPickedNameRef.current) {
      setCatalogResults([])
      setShowSuggestions(false)
      return
    }
    let cancelled = false
    setSearchingCatalog(true)
    const timer = setTimeout(() => {
      fetchWithAuth(`${FINAL_BACKEND_URL}/api/food/search?query=${encodeURIComponent(query)}&limit=6`)
        .then(res => { if (!res.ok) throw new Error(); return res.json() })
        .then((items: { id: string; name: string; calories: number; protein: number; carbs: number; fat: number }[]) => {
          if (cancelled) return
          setCatalogResults(items)
          setShowSuggestions(items.length > 0)
        })
        .catch(() => { if (!cancelled) { setCatalogResults([]); setShowSuggestions(false) } })
        .finally(() => { if (!cancelled) setSearchingCatalog(false) })
    }, 350)
    return () => { cancelled = true; clearTimeout(timer); setSearchingCatalog(false) }
  }, [form.name, showForm])

  const selectCatalogItem = (item: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    lastPickedNameRef.current = item.name
    setForm(f => ({
      ...f,
      name: item.name,
      calories: String(Math.round(item.calories)),
      protein: String(Math.round(item.protein)),
      carbs: String(Math.round(item.carbs)),
      fat: String(Math.round(item.fat)),
    }))
    setShowSuggestions(false)
  }

  const weekDays   = useMemo(() => getWeekDays(weekAnchor), [weekAnchor])
  const monthLabel = useMemo(() => {
    const dt = new Date(weekDays[0].fullDate)
    return `${THAI_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543}`
  }, [weekDays])

  const monthGrid = useMemo(() => getMonthGrid(pickerMonth), [pickerMonth])
  const pickerMonthLabel = `${THAI_MONTHS[pickerMonth.getMonth()]} ${pickerMonth.getFullYear() + 543}`

  const shiftPickerMonth = (dir: -1 | 1) => {
    setPickerMonth(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))
  }

  const pickDate = (fullDate: string) => {
    setSelectedDate(fullDate)
    setWeekAnchor(new Date(fullDate))
    setShowMonthPicker(false)
  }

  const dayEntries = useMemo(
    () => foodEntries.filter(e => e.date === selectedDate),
    [foodEntries, selectedDate]
  )

  const totalCal = dayEntries.reduce((s, e) => s + e.calories, 0)
  const pctOfTarget = Math.min(100, Math.round((totalCal / tdee) * 100))
  const totalProtein = dayEntries.reduce((s, e) => s + e.protein, 0)
  const totalCarbs   = dayEntries.reduce((s, e) => s + e.carbs, 0)
  const totalFat     = dayEntries.reduce((s, e) => s + e.fat, 0)

  const groupedMeals = useMemo(() =>
    (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[])
      .map(type => ({ type, items: dayEntries.filter(e => e.mealType === type) }))
      .filter(g => g.items.length > 0),
    [dayEntries]
  )

  const filteredMenus = useMemo(() => {
    const menus = popularMenus ?? []
    return libCategory === 'ทั้งหมด' ? menus : menus.filter(m => m.category === libCategory)
  }, [popularMenus, libCategory])

  const handleEstimate = async () => {
    if (!form.name.trim() || estimating) return
    setShowSuggestions(false)
    setEstimating(true)
    try {
      const res = await fetchWithAuth(
        `${FINAL_BACKEND_URL}/api/analyze/estimate?save=false`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_name: form.name }) }
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setForm(f => ({
        ...f,
        calories: String(Math.round(data.calories ?? 0)),
        protein:  String(Math.round(data.protein  ?? 0)),
        carbs:    String(Math.round(data.carbs     ?? 0)),
        fat:      String(Math.round(data.fat       ?? 0)),
      }))
    } catch {
      // silent — user can fill manually
    } finally {
      setEstimating(false)
    }
  }

  const handleAddMeal = () => {
    if (!form.name || !form.calories) return
    addFoodEntry({
      name:      form.name,
      mealType:  form.meal,
      calories:  Number(form.calories),
      protein:   Number(form.protein)  || 0,
      carbs:     Number(form.carbs)    || 0,
      fat:       Number(form.fat)      || 0,
    })
    setForm({ name: '', meal: 'breakfast', calories: '', protein: '', carbs: '', fat: '' })
    lastPickedNameRef.current = null
    setShowForm(false)
  }

  const shiftWeek = (dir: -1 | 1) => {
    const d = new Date(weekAnchor)
    d.setDate(d.getDate() + dir * 7)
    setWeekAnchor(d)
  }

  return (
    <div className="p-4 space-y-4 pb-6 max-w-2xl lg:max-w-6xl mx-auto">
      <div className="pt-2 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">บันทึกอาหาร</h1>
          <p className="text-sm text-muted-foreground">ไดอารี่อาหารประจำวัน</p>
        </div>
      </div>

      {/* Calendar Strip */}
      <div className="bg-card rounded-2xl p-3 shadow-sm border border-border relative">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftWeek(-1)} className="p-2.5 -m-1 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => { setPickerMonth(weekAnchor); setShowMonthPicker(v => !v) }}
            className="flex items-center gap-1.5 px-3 py-1.5 -my-1.5 rounded-xl hover:bg-muted transition-colors"
          >
            <CalendarDays size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
          </button>
          <button onClick={() => shiftWeek(1)} className="p-2.5 -m-1 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {showMonthPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowMonthPicker(false)} />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 bg-card border border-border rounded-2xl shadow-lg p-3 w-72">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => shiftPickerMonth(-1)} className="p-2 rounded-lg hover:bg-muted">
                  <ChevronLeft size={15} className="text-muted-foreground" />
                </button>
                <p className="text-sm font-semibold text-foreground">{pickerMonthLabel}</p>
                <button onClick={() => shiftPickerMonth(1)} className="p-2 rounded-lg hover:bg-muted">
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(d => (
                  <span key={d} className="text-[10px] text-center text-muted-foreground py-1">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {monthGrid.map(({ date, fullDate, inCurrentMonth }) => (
                  <button
                    key={fullDate}
                    onClick={() => pickDate(fullDate)}
                    className={`text-xs h-8 w-8 mx-auto rounded-full flex items-center justify-center tabular-nums transition-colors ${
                      selectedDate === fullDate
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : fullDate === todayStr
                        ? 'text-primary font-semibold hover:bg-muted'
                        : inCurrentMonth
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground/40 hover:bg-muted'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="flex justify-between">
          {weekDays.map(d => (
            <button key={d.fullDate} onClick={() => setSelectedDate(d.fullDate)}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all ${
                selectedDate === d.fullDate ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}>
              <span className={`text-xs ${selectedDate === d.fullDate ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{d.day}</span>
              <span className={`text-sm font-semibold tabular-nums ${selectedDate === d.fullDate ? 'text-primary-foreground' : 'text-foreground'}`}>{d.date}</span>
              {d.fullDate === todayStr && (
                <span className={`w-1 h-1 rounded-full ${selectedDate === d.fullDate ? 'bg-primary-foreground/60' : 'bg-primary'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="bg-muted/60 rounded-2xl p-1 flex gap-1">
        {([['diary', 'ไดอารี่อาหาร'], ['scan', 'ประวัติสแกน'], ['library', 'คลังเมนู']] as [SubTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              subTab === key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Diary Tab ── */}
      {subTab === 'diary' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card rounded-2xl px-4 py-3 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground">แคลอรีรวม</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {totalCal.toLocaleString()}
                  <span className="text-sm font-normal ml-1 text-muted-foreground">/ {tdee.toLocaleString()} kcal</span>
                </p>
              </div>
              <button onClick={() => setShowForm(!showForm)}
                className="bg-primary text-primary-foreground rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm font-medium shadow-sm shrink-0">
                <Plus size={16} />เพิ่มมื้ออาหาร
              </button>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pctOfTarget}%` }}
              />
            </div>
          </div>

          {showForm && (
            <div className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">เพิ่มรายการอาหาร</h2>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-muted-foreground" /></button>
              </div>
              <div className="relative">
                <div className="flex items-center border border-input rounded-xl overflow-hidden bg-background">
                  <Search size={15} className="ml-3 text-muted-foreground shrink-0" />
                  <input className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                    placeholder="ชื่ออาหาร... (ค้นคลังเมนูกลางก่อนอัตโนมัติ)" value={form.name}
                    onChange={e => { lastPickedNameRef.current = null; setForm(f => ({ ...f, name: e.target.value })) }}
                    onFocus={() => { if (catalogResults.length > 0) setShowSuggestions(true) }} />
                  {searchingCatalog && <Loader2 size={13} className="text-muted-foreground animate-spin mr-2 shrink-0" />}
                  <button
                    type="button"
                    onClick={handleEstimate}
                    disabled={estimating || !form.name.trim()}
                    className="mr-2 p-1.5 bg-accent rounded-lg disabled:opacity-40 hover:bg-primary/10 transition-colors"
                    title="ไม่เจอในคลัง? ให้ AI ประมาณโภชนาการ"
                  >
                    {estimating
                      ? <Loader2 size={13} className="text-primary animate-spin" />
                      : <Sparkles size={13} className="text-primary" />}
                  </button>
                </div>

                {showSuggestions && catalogResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1">มีคนบันทึกเมนูนี้ไว้แล้ว เลือกได้เลยไม่ต้องรอ AI</p>
                    {catalogResults.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectCatalogItem(item)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                      >
                        <span className="text-sm text-foreground truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{Math.round(item.calories)} kcal</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">มื้ออาหาร</label>
                  <select className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none"
                    value={form.meal} onChange={e => setForm(f => ({ ...f, meal: e.target.value as MealType }))}>
                    {(Object.keys(MEAL_LABELS) as MealType[]).map(k => (
                      <option key={k} value={k}>{MEAL_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">พลังงาน (kcal)</label>
                  <input type="number" className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none"
                    placeholder="0" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">โปรตีน (g)</label>
                  <input type="number" className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none"
                    placeholder="0" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">คาร์บ (g)</label>
                  <input type="number" className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background outline-none"
                    placeholder="0" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} />
                </div>
              </div>
              <button onClick={handleAddMeal}
                className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">
                บันทึกมื้ออาหารลงไดอารี่
              </button>
            </div>
          )}

          {groupedMeals.length === 0 ? (
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-border text-center">
              <div className="scale-70 -mb-9 flex justify-center">
                <CarrotMascot />
              </div>
              <p className="text-sm font-semibold text-foreground">แครอทหิวจนตาเป็นหัวใจ~ 🥕💕</p>
              <p className="text-xs text-muted-foreground mt-1">ยังไม่มีรายการอาหารเลยนะ บันทึกมื้อแรกกันเถอะ!</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-primary font-medium">
                + เพิ่มมื้ออาหาร
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {groupedMeals.map(group => {
                const MealIcon = MEAL_ICONS[group.type]
                return (
                  <div key={group.type} className="bg-card rounded-3xl p-4 shadow-sm border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${MEAL_STYLES[group.type]}`}>
                        <MealIcon size={12} strokeWidth={2.25} />
                        {MEAL_LABELS[group.type]}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {group.items.reduce((s, e) => s + e.calories, 0)} kcal
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              โปรตีน {item.protein}g · คาร์บ {item.carbs}g · ไขมัน {item.fat}g
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <p className="text-sm font-semibold text-primary tabular-nums">{item.calories}</p>
                            <button onClick={() => removeFoodEntry(item.id)}
                              className="p-2.5 -m-1 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors">
                              <Trash2 size={12} className="text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right rail: today's macro breakdown ── */}
        <div className="space-y-4">
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">สรุปสารอาหารวันนี้</h3>
            {dayEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลของวันนี้</p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'โปรตีน', value: totalProtein, color: 'bg-sky-500' },
                  { label: 'คาร์บ', value: totalCarbs, color: 'bg-amber-500' },
                  { label: 'ไขมัน', value: totalFat, color: 'bg-violet-500' },
                ].map(m => {
                  const max = Math.max(totalProtein, totalCarbs, totalFat, 1)
                  return (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{m.label}</span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{Math.round(m.value)}g</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${m.color}`} style={{ width: `${Math.round((m.value / max) * 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">มื้อที่บันทึกแล้ว</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{dayEntries.length} รายการ</span>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ── Scan History Tab ── */}
      {subTab === 'scan' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {scanHistory.length === 0 ? (
            <div className="xl:col-span-2 bg-card rounded-3xl p-8 shadow-sm border border-border text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Camera size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการสแกนฉลาก</p>
              <p className="text-xs text-muted-foreground mt-1">ไปที่หน้าวิเคราะห์เพื่อสแกนสินค้า</p>
            </div>
          ) : (
            scanHistory.map(scan => (
              <div key={scan.id} className="bg-card rounded-3xl p-4 shadow-sm border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{scan.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{scan.date}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Flame size={12} className="text-muted-foreground/70" />{scan.calories} kcal
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Candy size={12} className="text-muted-foreground/70" />น้ำตาล {scan.sugar}g
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Droplets size={12} className="text-muted-foreground/70" />โซเดียม {scan.sodium}mg
                      </span>
                    </div>
                  </div>
                  <div className={`shrink-0 w-11 h-11 rounded-2xl border flex flex-col items-center justify-center ${scoreChip(scan.score)}`}>
                    <span className="text-base font-black leading-none tabular-nums">{scan.score}</span>
                    <span className="text-[9px] leading-none mt-0.5">คะแนน</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Library Tab (Shared Menu Catalog — everyone's saved/AI-estimated foods) ── */}
      {subTab === 'library' && (
        <div className="mt-2 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {LIB_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setLibCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  libCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {popularMenus === null ? (
            <div className="flex items-center justify-center py-12">
              <LoadingFruits label="กำลังโหลดคลังเมนู..." size="sm" />
            </div>
          ) : filteredMenus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-3xl border border-border">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UtensilsCrossed size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">ยังไม่มีเมนูในหมวดนี้</p>
              <p className="text-xs text-muted-foreground mt-1">เมนูที่ทุกคนบันทึกหรือให้ AI ประมาณจะมาโชว์ที่นี่</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-8">
              {filteredMenus.map(menu => {
                const MenuIcon = menu.icon
                const catStyle = LIB_CATEGORY_STYLE[menu.category] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
                return (
                  <div key={menu.id} className="bg-card rounded-2xl p-4 shadow-sm border border-border flex flex-col group hover:shadow-md transition-all">
                    <div className="flex items-start gap-3 mb-2">
                      <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${catStyle.bg}`}>
                        <MenuIcon size={18} className={catStyle.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{menu.name}</p>
                        <span className="inline-block text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 mt-1">{menu.category}</span>
                      </div>
                      <p className="text-sm font-bold text-primary tabular-nums shrink-0">{menu.cal}<span className="text-[10px] font-normal text-muted-foreground"> kcal</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums mb-3">
                      โปรตีน {menu.protein}g · คาร์บ {menu.carbs}g · ไขมัน {menu.fat}g
                    </p>
                    <button
                      onClick={() => setPickingMealFor(menu)}
                      className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors mt-auto">
                      <Plus size={14} /> เพิ่มเลย
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Meal-type picker (shown when adding from the shared catalog) ── */}
      {pickingMealFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickingMealFor(null)}>
          <div className="bg-card rounded-3xl p-5 shadow-lg border border-border w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground truncate">{pickingMealFor.name}</h3>
              <button onClick={() => setPickingMealFor(null)}><X size={18} className="text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">เลือกมื้อที่จะเพิ่มเมนูนี้เข้าไป</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(MEAL_LABELS) as MealType[]).map(type => {
                const MealIcon = MEAL_ICONS[type]
                return (
                  <button
                    key={type}
                    onClick={() => {
                      addFoodEntry({
                        name: pickingMealFor.name,
                        mealType: type,
                        calories: pickingMealFor.cal,
                        protein: pickingMealFor.protein,
                        carbs: pickingMealFor.carbs,
                        fat: pickingMealFor.fat,
                      })
                      setPickingMealFor(null)
                      setSubTab('diary')
                    }}
                    className="flex items-center gap-2 px-3 py-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <MealIcon size={16} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{MEAL_LABELS[type]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}