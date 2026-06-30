'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Sparkles } from 'lucide-react'
import { chatWithBackend } from '@/lib/backend-api'
import { useAppStore, calcTDEE } from '@/lib/store'

type Message = {
  id: number
  role: 'user' | 'bot'
  text: string
  time: string
}

const QUICK_REPLIES = [
  'แนะนำอาหารเย็นวันนี้หน่อยดิ๊',
  'แคลในข้าวมันไก่เอาเรื่องป่ะ?',
  'ลีนหุ่นยังไงให้เฟิร์มสุด',
  'ต้องอัดโปรตีนวันละเท่าไหร่?',
]

// คำต้อนรับเริ่มต้น (ปรับแบบกลางๆ ไว้ก่อน แล้ว AI จะปรับคำพูดตามโปรไฟล์ในการแชทจริง)
const WELCOME =
  'สวัสดีค่ะ! เราเป็นเทรนเนอร์ส่วนตัวของคุณเอง วันนี้อยากดูแลสุขภาพแบบไหนดี หรืออยากเช็กแคลในเมนูไหน บอกมาได้เลยนะ 🏋️‍♀️🍃'

function getTime() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <span key={i} className="block h-1.5" />

    const isBullet = /^[\*\-•]\s/.test(trimmed)
    const content = isBullet ? trimmed.replace(/^[\*\-•]\s*/, '') : trimmed

    // split on **bold**
    const parts = content.split(/(\*\*[^*]+\*\*)/)
    const nodes = parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>
        : <span key={j}>{p.replace(/\*/g, '')}</span>
    )

    return (
      <span key={i} className="block leading-relaxed">
        {isBullet && <span className="mr-1.5 text-primary">•</span>}
        {nodes}
      </span>
    )
  })
}

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'bot', text: WELCOME, time: getTime() },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const lastSendRef = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { profile, userName } = useAppStore()

  const userProfile = {
    name: profile.name || userName || 'เพื่อน',
    weight: parseFloat(profile.weight) || 65,
    height: parseFloat(profile.height) || 170,
    age: parseFloat(profile.age) || 28,
    gender: profile.gender === 'female' ? 'หญิง' : 'ชาย',
    goal_calories: calcTDEE(
      parseFloat(profile.weight) || 65,
      parseFloat(profile.height) || 170,
      parseFloat(profile.age) || 28,
      profile.gender,
      profile.activityLevel,
      profile.goal
    ) || 2000
  }

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, typing])

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing) return
    const now = Date.now()
    if (now - lastSendRef.current < 1000) return
    lastSendRef.current = now

    const userMsg: Message = { id: now, role: 'user', text, time: getTime() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }))

      // ⚡ ส่งทั้งข้อความ ประวัติ และข้อมูลโปรไฟล์ผู้ใช้ไปประมวลผลคำพูดตามเกณฑ์ที่หลังบ้าน
      const reply = await chatWithBackend(text, history, userProfile)
      setMessages((prev) => [...prev, { id: Date.now(), role: 'bot', text: reply, time: getTime() }])
    } catch (err: any) {
      // log ไว้ debug — เดิมไม่มี log เลย ทำให้เห็นแค่ข้อความ fallback เดียวกันทุกครั้งโดยไม่รู้สาเหตุจริง
      console.error('[ChatBot] sendMessage failed:', err)
      // โควตาแชทเต็ม (429) บอก error.detail จริงจาก backend ตรงๆ ไม่งั้นคนจะกดพิมพ์ซ้ำเรื่อยๆ
      // ด้วยข้อความ "ลองใหม่" ทั้งที่ติดโควตาอยู่ ไม่มีทางสำเร็จจนกว่าจะถึงวันถัดไป
      const isQuota = typeof err?.message === 'string' && err.message.includes('โควตา')
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'bot',
          text: isQuota ? err.message : 'อุ๊ย ระบบสะดุดนิดหน่อยอะ ขอโทษด้วยนะ ลองพิมพ์อีกครั้งได้เลย 🙏',
          time: getTime(),
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="เปิดแชทกับเทรนเนอร์ NutriSmart"
        className={`fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100'
        }`}
      >
        <Sparkles size={24} className="text-primary-foreground" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          {/* Mobile backdrop */}
          <div
            className="absolute inset-0 bg-black/20 lg:hidden pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          <div className="relative pointer-events-auto w-full lg:w-96 h-[70dvh] lg:h-145 lg:mb-6 lg:mr-6 bg-card rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-primary shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bot size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">เทรนเนอร์ NutriSmart</p>
                <p className="text-[11px] text-white/75">เพื่อนคู่คิดสายฟิต ลุย ๆ 🏋️‍♂️</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="ปิดแชท"
              >
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                      msg.role === 'bot'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-accent text-accent-foreground'
                    }`}
                  >
                    {msg.role === 'bot' ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div
                    className={`max-w-[78%] flex flex-col gap-0.5 ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        msg.role === 'bot'
                          ? 'bg-muted text-foreground rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      }`}
                    >
                      {msg.role === 'bot' ? renderText(msg.text) : msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide shrink-0">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={typing}
                  className="shrink-0 text-[11px] bg-accent text-accent-foreground border border-border rounded-full px-3 py-1.5 font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-3 pb-4 pt-1 shrink-0">
              <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                  placeholder="ถามเทรนเนอร์ได้เลยนาย..."
                  disabled={typing}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground disabled:opacity-60"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || typing}
                  aria-label="ส่งข้อความ"
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                >
                  <Send size={14} className="text-primary-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}