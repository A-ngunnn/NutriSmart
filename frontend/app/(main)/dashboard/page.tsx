"use client"

import { useEffect, useState } from "react"
import HomeDashboard from "@/components/home-dashboard"
import { fetchDashboardSummary, type DashboardSummary } from "@/lib/backend-api"
import { LemonMascot, ErrorScreen } from "@/components/ui/error-mascots"

type PageState = { summary: DashboardSummary | null; error: string | null; attempt: number; autoRetried: boolean }

// เคส cold-start ของ DB จริงๆ จะ throw TimeoutError (AbortSignal.timeout) — ไม่ใช่ 401/session error
// ถ้า retry แบบไม่กรอง จะกลายเป็นรอซ้ำ 2 รอบเปล่าๆ ตอน session หมดอายุ/logout ทำให้ดูเหมือนแอป "ช้า"
function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || /timed out/i.test(err.message))
}

export default function DashboardPage() {
  const [state, setState] = useState<PageState>({ summary: null, error: null, attempt: 0, autoRetried: false })

  useEffect(() => {
    let cancelled = false
    fetchDashboardSummary()
      .then((summary) => { if (!cancelled) setState((s) => ({ ...s, summary, error: null })) })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"
        console.warn("[DashboardPage] failed to load summary:", err)
        setState((s) => {
          // ฐานข้อมูลอาจ cold-start ตอนเปิดแอปครั้งแรกทำให้ request แรก timeout ทั้งที่ไม่ได้พัง —
          // ลองใหม่แบบเงียบๆ อีก 1 ครั้งเฉพาะตอน timeout เท่านั้น ก่อนค่อยโชว์หน้า error
          if (!s.autoRetried && isTimeoutError(err)) {
            setTimeout(() => { if (!cancelled) setState((s2) => ({ ...s2, attempt: s2.attempt + 1 })) }, 1000)
            return { ...s, autoRetried: true }
          }
          return { ...s, error }
        })
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempt])

  return (
    <>
      {state.error && (
        <div className="fixed inset-0 z-50 bg-background/95">
          <ErrorScreen
            mascot={<LemonMascot />}
            badgeText="โหลดข้อมูลไม่สำเร็จ"
            badgeBg="#EDE7F6"
            badgeColor="#5C6BC0"
            title="มะนาวกำลังนอนหลับ~ 😴"
            subtitle={state.error}
            actions={[
              {
                label: "⏰ ปลุกขึ้นมา!",
                variant: "violet",
                onClick: () => setState((s) => ({ ...s, error: null, attempt: s.attempt + 1, autoRetried: false })),
              },
            ]}
          />
        </div>
      )}
      <HomeDashboard summary={state.summary} />
    </>
  )
}
