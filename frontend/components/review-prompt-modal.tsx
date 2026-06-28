'use client'

import { useEffect, useState } from 'react'
import { Star, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { fetchMyReview, submitReview } from '@/lib/backend-api'

// เกณฑ์เด้ง popup: ใช้งานต่อเนื่อง (บันทึกอาหารทุกวัน) ครบกี่วันถึงน่าจะมีความเห็นจริงจัง
// จะพูดได้ — เด้งเร็วเกินไป (วันแรกๆ) คนยังไม่มีอะไรจะรีวิว
const STREAK_THRESHOLD = 3
const DISMISS_KEY = 'nutrismart:review-prompt-dismissed-at'
const DISMISS_COOLDOWN_DAYS = 14
const SHOW_DELAY_MS = 1800

function computeStreak(foodEntries: { date: string }[]): number {
  const loggedDates = new Set(foodEntries.map((e) => e.date))
  let streak = 0
  const cursor = new Date()
  while (true) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    if (!loggedDates.has(`${y}-${m}-${d}`)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function ReviewPromptModal() {
  const { foodEntries, profile, userName } = useAppStore()
  const [open, setOpen] = useState(false)
  const [evaluated, setEvaluated] = useState(false)

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (evaluated) return
    const streak = computeStreak(foodEntries)
    if (streak < STREAK_THRESHOLD) return

    const dismissedAt = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) : null
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / 86_400_000
      if (daysSince < DISMISS_COOLDOWN_DAYS) {
        setEvaluated(true)
        return
      }
    }

    let cancelled = false
    fetchMyReview()
      .then((existing) => {
        if (cancelled) return
        setEvaluated(true)
        // มีรีวิวอยู่แล้ว ไม่ต้องถามซ้ำ — ให้ไปแก้ที่หน้าโปรไฟล์เองถ้าอยากเปลี่ยน
        if (!existing) {
          setTimeout(() => setOpen(true), SHOW_DELAY_MS)
        }
      })
      .catch(() => setEvaluated(true))

    return () => {
      cancelled = true
    }
  }, [foodEntries, evaluated])

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setError('เลือกจำนวนดาวก่อนนะ')
      return
    }
    if (!comment.trim()) {
      setError('บอกสั้นๆหน่อยว่าแอปช่วยอะไรคุณได้บ้าง')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await submitReview({
        name: userName || 'ผู้ใช้ NutriSmart',
        rating,
        comment: comment.trim(),
        avatarUrl: showAvatar ? profile.avatarUrl : null,
      })
      setSaved(true)
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setTimeout(() => setOpen(false), 2000)
    } catch (err: any) {
      setError(err.message || 'ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss()
      }}
    >
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border animate-in slide-in-from-bottom-4 duration-200">
        {saved ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">ขอบคุณสำหรับรีวิวนะ! 🎉</p>
            <p className="text-sm text-muted-foreground">
              {rating >= 4 ? 'รีวิวของคุณอาจถูกนำไปแสดงในหน้าแรกของเว็บไซต์' : 'เราจะนำความเห็นนี้ไปปรับปรุงแอปให้ดีขึ้นครับ'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-foreground">ใช้ NutriSmart มาสักพักแล้ว เป็นไงบ้าง?</h3>
              <button
                onClick={handleDismiss}
                aria-label="ปิด"
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">ขอความเห็นสักนิด ช่วยให้คนอื่นรู้จักแอปเรามากขึ้นนะ</p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-1.5 justify-center py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} ดาว`}
                  >
                    <Star
                      size={30}
                      className={
                        star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
                      }
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="เช่น ช่วยให้ติดตามแคลอรีง่ายขึ้นเยอะเลย..."
                maxLength={500}
                rows={3}
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background outline-none focus:border-primary/50 resize-none"
              />

              {profile.avatarUrl && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAvatar}
                    onChange={(e) => setShowAvatar(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-xs text-foreground">แสดงรูปโปรไฟล์ของฉันคู่กับรีวิวด้วย</span>
                </label>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-semibold"
                >
                  ไม่ตอนนี้
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ส่งรีวิว'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
