"use client"

import {
  AlertCircle,
  Bell,
  ChevronLeft,
  ClipboardList,
  Leaf,
  LogOut,
  Menu,
  Scan,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export type Page = "dashboard" | "logs" | "disclaimer"

interface AppSidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  mobileOpen: boolean
  onMobileToggle: () => void
}

const navItems: { id: Page; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "dashboard",
    label: "AI Analyzer",
    icon: Scan,
    description: "Analyze nutrition labels",
  },
  {
    id: "logs",
    label: "Nutrition Logs",
    icon: ClipboardList,
    description: "History & trends",
  },
  {
    id: "disclaimer",
    label: "Info & Disclaimer",
    icon: AlertCircle,
    description: "System info & limits",
  },
]

function SidebarContent({
  activePage,
  onNavigate,
  onLogout,
  onClose,
}: {
  activePage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-sm leading-none">NutriSmart</p>
            <p className="text-xs text-sidebar-foreground/50 mt-0.5">AI Nutrition Analyzer</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/50 hover:text-sidebar-foreground lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Profile */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 bg-sidebar-accent rounded-xl p-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-primary text-white text-sm font-semibold">SJ</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">Somchai Jaidee</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">somchai@example.com</p>
          </div>
          <button className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground shrink-0" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        <p className="px-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-3">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id)
                onClose?.()
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                isActive
                  ? "bg-primary text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className={`text-xs truncate ${isActive ? "text-white/70" : "text-sidebar-foreground/40"}`}>
                  {item.description}
                </p>
              </div>
              {isActive && <ChevronLeft className="w-3 h-3 ml-auto rotate-180 shrink-0" />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 border-t border-sidebar-border pt-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
        <p className="text-xs text-sidebar-foreground/30 text-center mt-4">
          v1.0.0 &nbsp;·&nbsp; &copy; 2025 NutriSmart
        </p>
      </div>
    </div>
  )
}

export function AppSidebar({
  activePage,
  onNavigate,
  onLogout,
  mobileOpen,
  onMobileToggle,
}: AppSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0"
        aria-label="Sidebar"
      >
        <SidebarContent
          activePage={activePage}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-sidebar transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile sidebar"
      >
        <SidebarContent
          activePage={activePage}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onClose={onMobileToggle}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onMobileToggle}
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          <span className="font-bold text-sidebar-foreground text-sm">NutriSmart</span>
        </div>
      </div>
    </>
  )
}
