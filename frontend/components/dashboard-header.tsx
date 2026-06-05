"use client"

import { Bell, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/app-sidebar"

const pageTitles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: {
    title: "AI Analyzer Dashboard",
    subtitle: "Enter nutrition values to get an instant MedGemma AI analysis.",
  },
  logs: {
    title: "Nutrition Logs",
    subtitle: "Review your analysis history and weekly intake trends.",
  },
  disclaimer: {
    title: "Info & Disclaimer",
    subtitle: "System status, RDI reference data, and usage guidelines.",
  },
}

interface DashboardHeaderProps {
  activePage: Page
}

export function DashboardHeader({ activePage }: DashboardHeaderProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const { title, subtitle } = pageTitles[activePage]

  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div>
        {activePage === "dashboard" && (
          <p className="text-sm text-muted-foreground mb-1">Welcome back, Somchai!</p>
        )}
        <h1 className="text-2xl font-bold text-foreground text-balance">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-card border rounded-lg px-3 py-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>{dateStr}</span>
        </div>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            2
          </span>
        </Button>
      </div>
    </header>
  )
}
