'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import SettingsBackHeader from '@/components/settings-back-header'
import { createClient } from '@/lib/supabase/client'
import { fetchUserProfile, fetchFoodLogs, fetchWaterLogs, fetchScanLogs } from '@/lib/backend-api'

type PrivacyPrefs = {
  shareAnalytics: boolean
  personalizedSuggestions: boolean
  publicProfile: boolean
}

const DEFAULT_PREFS: PrivacyPrefs = {
  shareAnalytics: true,
  personalizedSuggestions: true,
  publicProfile: false,
}

const STORAGE_KEY = 'nutrismart:privacy-prefs'

const ITEMS: { key: keyof PrivacyPrefs; label: string; desc: string }[] = [
  { key: 'shareAnalytics', label: 'แชร์ข้อมูลเพื่อปรับปรุงระบบ', desc: 'อนุญาตให้ใช้ข้อมูลการใช้งานแบบไม่ระบุตัวตนเพื่อพัฒนา NutriSmart' },
  { key: 'personalizedSuggestions', label: 'คำแนะนำส่วนบุคคลจาก AI', desc: 'ให้ AI ใช้ประวัติการกินของคุณเพื่อแนะนำเมนูที่เหมาะกับคุณ' },
  { key: 'publicProfile', label: 'เปิดให้เห็นโปรไฟล์สาธารณะ', desc: 'ผู้ใช้คนอื่นจะเห็นชื่อและความสำเร็จของคุณในตารางผู้นำ (ถ้ามี)' },
]

export default function PrivacySettingsPage() {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    } catch {
      // ignore corrupted storage
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs, loaded])

  const toggle = (key: keyof PrivacyPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }))

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user.id

      const [profile, foodLogs, waterLogs, scanLogs] = await Promise.all([
        fetchUserProfile(userId),
        fetchFoodLogs(userId),
        fetchWaterLogs(userId),
        fetchScanLogs(userId),
      ])

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile,
        foodLogs,
        waterLogs,
        scanLogs,
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nutrismart-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'ส่งออกข้อมูลไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 space-y-5 lg:space-y-6 pb-24 max-w-2xl lg:max-w-3xl mx-auto">
      <SettingsBackHeader title="ความเป็นส่วนตัว" subtitle="ข้อมูลและการอนุญาต" />

      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden divide-y divide-border">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-3.5 px-5 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden divide-y divide-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-4 pb-2">ข้อมูลของฉัน</p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left disabled:opacity-60"
        >
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
            {exporting ? <Loader2 size={16} className="text-primary animate-spin" /> : <Download size={16} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">ดาวน์โหลดข้อมูลของฉัน</p>
            <p className="text-xs text-muted-foreground">
              {exportError ?? 'ส่งออกโปรไฟล์ บันทึกอาหาร น้ำ และผลสแกนเป็นไฟล์ JSON'}
            </p>
          </div>
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-destructive/5 transition-colors text-left">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">ลบบัญชีผู้ใช้</p>
                <p className="text-xs text-muted-foreground">ลบบัญชีและข้อมูลทั้งหมดของคุณอย่างถาวร</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบบัญชี?</AlertDialogTitle>
              <AlertDialogDescription>
                การลบบัญชีจะลบข้อมูลโปรไฟล์ บันทึกอาหาร และประวัติการใช้งานทั้งหมดอย่างถาวร และไม่สามารถกู้คืนได้
                กรุณาติดต่อทีมสนับสนุนที่ support@nutrismart.app เพื่อยืนยันการลบบัญชีของคุณ
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => { window.location.href = 'mailto:support@nutrismart.app?subject=ขอลบบัญชี NutriSmart' }}
              >
                ติดต่อเพื่อลบบัญชี
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
