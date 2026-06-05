"use client"

import { useState } from "react"
import { Leaf, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthPagesProps {
  mode: "login" | "register"
  onSuccess: (name: string) => void
  onNavigate: (page: string) => void
}

import { createClient } from "@/lib/supabase/client"

export default function AuthPages({ mode, onSuccess, onNavigate }: AuthPagesProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const supabase = createClient()

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || "ผู้ใช้",
            }
          }
        })
        if (signUpError) throw signUpError

        if (data.user) {
          // Insert profile into database
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              name: name || "ผู้ใช้",
              gender: "male",
              activity_level: "sedentary",
              goal: "maintain",
            })
          if (profileError) {
            console.error("Error creating profile:", profileError)
          }
        }
        
        onSuccess(name || "ผู้ใช้")
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError

        let userNameToUse = "ผู้ใช้"
        if (data.user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", data.user.id)
            .single()
          
          if (profileData?.name) {
            userNameToUse = profileData.name
          }
        }
        onSuccess(userNameToUse)
      }
    } catch (err: any) {
      console.error(err)
      let displayError = err.message
      if (err.message === "Invalid login credentials") {
        displayError = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      } else if (err.message === "User already registered") {
        displayError = "อีเมลนี้ถูกใช้งานแล้ว"
      } else if (err.message === "Password should be at least 6 characters") {
        displayError = "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"
      }
      setError(displayError || "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์")
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === "login"

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-extrabold text-lg text-foreground leading-none">NutriSmart</p>
          <p className="text-[10px] text-primary font-semibold tracking-widest uppercase">Med AI Engine</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-border shadow-sm p-7">
        <h2 className="text-xl font-extrabold text-foreground mb-1">
          {isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isLogin
            ? "ยินดีต้อนรับกลับ! เข้าสู่ระบบเพื่อดูแลสุขภาพของคุณ"
            : "สร้างบัญชีใหม่เพื่อเริ่มต้นการดูแลสุขภาพ"}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                type="text"
                placeholder="เช่น สมชาย ใจดี"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">อีเมล</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">รหัสผ่าน</Label>
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

          {isLogin && (
            <div className="text-right">
              <button type="button" className="text-xs text-primary hover:underline" disabled={loading}>
                ลืมรหัสผ่าน?
              </button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                กำลังดำเนินการ...
              </>
            ) : (
              isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"
            )}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {isLogin ? (
            <>
              ยังไม่มีบัญชี?{" "}
              <button onClick={() => onNavigate("register")} className="text-primary font-semibold hover:underline">
                สมัครสมาชิก
              </button>
            </>
          ) : (
            <>
              มีบัญชีอยู่แล้ว?{" "}
              <button onClick={() => onNavigate("login")} className="text-primary font-semibold hover:underline">
                เข้าสู่ระบบ
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
        การใช้งาน NutriSmart ถือว่าคุณยอมรับ ข้อกำหนดการใช้งาน และ นโยบายความเป็นส่วนตัว ของเรา
      </p>
    </div>
  )
}
