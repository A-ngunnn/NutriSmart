"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import LandingPage from "@/components/landing-page"
import AuthPages from "@/components/auth-pages"
import { useAppStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import LoadingScreen from "@/components/ui/loading-screen"

type View = "landing" | "login" | "register"

export default function Page() {
  const [view, setView] = useState<View>("landing")
  const { fetchUserData } = useAppStore()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  // กัน fetchUserData ยิงซ้ำสำหรับ user คนเดิม — onAuthStateChange ยิง INITIAL_SESSION ทันที
  // ตอน subscribe (เทียบเท่าการเช็ก session ตอน mount) จึงไม่ต้องเรียก getSession() แยกซ้ำซ้อน
  const lastFetchedUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) {
        if (lastFetchedUserId.current === session.user.id) {
          router.push("/dashboard")
          return
        }
        lastFetchedUserId.current = session.user.id
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
      lastFetchedUserId.current = session.user.id
      await fetchUserData(session.user.id)
    }
    router.push("/dashboard")
  }

  if (loading) {
    return (
      <LoadingScreen />
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
