"use client"

import { LogOut, Home, Search, BarChart2, BookOpen, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import ChatBot from "./ChatBot"
import NotificationCenter from "@/lib/notifications/NotificationCenter"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { usePathname, useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import LoadingScreen from "@/components/ui/loading-screen"
import { NutriSmartWordmark } from "@/components/ui/nutrismart-wordmark"
import { AvocadoMascot, ErrorScreen } from "@/components/ui/error-mascots"
import { useOnlineStatus } from "@/lib/use-online-status"

const NAV_ITEMS = [
  { id: "dashboard", label: "หน้าหลัก", icon: Home, href: "/dashboard", desc: "ภาพรวมประจำวัน" },
  { id: "analyzer", label: "วิเคราะห์", icon: Search, href: "/analyzer", desc: "AI สแกนอาหาร" },
  { id: "health", label: "สุขภาพ", icon: BarChart2, href: "/health", desc: "สถิติและแนวโน้ม" },
  { id: "logs", label: "บันทึก", icon: BookOpen, href: "/logs", desc: "ไดอารี่มื้ออาหาร" },
  { id: "profile", label: "โปรไฟล์", icon: User, href: "/profile", desc: "ข้อมูลส่วนตัว" },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userName, profile, clearState, fetchUserData } = useAppStore()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [isExpanded, setIsExpanded] = useState(true) // Sidebar expanded state
  const isOnline = useOnlineStatus()
  // กัน fetchUserData ยิงซ้ำหลายครั้งสำหรับ user คนเดิม — onAuthStateChange ยิง INITIAL_SESSION
  // ทันทีที่ subscribe (ซึ่งคือ "เช็ก session ตอน mount" อยู่แล้ว) และยังยิงซ้ำทุกครั้งที่ token
  // refresh อัตโนมัติด้วย ถ้าไม่กันไว้ จะมีการยิง fetchUserData (และ 4 backend request ข้างใน)
  // ซ้อนกันหลายรอบโดยไม่จำเป็น จนกองค้างกันที่ backend และทำให้ request อื่นๆ timeout ไปด้วย
  const lastFetchedUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // onAuthStateChange จะยิง event "INITIAL_SESSION" ทันทีที่ subscribe พร้อม session ปัจจุบัน
    // (ตามพฤติกรรมของ Supabase JS v2) จึงไม่ต้องเรียก getSession() แยกต่างหากอีกรอบซ้ำซ้อน
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUserId(undefined)
        lastFetchedUserId.current = undefined
        clearState()
        setLoading(false)
        router.push("/")
        return
      }

      setUserId(session.user.id)
      if (lastFetchedUserId.current === session.user.id) {
        // โหลดข้อมูล user คนนี้ไปแล้ว (เช่น token refresh ไม่ใช่การ login ใหม่) ไม่ต้องยิงซ้ำ
        setLoading(false)
        return
      }
      lastFetchedUserId.current = session.user.id
      try {
        await fetchUserData(session.user.id)
      } catch (error) {
        console.error("Failed to load user data on auth change:", error)
      }
      setLoading(false)
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

  if (mounted && !isOnline) {
    return (
      <ErrorScreen
        mascot={<AvocadoMascot />}
        badgeText="ไม่มีอินเทอร์เน็ต"
        badgeBg="#ECEFF1"
        badgeColor="#546E7A"
        title="อาโวคาโดร้องไห้เลย~ 😢"
        subtitle="หาสัญญาณไม่เจอเลย ช่วยเช็ค Wi-Fi หน่อยนะ!"
        actions={[{ label: "🔄 ลองใหม่!", variant: "primary", onClick: () => window.location.reload() }]}
      />
    )
  }

  if (!mounted || loading) {
    return (
      <LoadingScreen />
    )
  }

  // Determine active item based on pathname prefix
  const activeItemId = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id || "dashboard"

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Desktop sidebar (md+) ── */}
      <aside className={cn(
        "hidden md:flex flex-col shrink-0 bg-card border-r border-border text-foreground z-30 transition-all duration-300 ease-in-out",
        isExpanded ? "w-72" : "w-20"
      )}>
        {/* Logo & Toggle */}
        <div className={cn(
          "h-20 px-4 py-4 border-b border-border flex items-center transition-all duration-300",
          isExpanded ? "justify-start" : "justify-center"
        )}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl p-1 -m-1 transition-transform active:scale-[0.98]"
            title={isExpanded ? "ย่อเมนู" : "ขยายเมนู"}
          >
            <img src="/icons/Logo.png" alt="Logo" className="w-10 h-10 shrink-0 object-contain" />
            {isExpanded && (
              <div className="truncate">
                <h1 className="text-lg truncate">
                  <NutriSmartWordmark />
                </h1>
                <p className="text-[10px] text-muted-foreground truncate">สุขภาพดี ชีวิตดี</p>
              </div>
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
          {isExpanded && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">เมนูหลัก</p>}
          {NAV_ITEMS.map(({ id, label, icon: Icon, href, desc }) => {
            const isActive = activeItemId === id;
            return (
              <Link
                key={id}
                href={href}
                title={!isExpanded ? label : undefined}
                className={cn(
                  "w-full flex items-center rounded-2xl transition-all duration-200 overflow-hidden",
                  isExpanded ? "gap-3 px-3 py-3 text-left" : "justify-center p-3 mx-auto w-12 h-12",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-green-200"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-primary-foreground" : "")}>
                  <Icon className="w-5 h-5" />
                </span>
                {isExpanded && (
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-sm font-semibold truncate">{label}</p>
                    <p className={cn("text-[10px] truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>{desc}</p>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className={cn(
          "border-t border-border py-4 transition-all duration-300",
          isExpanded ? "px-4" : "px-2"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center group rounded-2xl hover:bg-accent/50 transition-colors py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  isExpanded ? "gap-3 px-2 text-left" : "justify-center"
                )}
                title={!isExpanded ? "โปรไฟล์และการตั้งค่า" : undefined}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-primary/20">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{(userName || "ผ")[0]}</span>
                  )}
                </div>
                {isExpanded && (
                  <div className="flex-1 min-w-0 truncate">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{userName || "ผู้ใช้"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {profile?.weight ? `${profile.weight} kg` : "-"} · {profile?.height ? `${profile.height} cm` : "-"}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isExpanded ? "end" : "center"} side="top" sideOffset={12} className={cn("z-50", isExpanded ? "w-56" : "w-48")}>
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer py-2">
                <User className="mr-2 w-4 h-4" />
                ดูโปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2">
                <LogOut className="mr-2 w-4 h-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="shrink-0 flex items-center justify-between px-4 h-14 bg-white border-b border-border">
          {/* Mobile: branding; Desktop: page title */}
          <div className="flex items-center gap-2 md:hidden">
            <img src="/icons/Logo.png" alt="Logo" className="w-7 h-7 shrink-0 object-contain" />
            <NutriSmartWordmark />
          </div>
          {/* Desktop: page title removed — each page already renders its own title + subtitle below */}
          <div className="hidden md:block" />

          {/* Right: bell + user + dropdown */}
          <div className="flex items-center gap-2 md:gap-3">
            <NotificationCenter initialUserId={userId} />

            {/* Mobile: avatar dropdown */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary text-xs font-bold outline-none border border-primary/20 hover:bg-muted/80 transition-colors overflow-hidden">
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      (userName || "ผู้").charAt(0)
                    )}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 pb-safe">
        <div className="flex justify-around items-center py-2 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
            const isActive = activeItemId === id
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("transition-transform duration-200", isActive ? "scale-110" : "")}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className={cn("text-[10px] font-medium", isActive ? "font-semibold text-primary" : "")}>
                  {label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <ChatBot />
    </div>
  )
}