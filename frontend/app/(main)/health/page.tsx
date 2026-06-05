"use client"
import HealthDashboardPage from "@/components/health-dashboard-page"
import { useAppStore } from "@/lib/store"

export default function HealthRoute() {
  const { scanHistory, profile, foodEntries } = useAppStore()
  return <HealthDashboardPage scanHistory={scanHistory} profile={profile} foodEntries={foodEntries} />
}
