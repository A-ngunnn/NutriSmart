'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsBackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/profile')}
        aria-label="ย้อนกลับ"
        className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shrink-0 hover:bg-muted transition-colors"
      >
        <ArrowLeft size={18} className="text-foreground" />
      </button>
      <div>
        <h1 className="font-bold text-lg text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}
