"use client"

import { Leaf, LogOut, MessageCircle, Home, Search, BarChart2, BookOpen, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import NutriChat from "./NutriChat"
import NotificationCenter from "@/lib/notifications/NotificationCenter"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { usePathname, useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

const NAV_ITEMS = [
  { id: "dashboard", label: "หน้าหลัก",  icon: Home, href: "/dashboard" },
  { id: "analyzer",  label: "วิเคราะห์", icon: Search, href: "/analyzer" },
  { id: "health",    label: "สุขภาพ",    icon: BarChart2, href: "/health" },
  { id: "logs",      label: "บันทึก",    icon: BookOpen, href: "/logs" },
  { id: "profile",   label: "โปรไฟล์",   icon: User, href: "/profile" },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userName, clearState, fetchUserData } = useAppStore()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/")
      } else {
        setUserId(session.user.id)
        try {
          await fetchUserData(session.user.id)
        } catch (error) {
          console.error("Failed to load user data on init:", error)
        }
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        setUserId(undefined)
        clearState()
        router.push("/")
      } else {
        setUserId(session.user.id)
        try {
          await fetchUserData(session.user.id)
        } catch (error) {
          console.error("Failed to load user data on auth change:", error)
        }
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, fetchUserData, clearState])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearState()
    router.push("/")
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-muted-foreground font-medium">กำลังเตรียมข้อมูล...</p>
      </div>
    )
  }

  // Determine active item based on pathname prefix
  const activeItemId = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id || "dashboard"

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-52 flex-shrink-0 bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-extrabold text-sm leading-none">NutriSmart</p>
            <p className="text-[10px] text-primary font-semibold tracking-wider uppercase mt-0.5">Med AI Engine</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => (
            <Link
              key={id}
              href={href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activeItemId === id
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <Link href="/profile" className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(userName || "ผู้").charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{userName || "ผู้ใช้"}</p>
                <p className="text-[10px] text-primary">ดูโปรไฟล์</p>
              </div>
            </Link>
            <button onClick={handleLogout} className="text-sidebar-foreground/50 hover:text-destructive transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 bg-white border-b border-border">
          {/* Mobile: branding; Desktop: page title */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold text-sm text-foreground">NutriSmart</span>
          </div>
          <div className="hidden md:block">
            <h1 className="font-bold text-lg text-foreground">
              {NAV_ITEMS.find((n) => n.id === activeItemId)?.label}
            </h1>
          </div>

          {/* Right: bell + user + dropdown */}
          <div className="flex items-center gap-2 md:gap-3">
            <NotificationCenter initialUserId={userId} />
            
            {/* Mobile: avatar dropdown */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold outline-none hover:bg-primary/90 transition-colors">
                    {(userName || "ผู้").charAt(0)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 z-50">
                  <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                    <User className="mr-2 w-4 h-4" />
                    ดูโปรไฟล์
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="mr-2 w-4 h-4" />
                    ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 pb-24 md:pb-6 relative">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav (under 768px) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around px-2 z-40 pb-safe">
        {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
          const isActive = activeItemId === id
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 z-50 group"
      >
        <div className="relative">
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          {!isChatOpen && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
      </button>

      {/* Chat Window Container */}
      <div
        className={cn(
          "fixed z-50 transition-all duration-300 ease-in-out transform origin-bottom-right",
          isChatOpen ? "scale-100 opacity-100 pointer-events-auto" : "scale-95 opacity-0 pointer-events-none",
          "bottom-36 md:bottom-24 right-4 md:right-6 w-[340px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[60vh] shadow-2xl rounded-2xl overflow-hidden"
        )}
      >
        <NutriChat />
      </div>
    </div>
  )
}
