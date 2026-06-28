"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NutriSmartWordmark } from "@/components/ui/nutrismart-wordmark"
import { createClient } from "@/lib/supabase/client"
import LoadingScreen from "@/components/ui/loading-screen"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ลิงก์จากอีเมลจะสร้าง session ชั่วคราวให้อัตโนมัติพร้อม event "PASSWORD_RECOVERY" —
  // ต้องรอ event นี้ก่อนเปิดให้กรอกรหัสใหม่ ไม่งั้นถ้า session ยังไม่มา updateUser จะ fail เงียบๆ
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร")
      return
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => router.push("/dashboard"), 2000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง")
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <img src="/icons/Logo.png" alt="NutriSmart" className="w-10 h-10 object-contain" />
        <p className="text-lg leading-none">
          <NutriSmartWordmark />
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-border shadow-sm p-7">
        {done ? (
          <div className="text-center py-4">
            <p className="text-base font-semibold text-foreground mb-1">เปลี่ยนรหัสผ่านสำเร็จแล้ว! 🎉</p>
            <p className="text-sm text-muted-foreground">กำลังพาคุณไปหน้าหลัก...</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-foreground mb-1">ตั้งรหัสผ่านใหม่</h2>
            <p className="text-sm text-muted-foreground mb-6">กรอกรหัสผ่านใหม่ที่ต้องการใช้เข้าสู่ระบบ</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">รหัสผ่านใหม่</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">ยืนยันรหัสผ่านใหม่</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  "บันทึกรหัสผ่านใหม่"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
