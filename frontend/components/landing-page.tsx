"use client"

import { Leaf, Search, BarChart2, BookOpen, ArrowRight, Play, ChevronDown, CheckCircle, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NutriSmartWordmark } from "@/components/ui/nutrismart-wordmark"

interface LandingPageProps {
  onNavigate: (page: string) => void
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
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
              Live &amp; Production Ready
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
                className="rounded-full px-7 py-3 text-base font-semibold flex items-center gap-2 border-border"
              >
                เรียนรู้เพิ่มเติม
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right – Phone Mockup */}
          <div className="shrink-0 flex justify-center">
            <div className="relative w-65 md:w-75">
              <div className="rounded-[2.5rem] bg-gray-900 p-3 shadow-2xl">
                <div className="rounded-4xl bg-white overflow-hidden">
                  {/* Phone top notch */}
                  <div className="bg-gray-900 h-7 flex items-center justify-center">
                    <div className="w-20 h-4 bg-gray-800 rounded-full" />
                  </div>
                  {/* Phone screen content */}
                  <div className="p-4 space-y-3">
                    <div className="bg-[--nutri-green-light] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">Apple Health Connected</p>
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mx-auto mb-2">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/></svg>
                      </div>
                      <p className="text-xs font-bold text-foreground">Nutrition Score</p>
                      <p className="text-2xl font-extrabold text-primary">98/100</p>
                    </div>
                    <div className="border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Leaf className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-[11px] font-bold text-foreground">NutriSmart Advisory</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        ปริมาณแคลอรี่และโซเดียมอยู่ในสัดส่วนที่ปลอดภัยต่อสระของคุณแล้วครับ
                      </p>
                    </div>
                    {/* Bottom nav mock */}
                    <div className="flex justify-around pt-2 border-t border-border">
                      {["home","search","bookmark","user"].map((icon) => (
                        <div key={icon} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted">
                          <div className="w-3 h-3 bg-muted-foreground/40 rounded-sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 md:px-8 lg:px-16 py-16 bg-muted/50">
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
            <div key={title} className="bg-white rounded-2xl p-6 border border-border shadow-sm flex flex-col gap-4">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
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
      <footer className="px-4 md:px-8 py-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>© 2569 NutriSmart. สงวนลิขสิทธิ์ทุกประการ | ข้อมูลนี้ไม่ใช่คำแนะนำทางการแพทย์</p>
      </footer>
    </div>
  )
}
