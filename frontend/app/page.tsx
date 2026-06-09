"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import LandingPage from "@/components/landing-page"
import AuthPages from "@/components/auth-pages"
import { useAppStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

type View = "landing" | "login" | "register"

export default function Page() {
  const [view, setView] = useState<View>("landing")
  const { fetchUserData } = useAppStore()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        try {
          await fetchUserData(session.user.id)
          router.push("/dashboard")
          return
        } catch (error) {
          console.error("Failed to load user data on init:", error)
        }
      }

      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) {
        try {
          await fetchUserData(session.user.id)
          router.push("/dashboard")
          return
        } catch (error) {
          console.error("Failed to load user data after auth change:", error)
        }
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserData, router])

  const handleAuthSuccess = async (name: string) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetchUserData(session.user.id)
    }
    router.push("/dashboard")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-muted-foreground font-medium">กำลังเตรียมความพร้อม...</p>
      </div>
    )
  }

  if (view === "landing") {
    return (
      <LandingPage
        onNavigate={(page) => setView(page as View)}
      />
    )
  }

  if (view === "login" || view === "register") {
    return (
      <AuthPages
        mode={view}
        onSuccess={handleAuthSuccess}
        onNavigate={(page) => setView(page as View)}
      />
    )
  }

  return null
}
