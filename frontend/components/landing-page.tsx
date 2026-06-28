"use client"

import { useEffect, useState } from "react"
import { Search, BarChart2, BookOpen, ArrowRight, Play, ChevronDown, CheckCircle, Shield, Zap, Home, User, Star, Quote, Heart, Target, Sparkles, Bell, Moon, Sunrise, Sun, Activity, Droplets, Apple as AppleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NutriSmartWordmark } from "@/components/ui/nutrismart-wordmark"
import { fetchPublicReviews, type Review } from "@/lib/backend-api"

interface LandingPageProps {
  onNavigate: (page: string) => void
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    fetchPublicReviews().then(setReviews).catch(() => setReviews([]))
  }, [])

  return (
    <div className="min-h-screen bg-white text-foreground font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icons/Logo.png" alt="NutriSmart" className="w-9 h-9 object-contain" />
          <NutriSmartWordmark className="text-lg" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("login")}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2"
          >
            เข้าสู่ระบบ
          </button>
          <Button onClick={() => onNavigate("register")} size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-full px-5">
            สมัครสมาชิก
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 md:px-8 lg:px-16 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-16">
          {/* Left */}
          <div className="flex-1 text-center md:text-left">
            <Badge className="mb-4 bg-[--nutri-green-light] text-primary border-0 font-medium tracking-wide text-xs uppercase rounded-full px-4 py-1">
              เปิดให้ใช้งานแล้ววันนี้
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-balance text-foreground mb-6">
              ถ่ายรูปวิเคราะห์ฉลาก
              <br />
              ด้วยอัจฉริยภาพของ{" "}
              <span className="text-primary">AI</span>
              <br />
              <span className="text-primary">โภชนาการ</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-lg mx-auto md:mx-0 mb-8">
              หมดห่วงเรื่องการพิมพ์ข้อมูลสารอาหารด้วยตัวเอง ถ่ายรูปสแกนฉลากโภชนาการผ่านเทคโนโลยีสแกนภาพอัจฉริยะแบบ{" "}
              <strong>OCR</strong> ประมวลผลร่วมกับ <strong>RAG (Retrieval-Augmented Generation)</strong> และโมเดลการวิเคราะห์ขั้นยอด
              คอยควบคุมน้ำตาล โซเดียม และแคลอรี่ให้อยู่ในเกณฑ์ปลอดภัยโดยอัตโนมัติ
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button
                onClick={() => onNavigate("register")}
                className="bg-primary hover:bg-primary/90 text-white rounded-full px-7 py-3 text-base font-semibold flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                เริ่มต้นใช้งานฟรี
              </Button>
              <Button
                variant="outline"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full px-7 py-3 text-base font-semibold flex items-center gap-2 border-border"
              >
                เรียนรู้เพิ่มเติม
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right – Phone Mockup */}
          <div className="shrink-0 flex justify-center">
            <div className="relative w-68 md:w-78">
              <div className="rounded-[2.5rem] bg-gray-950 p-2.5 shadow-2xl ring-1 ring-black/5">
                <div className="rounded-4xl bg-background overflow-hidden">
                  {/* App header — เหมือน header จริงในแอป (logo+wordmark ซ้าย, กระดิ่ง+avatar ขวา) */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/60 bg-card">
                    <div className="flex items-center gap-1.5">
                      <img src="/icons/Logo.png" alt="" className="w-5 h-5 object-contain" />
                      <span className="text-[12px] font-extrabold leading-none">
                        <span className="text-primary">Nutri</span><span className="text-[#F57C00]">Smart</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Bell size={11} className="text-foreground" />
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] font-bold flex items-center justify-center">1</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">ส</div>
                    </div>
                  </div>

                  {/* Phone screen content — mock ของหน้า "หน้าหลัก" จริงในแอป */}
                  <div className="p-3 space-y-2.5 bg-background">
                    {/* Greeting card */}
                    <div className="p-2.5 rounded-2xl bg-card border border-border/70 shadow-sm flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Moon className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground">NutriSmart Dashboard</p>
                        <p className="text-[11px] font-bold text-foreground leading-tight">
                          สวัสดียามเย็น, <span className="text-primary">คุณสมชาย</span>
                        </p>
                        <p className="text-[8px] text-muted-foreground leading-tight">วันนี้พร้อมลุยเป้าหมายสุขภาพแล้วหรือยัง?</p>
                      </div>
                    </div>

                    {/* Calorie ring card */}
                    <div className="bg-card rounded-2xl p-3 border border-border/70 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-foreground/80 tracking-wide">เป้าหมายแคลอรีวันนี้</span>
                        <span className="text-[8px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">วันนี้</span>
                      </div>
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          <svg width="52" height="52" className="-rotate-90">
                            <circle cx="26" cy="26" r="21" stroke="var(--border)" strokeWidth="5" fill="none" />
                            <circle cx="26" cy="26" r="21" stroke="#1d9e75" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="132" strokeDashoffset="33" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[12px] font-bold text-foreground leading-none">75%</span>
                            <span className="text-[5px] text-muted-foreground leading-none mt-0.5">ของเป้าหมาย</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[8px] text-muted-foreground">รับประทานแล้ว</p>
                          <p className="text-lg font-extrabold text-primary leading-none">1,350</p>
                          <p className="text-[8px] text-muted-foreground mt-0.5">จาก 1,800 kcal</p>
                          <div className="mt-1.5 w-full bg-muted rounded-full h-1 overflow-hidden">
                            <div className="h-1 rounded-full bg-primary" style={{ width: "75%" }} />
                          </div>
                          <p className="text-[8px] font-medium text-green-600 mt-1">เหลืออีก 450 kcal</p>
                        </div>
                      </div>
                    </div>

                    {/* Macro mini cards */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "โปรตีน", value: "62/90g", icon: Activity, color: "text-blue-500", bg: "bg-blue-50" },
                        { label: "คาร์บ", value: "140/210g", icon: AppleIcon, color: "text-orange-500", bg: "bg-orange-50" },
                        { label: "ไขมัน", value: "38/60g", icon: Droplets, color: "text-red-500", bg: "bg-red-50" },
                      ].map((m) => (
                        <div key={m.label} className="bg-card rounded-xl p-2 border border-border/70 shadow-sm flex flex-col items-center text-center">
                          <div className={`w-6 h-6 rounded-lg ${m.bg} flex items-center justify-center mb-1.5`}>
                            <m.icon className={`w-3 h-3 ${m.color}`} />
                          </div>
                          <p className="text-[10px] font-bold text-foreground leading-none">{m.value}</p>
                          <p className="text-[8px] text-muted-foreground font-medium mt-1">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* มื้ออาหารวันนี้ */}
                    <div className="bg-card rounded-2xl p-3 border border-border/70 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-foreground/80 tracking-wide">มื้ออาหารวันนี้</span>
                        <span className="text-[8px] text-primary font-medium">ดูประวัติ</span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { label: "มื้อเช้า", icon: Sunrise, bg: "bg-amber-50", color: "text-amber-600" },
                          { label: "มื้อกลางวัน", icon: Sun, bg: "bg-green-50", color: "text-green-600" },
                        ].map((meal) => (
                          <div key={meal.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-6 h-6 rounded-lg ${meal.bg} flex items-center justify-center shrink-0`}>
                                <meal.icon className={`w-3 h-3 ${meal.color}`} />
                              </div>
                              <p className="text-[9px] font-semibold text-foreground truncate">{meal.label}</p>
                            </div>
                            <span className="text-[7px] font-medium text-muted-foreground border border-border rounded-full px-2 py-1 shrink-0">+ เพิ่มอาหาร</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom nav mock — ไอคอน+ป้ายชื่อตรงกับแถบเมนูจริงในแอป */}
                    <div className="flex justify-around items-center pt-2.5 mt-1 border-t border-border/60">
                      {[
                        { icon: Home, label: "หน้าหลัก" },
                        { icon: Search, label: "วิเคราะห์" },
                        { icon: BarChart2, label: "สุขภาพ" },
                        { icon: BookOpen, label: "บันทึก" },
                        { icon: User, label: "โปรไฟล์" },
                      ].map(({ icon: Icon, label }, i) => (
                        <div key={label} className="flex flex-col items-center gap-0.5">
                          <Icon className={`w-3.5 h-3.5 ${i === 0 ? "text-primary" : "text-muted-foreground/50"}`} strokeWidth={i === 0 ? 2.5 : 2} />
                          <span className={`text-[6px] font-medium ${i === 0 ? "text-primary" : "text-muted-foreground/50"}`}>{label}</span>
                          {i === 0 && <div className="w-0.5 h-0.5 rounded-full bg-primary" />}
                        </div>
                      ))}
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pt-1">
                      <div className="w-24 h-1 rounded-full bg-foreground/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About / Mission */}
      <section className="px-4 md:px-8 lg:px-16 py-16 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[--nutri-green-light] text-primary border-0 font-medium tracking-wide text-xs uppercase rounded-full px-4 py-1">
              เกี่ยวกับเรา
            </Badge>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-5 text-balance">
              ทำไมเราถึงสร้าง NutriSmart
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mx-auto">
              คนไทยจำนวนมากไม่รู้ว่าอาหารที่กินในแต่ละวันมีน้ำตาล โซเดียม หรือแคลอรี่มากน้อยแค่ไหน
              เพราะการอ่านฉลากโภชนาการและคำนวณเทียบกับเกณฑ์ที่เหมาะสมเป็นเรื่องยุ่งยากสำหรับคนทั่วไป
              NutriSmart จึงเกิดขึ้นเพื่อให้ทุกคนเข้าใจสิ่งที่กินได้ง่ายขึ้น แค่ถ่ายรูป ก็รู้ผลและคำแนะนำที่เหมาะกับตัวเองทันที
              โดยอ้างอิงมาตรฐาน Thai RDI เพื่อให้คำแนะนำสอดคล้องกับคนไทยจริงๆ
            </p>
          </div>
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16 scrollbar-none sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0">
            {[
              { icon: Heart, title: "เริ่มจากปัญหาจริง", desc: "อยากให้การดูแลสุขภาพเป็นเรื่องที่ทุกคนทำได้ ไม่ต้องมีความรู้ด้านโภชนาการมาก่อน", color: "text-red-500", bg: "bg-red-50" },
              { icon: Target, title: "เข้าใจง่าย ใช้ได้จริง", desc: "ออกแบบให้ใช้งานง่ายที่สุด ไม่ต้องพิมพ์ข้อมูลเอง แค่ถ่ายรูปก็พอ", color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Sparkles, title: "พัฒนาต่อเนื่อง", desc: "โปรเจกต์นี้ยังพัฒนาอยู่เรื่อยๆ ตามความเห็นและการใช้งานจริงของผู้ใช้ทุกคน", color: "text-primary", bg: "bg-[--nutri-green-light]" },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="shrink-0 w-72 snap-center sm:w-auto bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col gap-4">
                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground mb-1">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 md:px-8 lg:px-16 py-16">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 text-balance">
            ฟังก์ชันหลักเพื่อการดูแลสุขภาพระดับพรีเมียม
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            เราออกแบบทุกขั้นตอนด้วยความใส่ใจ เพื่อให้คุณวิเคราะห์และควบคุมการกินได้อย่างง่ายดายที่สุด
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Search, color: "text-primary", bg: "bg-[--nutri-green-light]", title: "วิเคราะห์ฉลากโภชนาการ", desc: "สแกนฉลากด้วย OCR และ AI วิเคราะห์ระดับน้ำตาล ไขมัน โซเดียม และแคลอรี่ทันที" },
            { icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50", title: "แดชบอร์ดสุขภาพ", desc: "ติดตามประวัติการสแกน คะแนนสุขภาพสะสม และแนวโน้มโภชนาการรายวัน" },
            { icon: BookOpen, color: "text-destructive", bg: "bg-[--nutri-red-light]", title: "บันทึกโภชนาการ", desc: "บันทึกมื้ออาหารรายวัน ติดตามแคลอรี่เทียบ TDEE ส่วนบุคคล" },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col gap-4">
              <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground mb-1">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="px-4 md:px-8 lg:px-16 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-foreground mb-10 text-balance">
            ทำไมต้อง NutriSmart?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "ข้อมูลปลอดภัย", desc: "ข้อมูลสุขภาพของคุณถูกเข้ารหัสและจัดเก็บอย่างปลอดภัยตามมาตรฐาน PDPA" },
              { icon: Zap, title: "วิเคราะห์เร็วทันใจ", desc: "ผลการวิเคราะห์ฉลากโภชนาการในไม่ถึง 3 วินาที ด้วย AI Engine ขั้นสูง" },
              { icon: CheckCircle, title: "อิงมาตรฐาน Thai RDI", desc: "เกณฑ์การประเมินอิงตามปริมาณสารอาหารอ้างอิง (Thai RDI) ของกระทรวงสาธารณสุข" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-full bg-[--nutri-green-light] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground mb-1">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews — รีวิวจริงจากผู้ใช้ที่ส่งผ่านฟอร์มในแอป (โปรไฟล์ > ให้คะแนนแอป) ไม่ใช่ของปลอม
          ซ่อนทั้ง section ไปเลยถ้ายังไม่มีรีวิว 4-5 ดาวเข้ามา กันโชว์หัวข้อโล่งๆไม่มีเนื้อหา */}
      {reviews.length > 0 && (
        <section className="px-4 md:px-8 lg:px-16 py-16 bg-muted/50">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 text-balance">
              ผู้ใช้จริงพูดถึง NutriSmart
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              ความคิดเห็นจากผู้ใช้งานจริง ส่งตรงผ่านแอปของเรา
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reviews.map((r) => (
              <div key={r.id} className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col gap-3">
                <Quote className="w-6 h-6 text-primary/30" />
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < r.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}
                    />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed line-clamp-4">{r.comment}</p>
                <div className="flex items-center gap-2 mt-auto">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {r.name[0]}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-muted-foreground">{r.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-4 md:px-8 py-16 bg-primary">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4 text-balance">
            เริ่มต้นดูแลสุขภาพของคุณวันนี้
          </h2>
          <p className="text-white/80 text-base mb-8 leading-relaxed">
            สมัครฟรี ไม่มีค่าใช้จ่าย เริ่มวิเคราะห์ฉลากโภชนาการและติดตามสุขภาพได้ทันที
          </p>
          <Button
            onClick={() => onNavigate("register")}
            className="bg-white text-primary hover:bg-white/90 rounded-full px-8 py-3 text-base font-bold flex items-center gap-2 mx-auto"
          >
            เริ่มต้นใช้งานฟรี
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-8 border-t border-border text-center text-sm text-muted-foreground space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <a href="/terms" className="hover:text-primary hover:underline">ข้อกำหนดและความเป็นส่วนตัว</a>
          <a href="/help" className="hover:text-primary hover:underline">ช่วยเหลือ &amp; คำถามที่พบบ่อย</a>
          <a href="mailto:support@nutrismart.app" className="hover:text-primary hover:underline">ติดต่อเรา</a>
        </div>
        <p>© {new Date().getFullYear() + 543} NutriSmart. สงวนลิขสิทธิ์ทุกประการ | ข้อมูลนี้ไม่ใช่คำแนะนำทางการแพทย์</p>
      </footer>
    </div>
  )
}
