"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import HealthDashboardPage from "@/components/health-dashboard-page"
import { createClient } from "@/lib/supabase/client"
import { fetchHealthSummary, type HealthSummary } from "@/lib/backend-api"
import { LoadingFruits } from "@/components/ui/loading-fruits"
import { LemonMascot, OrangeMascot, ErrorScreen } from "@/components/ui/error-mascots"

// เคส cold-start ของ DB จริงๆ จะ throw TimeoutError (AbortSignal.timeout) — ไม่ใช่ 401/session error
// ถ้า retry แบบไม่กรอง จะกลายเป็นรอซ้ำ 2 รอบเปล่าๆ ตอน session หมดอายุ/logout ทำให้ดูเหมือนแอป "ช้า"
function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || /timed out/i.test(err.message))
}

// ถ้ายังโหลดไม่เสร็จเกิน 8 วิ ให้สลับจากสปินเนอร์ปกติเป็นหน้า "ช้า" ที่ให้ทางเลือกรอต่อ/ยกเลิก
// แทนที่จะให้จ้องสปินเนอร์เปล่าๆไม่รู้ว่ายังทำงานอยู่ไหม
const SLOW_THRESHOLD_MS = 8000

export default function HealthRoute() {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSlow, setIsSlow] = useState(false)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (isRetry = false) => {
    setError(null)
    setIsSlow(false)
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    slowTimerRef.current = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setIsLoading(false)
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
      return
    }

    try {
      const result = await fetchHealthSummary(session.user.id)
      setSummary(result)
      setIsLoading(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"
      console.error("Failed to load health summary", err)
      // ฐานข้อมูลอาจ cold-start ตอนเปิดแอปครั้งแรกทำให้ request แรก timeout ทั้งที่ไม่ได้พัง —
      // ลองใหม่แบบเงียบๆ อีก 1 ครั้งเฉพาะตอน timeout เท่านั้น (ไม่ retry 401/session error เพราะรอเปล่าๆ
      // ระหว่างนี้ isLoading ยังคง true ไว้ ไม่งั้นจะมีหน้าจอกระพริบว่างๆ ก่อน retry เสร็จ)
      if (!isRetry && isTimeoutError(err)) {
        setTimeout(() => load(true), 1000)
        return
      }
      setError(msg)
      setIsLoading(false)
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }, [])

  useEffect(() => {
    load()
    return () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current) }
  }, [load])

  if (isLoading && isSlow) {
    return (
      <ErrorScreen
        fullScreen={false}
        mascot={<OrangeMascot />}
        badgeText="โหลดช้า"
        badgeBg="#FFF3E0"
        badgeColor="#F57C00"
        title="ส้มพยายามสุดๆ แล้ว~ 😓"
        subtitle="สัญญาณน้อยมากเลย อดทนรอนิดนึงนะ!"
        actions={[
          { label: "⏳ รอต่อ~", variant: "orange", onClick: () => setIsSlow(false) },
        ]}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <LoadingFruits label="กำลังโหลดข้อมูลสุขภาพ..." />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorScreen
        fullScreen={false}
        mascot={<LemonMascot />}
        badgeText="โหลดข้อมูลไม่สำเร็จ"
        badgeBg="#EDE7F6"
        badgeColor="#5C6BC0"
        title="มะนาวกำลังนอนหลับ~ 😴"
        subtitle={error}
        actions={[{ label: "⏰ ปลุกขึ้นมา!", variant: "violet", onClick: () => load() }]}
      />
    )
  }

  return <HealthDashboardPage summary={summary} />
}
