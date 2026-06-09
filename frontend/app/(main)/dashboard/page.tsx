"use client"

import { useEffect, useState } from "react"
import HomeDashboard from "@/components/home-dashboard"
import { createClient } from "@/lib/supabase/client"
import { fetchDashboardSummary, type DashboardSummary } from "@/lib/backend-api"

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSummary = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      try {
        const dashboard = await fetchDashboardSummary(session.user.id)
        setSummary(dashboard)
      } catch (err) {
        console.error("Failed to load dashboard summary", err)
        setError("ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ในขณะนี้")
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-muted-foreground font-medium">กำลังโหลดข้อมูลแดชบอร์ด...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
          <p className="text-lg font-semibold mb-3">เกิดข้อผิดพลาด</p>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-white font-semibold"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  return <HomeDashboard summary={summary} />
}
