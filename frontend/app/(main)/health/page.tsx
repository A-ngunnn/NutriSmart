"use client"

import { useEffect, useState } from "react"
import HealthDashboardPage from "@/components/health-dashboard-page"
import { createClient } from "@/lib/supabase/client"
import { fetchHealthSummary, type HealthSummary } from "@/lib/backend-api"

export default function HealthRoute() {
  const [summary, setSummary] = useState<HealthSummary | null>(null)

  useEffect(() => {
    const loadSummary = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      try {
        const result = await fetchHealthSummary(session.user.id)
        setSummary(result)
      } catch (error) {
        console.error("Failed to load health summary", error)
      }
    }

    loadSummary()
  }, [])

  return <HealthDashboardPage summary={summary} />
}
