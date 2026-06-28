'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import SettingsBackHeader from '@/components/settings-back-header'
import { registerFcmToken, unregisterFcmToken, testPushNotification } from '@/lib/backend-api'
import { requestNotificationPermission, getNotificationPermissionStatus } from '@/lib/firebase'
import { BellRing, Loader2, CheckCircle2, XCircle } from 'lucide-react'

type NotificationPrefs = {
  pushEnabled: boolean
  mealReminders: boolean
  waterReminders: boolean
  goalAlerts: boolean
  achievementAlerts: boolean
  weeklyReport: boolean
  sound: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  mealReminders: true,
  waterReminders: true,
  goalAlerts: true,
  achievementAlerts: true,
  weeklyReport: false,
  sound: true,
}

const STORAGE_KEY = 'nutrismart:notification-prefs'
const FCM_TOKEN_KEY = 'nutrismart:fcm-token'

const ITEMS: { key: keyof Omit<NotificationPrefs, 'pushEnabled'>; label: string; desc: string }[] = [
  { key: 'mealReminders', label: 'เตือนบันทึกมื้ออาหาร', desc: 'แจ้งเตือนเมื่อถึงเวลามื้อเช้า กลางวัน เย็น' },
  { key: 'waterReminders', label: 'เตือนดื่มน้ำ', desc: 'แจ้งเตือนเป็นระยะให้ดื่มน้ำให้ครบเป้าหมาย' },
  { key: 'goalAlerts', label: 'แจ้งเตือนเป้าหมายแคลอรี', desc: 'แจ้งเมื่อใกล้หรือเกินเป้าหมายแคลอรีประจำวัน' },
  { key: 'achievementAlerts', label: 'แจ้งเตือนความสำเร็จ', desc: 'แจ้งเมื่อทำสำเร็จตามเป้าหมายหรือสตรีคต่อเนื่อง' },
  { key: 'weeklyReport', label: 'รายงานสรุปประจำสัปดาห์', desc: 'สรุปพฤติกรรมการกินและสุขภาพทุกสัปดาห์' },
  { key: 'sound', label: 'เสียงแจ้งเตือน', desc: 'เปิด/ปิดเสียงเมื่อมีการแจ้งเตือนใหม่' },
]

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)

  // ── เปิดรับแจ้งเตือนบนอุปกรณ์นี้ (Web Push ผ่าน FCM) ──
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [registering, setRegistering] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pushMsg, setPushMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const isRegistered = permission === 'granted' && typeof window !== 'undefined' && !!localStorage.getItem(FCM_TOKEN_KEY)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    } catch {
      // ignore corrupted storage
    }
    setLoaded(true)
    setPermission(getNotificationPermissionStatus())
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs, loaded])

  const toggle = (key: keyof NotificationPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }))

  const handleEnablePush = async () => {
    setRegistering(true)
    setPushMsg(null)
    try {
      const result = await requestNotificationPermission()
      if (result.status === 'unsupported') {
        setPushMsg({ type: 'error', text: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push' })
      } else if (result.status === 'not-configured') {
        setPushMsg({ type: 'error', text: 'ระบบยังไม่ได้ตั้งค่า Firebase — ติดต่อผู้ดูแลระบบ' })
      } else if (result.status === 'denied') {
        setPushMsg({ type: 'error', text: 'คุณไม่ได้อนุญาตสิทธิ์การแจ้งเตือน ลองเปิดสิทธิ์จากการตั้งค่าเบราว์เซอร์' })
      } else {
        await registerFcmToken(result.token)
        localStorage.setItem(FCM_TOKEN_KEY, result.token)
        setPushMsg({ type: 'success', text: 'เปิดรับการแจ้งเตือนสำเร็จ! ลองกด "ส่งข้อความทดสอบ" ได้เลย' })
      }
    } catch (err) {
      setPushMsg({ type: 'error', text: err instanceof Error ? err.message : 'เปิดรับการแจ้งเตือนไม่สำเร็จ' })
    } finally {
      setPermission(getNotificationPermissionStatus())
      setRegistering(false)
    }
  }

  const handleDisablePush = async () => {
    const token = localStorage.getItem(FCM_TOKEN_KEY)
    if (token) {
      try {
        await unregisterFcmToken(token)
      } catch {
        // เงียบไว้ — ถึงลบฝั่ง backend ไม่สำเร็จ ก็ยังลบ local state ให้ UI สอดคล้องกัน
      }
      localStorage.removeItem(FCM_TOKEN_KEY)
    }
    setPushMsg({ type: 'success', text: 'ปิดรับการแจ้งเตือนบนอุปกรณ์นี้แล้ว' })
  }

  const handleTestPush = async () => {
    setTesting(true)
    setPushMsg(null)
    try {
      const result = await testPushNotification()
      setPushMsg({ type: 'success', text: `ส่งสำเร็จไปยัง ${result.devicesNotified} อุปกรณ์! เช็คการแจ้งเตือนของเครื่องนี้ได้เลย` })
    } catch (err) {
      setPushMsg({ type: 'error', text: err instanceof Error ? err.message : 'ส่งไม่สำเร็จ' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-4 space-y-5 lg:space-y-6 pb-24 max-w-2xl lg:max-w-3xl mx-auto">
      <SettingsBackHeader title="การแจ้งเตือน" subtitle="จัดการการแจ้งเตือนทั้งหมด" />

      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-3.5 px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">เปิดการแจ้งเตือนทั้งหมด</p>
            <p className="text-xs text-muted-foreground">ปิดเพื่อหยุดรับการแจ้งเตือนทุกประเภท</p>
          </div>
          <Switch checked={prefs.pushEnabled} onCheckedChange={() => toggle('pushEnabled')} />
        </div>
      </div>

      <div
        className={`bg-card rounded-3xl shadow-sm border border-border overflow-hidden divide-y divide-border transition-opacity ${
          prefs.pushEnabled ? '' : 'opacity-50 pointer-events-none'
        }`}
      >
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

      {/* ── เปิดรับแจ้งเตือนบนอุปกรณ์นี้ (Web Push / FCM) ── */}
      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BellRing size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              เปิดรับแจ้งเตือนบนอุปกรณ์นี้
              {isRegistered && <CheckCircle2 size={14} className="text-primary" />}
              {permission === 'denied' && <XCircle size={14} className="text-destructive" />}
            </p>
            <p className="text-xs text-muted-foreground">รับการแจ้งเตือนเด้งเข้ามือถือ/คอมพิวเตอร์เครื่องนี้ แม้ปิดเว็บอยู่</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {permission === 'denied' ? (
            <p className="text-xs text-destructive leading-relaxed">
              คุณบล็อกการแจ้งเตือนของเว็บนี้ไว้ — กดไอคอนกุญแจ/ตัวล็อกที่แถบ URL ของเบราว์เซอร์ แล้วเปลี่ยนสิทธิ์
              การแจ้งเตือน (Notifications) เป็น &quot;อนุญาต&quot; ก่อนลองใหม่
            </p>
          ) : isRegistered ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestPush}
                disabled={testing}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
              >
                {testing && <Loader2 size={14} className="animate-spin" />}
                ส่งข้อความทดสอบ
              </button>
              <button
                onClick={handleDisablePush}
                className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline"
              >
                ปิดรับแจ้งเตือนบนอุปกรณ์นี้
              </button>
            </div>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={registering}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
            >
              {registering && <Loader2 size={14} className="animate-spin" />}
              เปิดการแจ้งเตือน
            </button>
          )}

          {pushMsg && (
            <p className={`text-xs ${pushMsg.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
              {pushMsg.text}
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
